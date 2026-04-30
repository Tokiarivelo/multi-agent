use std::path::{Component, Path, PathBuf};

use reqwest::Client;
use serde_json::{json, Value};
use tokio::fs;

use crate::config::Config;

/// Normalize a path without requiring it to exist (no canonicalize).
pub fn normalize_path(path: &Path) -> PathBuf {
    let mut out = PathBuf::new();
    for component in path.components() {
        match component {
            Component::ParentDir => {
                out.pop();
            }
            Component::CurDir => {}
            c => out.push(c),
        }
    }
    out
}

/// Resolve filePath relative to workspace/cwd. No containment check.
fn resolve_path(config: &Config, file_path: &str, cwd: Option<&str>) -> PathBuf {
    let base = match cwd {
        Some(c) if Path::new(c).is_absolute() => PathBuf::from(c),
        Some(c) => PathBuf::from(&config.workspace_root).join(c),
        None => PathBuf::from(&config.workspace_root),
    };

    if Path::new(file_path).is_absolute() {
        normalize_path(Path::new(file_path))
    } else {
        normalize_path(&base.join(file_path))
    }
}

/// Resolve filePath and enforce it stays inside workspace_root.
pub fn resolve_workspace_path(config: &Config, file_path: &str) -> anyhow::Result<PathBuf> {
    let root = normalize_path(Path::new(&config.workspace_root));

    let resolved = if Path::new(file_path).is_absolute() {
        normalize_path(Path::new(file_path))
    } else {
        normalize_path(&root.join(file_path))
    };

    if !resolved.starts_with(&root) {
        anyhow::bail!(
            "Access denied: path \"{}\" is outside the allowed workspace root",
            file_path
        );
    }
    Ok(resolved)
}

pub async fn upload_to_cloud(
    client: &Client,
    config: &Config,
    original_path: &str,
    filename: &str,
    content: &[u8],
    user_id: &str,
) -> anyhow::Result<Value> {
    let file_service_url = &config.file_service_url;

    // ── Step 1: initiate upload — get presigned PUT URL ───────────────────────
    let init_resp = client
        .post(format!("{}/api/files/initiate-upload", file_service_url))
        .query(&[("userId", user_id)])
        .json(&json!({
            "originalName": filename,
            "mimeType":     "application/octet-stream",
            "size":         content.len()
        }))
        .send()
        .await
        .map_err(|e| anyhow::anyhow!("Cloud upload initiation failed: {}", e))?;

    if !init_resp.status().is_success() {
        let text = init_resp.text().await.unwrap_or_default();
        anyhow::bail!("Cloud upload initiation failed: {}", text);
    }

    let init_data: Value = init_resp
        .json()
        .await
        .map_err(|e| anyhow::anyhow!("Cloud upload initiation failed to parse response: {}", e))?;

    let upload_url = init_data["uploadUrl"]
        .as_str()
        .ok_or_else(|| anyhow::anyhow!("Missing uploadUrl in initiate-upload response"))?;
    let download_url = init_data["record"]["url"]
        .as_str()
        .unwrap_or("")
        .to_string();
    let file_id = init_data["record"]["id"]
        .as_str()
        .unwrap_or("")
        .to_string();
    let stored_as = init_data["record"]["storedName"]
        .as_str()
        .unwrap_or(filename)
        .to_string();

    // ── Step 2: PUT bytes directly to MinIO (no buffering through file-service) ─
    let put_resp = client
        .put(upload_url)
        .body(content.to_vec())
        .header("Content-Type", "application/octet-stream")
        .send()
        .await
        .map_err(|e| anyhow::anyhow!("Cloud upload PUT failed: {}", e))?;

    if !put_resp.status().is_success() {
        let text = put_resp.text().await.unwrap_or_default();
        anyhow::bail!("Cloud upload PUT failed: {}", text);
    }

    Ok(json!({
        "success":  true,
        "url":      download_url,
        "path":     original_path,
        "storedAs": stored_as,
        "fileId":   file_id,
        "type":     "cloud"
    }))
}

pub async fn file_read(config: &Config, params: &Value) -> anyhow::Result<Value> {
    if !config.enable_file_operations {
        anyhow::bail!("File operations are disabled");
    }
    let path_str = params
        .get("path")
        .and_then(|v| v.as_str())
        .ok_or_else(|| anyhow::anyhow!("path is required"))?;
    let cwd = params.get("cwd").and_then(|v| v.as_str());

    let resolved = resolve_path(config, path_str, cwd);
    let content = fs::read_to_string(&resolved)
        .await
        .map_err(|e| anyhow::anyhow!("File read failed for \"{}\": {}", resolved.display(), e))?;

    Ok(json!({ "success": true, "content": content, "path": resolved.to_string_lossy() }))
}

/// pdf_read proxies to the document-service (which uses pdfplumber) to preserve
/// output parity with the TypeScript pdf-parse implementation.
pub async fn pdf_read(client: &Client, config: &Config, params: &Value) -> anyhow::Result<Value> {
    if !config.enable_file_operations {
        anyhow::bail!("File operations are disabled");
    }
    let path_str = params
        .get("path")
        .and_then(|v| v.as_str())
        .ok_or_else(|| anyhow::anyhow!("path is required"))?;
    let cwd = params.get("cwd").and_then(|v| v.as_str());

    let resolved = resolve_path(config, path_str, cwd);
    let safe_path = resolve_workspace_path(config, &resolved.to_string_lossy())?;

    let resp = client
        .post(format!(
            "{}/api/documents/parse-path",
            config.document_service_url
        ))
        .json(&json!({ "path": safe_path.to_string_lossy(), "encoding": "utf-8" }))
        .send()
        .await
        .map_err(|e| anyhow::anyhow!("PDF read failed for \"{}\": {}", path_str, e))?;

    if !resp.status().is_success() {
        let detail: Value = resp.json().await.unwrap_or(Value::Null);
        let msg = detail
            .get("detail")
            .and_then(|v| v.as_str())
            .unwrap_or("unknown error");
        anyhow::bail!("PDF read failed for \"{}\": {}", path_str, msg);
    }

    resp.json::<Value>()
        .await
        .map_err(|e| anyhow::anyhow!("PDF read failed: {}", e))
}

pub async fn file_write(
    client: &Client,
    config: &Config,
    params: &Value,
    user_id: Option<String>,
) -> anyhow::Result<Value> {
    if !config.enable_file_operations {
        anyhow::bail!("File operations are disabled");
    }
    let path_str = params
        .get("path")
        .and_then(|v| v.as_str())
        .ok_or_else(|| anyhow::anyhow!("path is required"))?;
    let content = params
        .get("content")
        .and_then(|v| v.as_str())
        .ok_or_else(|| anyhow::anyhow!("content is required"))?;

    let resolved = resolve_path(config, path_str, None);
    let root = normalize_path(Path::new(&config.workspace_root));

    if !resolved.starts_with(&root) {
        let uid = user_id.ok_or_else(|| {
            anyhow::anyhow!("Access denied: path is outside workspace and no userId provided")
        })?;
        let filename = Path::new(path_str)
            .file_name()
            .and_then(|s| s.to_str())
            .unwrap_or("file.txt");
        return upload_to_cloud(client, config, path_str, filename, content.as_bytes(), &uid).await;
    }

    if let Some(parent) = resolved.parent() {
        fs::create_dir_all(parent)
            .await
            .map_err(|e| anyhow::anyhow!("File write failed: {}", e))?;
    }
    fs::write(&resolved, content)
        .await
        .map_err(|e| anyhow::anyhow!("File write failed: {}", e))?;

    Ok(json!({ "success": true, "path": resolved.to_string_lossy(), "type": "local" }))
}

pub async fn workspace_read(config: &Config, params: &Value) -> anyhow::Result<Value> {
    let file_path = params
        .get("filePath")
        .and_then(|v| v.as_str())
        .ok_or_else(|| anyhow::anyhow!("filePath is required"))?;
    file_read(config, &json!({ "path": file_path })).await
}

pub async fn workspace_write(
    client: &Client,
    config: &Config,
    params: &Value,
    user_id: Option<String>,
) -> anyhow::Result<Value> {
    if !config.enable_file_operations {
        anyhow::bail!("File operations are disabled");
    }
    let file_path = params
        .get("filePath")
        .and_then(|v| v.as_str())
        .ok_or_else(|| anyhow::anyhow!("filePath is required"))?;
    let content = params
        .get("content")
        .and_then(|v| v.as_str())
        .ok_or_else(|| anyhow::anyhow!("content is required"))?;

    let resolved_res = resolve_workspace_path(config, file_path);

    match resolved_res {
        Ok(resolved) => {
            if let Some(parent) = resolved.parent() {
                fs::create_dir_all(parent)
                    .await
                    .map_err(|e| anyhow::anyhow!("Workspace write failed: {}", e))?;
            }
            fs::write(&resolved, content)
                .await
                .map_err(|e| anyhow::anyhow!("Workspace write failed: {}", e))?;

            Ok(json!({ "success": true, "path": resolved.to_string_lossy(), "type": "local" }))
        }
        Err(_) => {
            let uid = user_id.ok_or_else(|| {
                anyhow::anyhow!("Access denied: path is outside workspace and no userId provided")
            })?;
            let filename = Path::new(file_path)
                .file_name()
                .and_then(|s| s.to_str())
                .unwrap_or("file.txt");
            upload_to_cloud(client, config, file_path, filename, content.as_bytes(), &uid).await
        }
    }
}

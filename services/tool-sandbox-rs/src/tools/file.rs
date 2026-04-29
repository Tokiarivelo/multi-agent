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

pub async fn file_write(config: &Config, params: &Value) -> anyhow::Result<Value> {
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

    let resolved = PathBuf::from(path_str);
    if let Some(parent) = resolved.parent() {
        fs::create_dir_all(parent)
            .await
            .map_err(|e| anyhow::anyhow!("File write failed: {}", e))?;
    }
    fs::write(&resolved, content)
        .await
        .map_err(|e| anyhow::anyhow!("File write failed: {}", e))?;

    Ok(json!({ "success": true }))
}

pub async fn workspace_read(config: &Config, params: &Value) -> anyhow::Result<Value> {
    let file_path = params
        .get("filePath")
        .and_then(|v| v.as_str())
        .ok_or_else(|| anyhow::anyhow!("filePath is required"))?;
    file_read(config, &json!({ "path": file_path })).await
}

pub async fn workspace_write(config: &Config, params: &Value) -> anyhow::Result<Value> {
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

    let resolved = resolve_workspace_path(config, file_path)?;
    if let Some(parent) = resolved.parent() {
        fs::create_dir_all(parent)
            .await
            .map_err(|e| anyhow::anyhow!("Workspace write failed: {}", e))?;
    }
    fs::write(&resolved, content)
        .await
        .map_err(|e| anyhow::anyhow!("Workspace write failed: {}", e))?;

    Ok(json!({ "success": true, "path": resolved.to_string_lossy() }))
}

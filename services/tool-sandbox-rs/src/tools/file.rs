
use reqwest::Client;
use serde_json::{json, Value};

use crate::config::Config;

/// Normalize a path without requiring it to exist (no canonicalize).

// Unified storage refactor: resolve_path and resolve_workspace_path are removed
// as all file operations now go through the file-service API using workspace-relative paths.

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

pub async fn file_read(
    client: &Client,
    config: &Config,
    params: &Value,
    user_id: Option<String>,
) -> anyhow::Result<Value> {
    if !config.enable_file_operations {
        anyhow::bail!("File operations are disabled");
    }
    let path = params
        .get("path")
        .and_then(|v| v.as_str())
        .ok_or_else(|| anyhow::anyhow!("path is required"))?
        .trim_start_matches('/');
    
    // Extract workspaceId/userId from params (injected by orchestrator)
    let workspace_id = params.get("workspaceId").and_then(|v| v.as_str()).or(user_id.as_deref());
    let user_id_val = params.get("userId").and_then(|v| v.as_str()).or(user_id.as_deref());

    let workspace_root = params.get("workspaceRoot").and_then(|v| v.as_str());
    let uid = workspace_id.ok_or_else(|| anyhow::anyhow!("workspaceId/userId is required for file access"))?;

    let resp = client
        .post(format!("{}/api/files/read", config.file_service_url))
        .json(&json!({ 
            "workspaceId": uid, 
            "userId": user_id_val,
            "workspaceRoot": workspace_root,
            "path": path, 
            "encoding": "utf-8" 
        }))
        .send()
        .await
        .map_err(|e| anyhow::anyhow!("File read from service failed: {}", e))?;

    if !resp.status().is_success() {
        let text = resp.text().await.unwrap_or_default();
        anyhow::bail!("File read failed: {}", text);
    }

    let data: Value = resp.json().await?;
    Ok(json!({
        "success": true,
        "content": data["content"],
        "path":    path,
        "mimeType": data["mimeType"]
    }))
}

/// pdf_read proxies to the document-service (which uses pdfplumber) to preserve
/// output parity with the TypeScript pdf-parse implementation.
/// pdf_read proxies to the document-service which now uses file-service.
pub async fn pdf_read(
    client: &Client,
    config: &Config,
    params: &Value,
    user_id: Option<String>,
) -> anyhow::Result<Value> {
    if !config.enable_file_operations {
        anyhow::bail!("File operations are disabled");
    }
    let path = params
        .get("path")
        .and_then(|v| v.as_str())
        .ok_or_else(|| anyhow::anyhow!("path is required"))?;

    let workspace_id = params.get("workspaceId").and_then(|v| v.as_str()).or(user_id.as_deref());
    let user_id_val = params.get("userId").and_then(|v| v.as_str()).or(user_id.as_deref());
    let workspace_root = params.get("workspaceRoot").and_then(|v| v.as_str());

    let resp = client
        .post(format!(
            "{}/api/documents/parse-path",
            config.document_service_url
        ))
        .json(&json!({ 
            "path": path, 
            "workspaceId": workspace_id,
            "userId": user_id_val,
            "workspaceRoot": workspace_root
        }))
        .send()
        .await
        .map_err(|e| anyhow::anyhow!("PDF read failed for \"{}\": {}", path, e))?;

    if !resp.status().is_success() {
        let text = resp.text().await.unwrap_or_default();
        anyhow::bail!("PDF read failed: {}", text);
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
    let path = params
        .get("path")
        .and_then(|v| v.as_str())
        .ok_or_else(|| anyhow::anyhow!("path is required"))?;
    let content = params
        .get("content")
        .and_then(|v| v.as_str())
        .ok_or_else(|| anyhow::anyhow!("content is required"))?;
    
    let workspace_id = params.get("workspaceId").and_then(|v| v.as_str()).or(user_id.as_deref());
    let _user_id_val = params.get("userId").and_then(|v| v.as_str()).or(user_id.as_deref());

    let uid = workspace_id.ok_or_else(|| anyhow::anyhow!("workspaceId/userId is required for file write"))?;

    // Use file-service upload API
    upload_to_cloud(client, config, path, path, content.as_bytes(), uid).await
}

pub async fn workspace_read(
    client: &Client,
    config: &Config,
    params: &Value,
    user_id: Option<String>,
) -> anyhow::Result<Value> {
    let file_path = params
        .get("filePath")
        .and_then(|v| v.as_str())
        .ok_or_else(|| anyhow::anyhow!("filePath is required"))?;
    let workspace_root = params.get("workspaceRoot");
    let mut read_params = json!({ "path": file_path });
    if let Some(root) = workspace_root {
        read_params["workspaceRoot"] = root.clone();
    }
    file_read(client, config, &read_params, user_id).await
}

/// Download a file from a URL (or accept pre-fetched base64 `content`) and optionally
/// save it to the workspace.
///
/// Inputs (one of `url` or `content` is required):
///   - `url`         — remote URL to fetch bytes from
///   - `content`     — base64-encoded bytes (skips HTTP fetch; used by gmail_download_attachment)
///   - `outputPath`  — workspace-relative or absolute path to save the file (optional)
///   - `filename`    — override the filename (optional)
///   - `headers`     — HTTP headers for authenticated URL downloads (optional)
///   - `contentType` — MIME type hint when using `content` input (optional)
///
/// Returns `{ success, localPath?, url, filename, contentType, size, content?, encoding? }`.
pub async fn download_file(
    client: &Client,
    config: &Config,
    params: &Value,
    user_id: Option<String>,
) -> anyhow::Result<Value> {
    use base64::Engine as _;

    let output_path = params.get("outputPath").and_then(|v| v.as_str());
    let custom_filename = params.get("filename").and_then(|v| v.as_str());

    // ── Branch: pre-fetched base64 content (no HTTP needed) ──────────────────
    if let Some(b64) = params.get("content").and_then(|v| v.as_str()) {
        let bytes = base64::engine::general_purpose::STANDARD
            .decode(b64)
            .map_err(|e| anyhow::anyhow!("Failed to decode base64 content: {}", e))?;

        let content_type = params
            .get("contentType")
            .and_then(|v| v.as_str())
            .unwrap_or("application/octet-stream")
            .to_string();

        let filename = custom_filename
            .map(|s| s.to_string())
            .unwrap_or_else(|| "attachment".to_string());

        let size = bytes.len();

        return save_or_encode(
            client,
            config,
            &bytes,
            output_path,
            &filename,
            &content_type,
            size,
            user_id,
            None,
        )
        .await;
    }

    // ── Branch: URL download ──────────────────────────────────────────────────
    let url = params
        .get("url")
        .and_then(|v| v.as_str())
        .ok_or_else(|| anyhow::anyhow!("Either url or content is required"))?;

    let mut req = client
        .get(url)
        .timeout(std::time::Duration::from_millis(60_000));

    if let Some(Value::Object(headers)) = params.get("headers") {
        for (k, v) in headers {
            if let Some(s) = v.as_str() {
                req = req.header(k.as_str(), s);
            }
        }
    }

    let resp = req
        .send()
        .await
        .map_err(|e| anyhow::anyhow!("Download failed: {}", e))?;

    if !resp.status().is_success() {
        anyhow::bail!("Download failed with status {}", resp.status());
    }

    let content_type = resp
        .headers()
        .get("content-type")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("application/octet-stream")
        .to_string();

    let filename = custom_filename.map(|s| s.to_string()).unwrap_or_else(|| {
        url.rsplit('/')
            .next()
            .and_then(|s| s.split('?').next())
            .filter(|s| !s.is_empty())
            .unwrap_or("download")
            .to_string()
    });

    let bytes = resp
        .bytes()
        .await
        .map_err(|e| anyhow::anyhow!("Failed to read response body: {}", e))?;

    let size = bytes.len();

    save_or_encode(
        client,
        config,
        &bytes,
        output_path,
        &filename,
        &content_type,
        size,
        user_id,
        Some(url),
    )
    .await
}

async fn save_or_encode(
    client: &Client,
    config: &Config,
    bytes: &[u8],
    output_path: Option<&str>,
    filename: &str,
    content_type: &str,
    size: usize,
    user_id: Option<String>,
    source_url: Option<&str>,
) -> anyhow::Result<Value> {
    use base64::Engine as _;

    if let Some(path_str) = output_path {
        if let Some(uid) = user_id {
            let cloud = upload_to_cloud(client, config, path_str, filename, bytes, &uid).await?;
            return Ok(json!({
                "success": true,
                "path":    cloud["path"],
                "url":     cloud["url"],
                "filename": filename,
                "contentType": content_type,
                "size":    size,
            }));
        }
    }

    let encoded = base64::engine::general_purpose::STANDARD.encode(bytes);
    Ok(json!({
        "success": true,
        "url": source_url,
        "filename": filename,
        "contentType": content_type,
        "size": size,
        "content": encoded,
        "encoding": "base64",
    }))
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

    let uid = user_id.ok_or_else(|| anyhow::anyhow!("userId is required for workspace write"))?;
    upload_to_cloud(client, config, file_path, file_path, content.as_bytes(), &uid).await
}

use base64::Engine;
use reqwest::Client;
use serde_json::{json, Value};

use crate::{config::Config, tools::file::{resolve_workspace_path, upload_to_cloud}};

// ─── GitHub ──────────────────────────────────────────────────────────────────

pub async fn github_api(client: &Client, params: &Value) -> anyhow::Result<Value> {
    let token = params
        .get("token")
        .and_then(|v| v.as_str())
        .ok_or_else(|| anyhow::anyhow!("token is required"))?;
    let endpoint = params
        .get("endpoint")
        .and_then(|v| v.as_str())
        .ok_or_else(|| anyhow::anyhow!("endpoint is required"))?;
    let method = params
        .get("method")
        .and_then(|v| v.as_str())
        .unwrap_or("GET")
        .parse::<reqwest::Method>()?;

    let url = if endpoint.starts_with("http") {
        endpoint.to_string()
    } else {
        format!(
            "https://api.github.com{}{}",
            if endpoint.starts_with('/') { "" } else { "/" },
            endpoint
        )
    };

    let mut req = client
        .request(method, &url)
        .header("Authorization", format!("Bearer {}", token))
        .header("Accept", "application/vnd.github.v3+json")
        .header("User-Agent", "MultiAgent-System")
        .timeout(std::time::Duration::from_millis(15_000));

    if let Some(body) = params.get("body") {
        req = req.json(body);
    }

    let resp = req
        .send()
        .await
        .map_err(|e| anyhow::anyhow!("GitHub API failed: {}", e))?;

    if !resp.status().is_success() {
        let err: Value = resp.json().await.unwrap_or(Value::Null);
        let msg = err
            .get("message")
            .and_then(|m| m.as_str())
            .unwrap_or("unknown error");
        anyhow::bail!("GitHub API failed: {}", msg);
    }

    resp.json::<Value>()
        .await
        .map_err(|e| anyhow::anyhow!("GitHub API failed: {}", e))
}

// ─── Slack ───────────────────────────────────────────────────────────────────

pub async fn slack_post_message(client: &Client, params: &Value) -> anyhow::Result<Value> {
    let token = params
        .get("token")
        .and_then(|v| v.as_str())
        .ok_or_else(|| anyhow::anyhow!("token is required"))?;
    let channel = params
        .get("channel")
        .and_then(|v| v.as_str())
        .ok_or_else(|| anyhow::anyhow!("channel is required"))?;
    let text = params
        .get("text")
        .and_then(|v| v.as_str())
        .ok_or_else(|| anyhow::anyhow!("text is required"))?;

    let resp: Value = client
        .post("https://slack.com/api/chat.postMessage")
        .header("Authorization", format!("Bearer {}", token))
        .json(&json!({ "channel": channel, "text": text }))
        .timeout(std::time::Duration::from_millis(10_000))
        .send()
        .await
        .map_err(|e| anyhow::anyhow!("Slack post failed: {}", e))?
        .json()
        .await
        .map_err(|e| anyhow::anyhow!("Slack post failed: {}", e))?;

    if resp.get("ok").and_then(|v| v.as_bool()) != Some(true) {
        let error = resp
            .get("error")
            .and_then(|v| v.as_str())
            .unwrap_or("unknown error");
        anyhow::bail!("Slack post failed: {}", error);
    }

    Ok(resp)
}

pub async fn whatsapp_send_message(client: &Client, params: &Value) -> anyhow::Result<Value> {
    let token = params
        .get("token")
        .and_then(|v| v.as_str())
        .ok_or_else(|| anyhow::anyhow!("token is required"))?;
    let phone_number_id = params
        .get("phoneNumberId")
        .and_then(|v| v.as_str())
        .ok_or_else(|| anyhow::anyhow!("phoneNumberId is required"))?;
    let to = params
        .get("to")
        .and_then(|v| v.as_str())
        .ok_or_else(|| anyhow::anyhow!("to is required"))?;
    let text = params
        .get("text")
        .and_then(|v| v.as_str())
        .ok_or_else(|| anyhow::anyhow!("text is required"))?;

    let resp: Value = client
        .post(format!(
            "https://graph.facebook.com/v17.0/{}/messages",
            phone_number_id
        ))
        .header("Authorization", format!("Bearer {}", token))
        .json(&json!({
            "messaging_product": "whatsapp",
            "to": to,
            "type": "text",
            "text": { "body": text },
        }))
        .timeout(std::time::Duration::from_millis(10_000))
        .send()
        .await
        .map_err(|e| anyhow::anyhow!("WhatsApp send failed: {}", e))?
        .json()
        .await
        .map_err(|e| anyhow::anyhow!("WhatsApp send failed: {}", e))?;

    Ok(resp)
}

// ─── Trello ──────────────────────────────────────────────────────────────────

pub async fn trello_create_card(client: &Client, params: &Value) -> anyhow::Result<Value> {
    let api_key = require_str(params, "apiKey")?;
    let token = require_str(params, "token")?;
    let list_id = require_str(params, "listId")?;
    let name = require_str(params, "name")?;

    let mut query = vec![
        ("key", api_key),
        ("token", token),
        ("idList", list_id),
        ("name", name),
    ];
    let desc;
    if let Some(d) = params.get("description").and_then(|v| v.as_str()) {
        desc = d.to_string();
        query.push(("desc", &desc));
    }

    let resp = client
        .post("https://api.trello.com/1/cards")
        .query(&query)
        .timeout(std::time::Duration::from_millis(10_000))
        .send()
        .await
        .map_err(|e| anyhow::anyhow!("Trello card creation failed: {}", e))?;

    if !resp.status().is_success() {
        let text = resp.text().await.unwrap_or_default();
        anyhow::bail!("Trello card creation failed: {}", text);
    }

    let card: Value = resp
        .json()
        .await
        .map_err(|e| anyhow::anyhow!("Trello card creation failed: {}", e))?;
    Ok(json!({ "success": true, "card": card }))
}

pub async fn trello_get_lists(client: &Client, params: &Value) -> anyhow::Result<Value> {
    let api_key = require_str(params, "apiKey")?;
    let token = require_str(params, "token")?;
    let board_id = require_str(params, "boardId")?;

    let lists: Value = client
        .get(format!(
            "https://api.trello.com/1/boards/{}/lists",
            board_id
        ))
        .query(&[("key", api_key), ("token", token)])
        .timeout(std::time::Duration::from_millis(10_000))
        .send()
        .await
        .map_err(|e| anyhow::anyhow!("Trello get lists failed: {}", e))?
        .json()
        .await
        .map_err(|e| anyhow::anyhow!("Trello get lists failed: {}", e))?;

    let mapped = lists
        .as_array()
        .map(|arr| {
            arr.iter()
                .map(|l| json!({ "id": l.get("id"), "name": l.get("name") }))
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();

    Ok(Value::Array(mapped))
}

pub async fn trello_move_card(client: &Client, params: &Value) -> anyhow::Result<Value> {
    let api_key = require_str(params, "apiKey")?;
    let token = require_str(params, "token")?;
    let list_id = require_str(params, "listId")?;

    let card_id = params.get("cardId").and_then(|v| v.as_str());
    let card_name = params.get("cardName").and_then(|v| v.as_str());

    if card_id.is_none() && card_name.is_none() {
        anyhow::bail!("Either cardId or cardName must be provided");
    }

    let final_card_id = if let Some(id) = card_id {
        id.to_string()
    } else {
        let board_id = params
            .get("boardId")
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow::anyhow!("boardId is required when using cardName"))?;
        let needle = card_name.unwrap().to_lowercase();

        let lists: Value = client
            .get(format!(
                "https://api.trello.com/1/boards/{}/lists",
                board_id
            ))
            .query(&[
                ("key", api_key),
                ("token", token),
                ("cards", "open"),
                ("fields", "id,name"),
            ])
            .timeout(std::time::Duration::from_millis(10_000))
            .send()
            .await?
            .json()
            .await?;

        let mut exact_id: Option<String> = None;
        let mut partial_id: Option<String> = None;

        'outer: for list in lists.as_array().unwrap_or(&vec![]) {
            let lid = list.get("id").and_then(|v| v.as_str()).unwrap_or("");
            let cards: Value = client
                .get(format!("https://api.trello.com/1/lists/{}/cards", lid))
                .query(&[("key", api_key), ("token", token), ("fields", "id,name")])
                .timeout(std::time::Duration::from_millis(10_000))
                .send()
                .await?
                .json()
                .await?;

            for card in cards.as_array().unwrap_or(&vec![]) {
                let c_name = card.get("name").and_then(|v| v.as_str()).unwrap_or("");
                let c_id = card.get("id").and_then(|v| v.as_str()).unwrap_or("");
                if c_name.to_lowercase() == needle {
                    exact_id = Some(c_id.to_string());
                    break 'outer;
                }
                if partial_id.is_none() && c_name.to_lowercase().contains(&needle) {
                    partial_id = Some(c_id.to_string());
                }
            }
        }

        exact_id
            .or(partial_id)
            .ok_or_else(|| anyhow::anyhow!("Card not found with name: \"{}\"", card_name.unwrap()))?
    };

    let resp = client
        .put(format!(
            "https://api.trello.com/1/cards/{}",
            final_card_id
        ))
        .query(&[("key", api_key), ("token", token), ("idList", list_id)])
        .timeout(std::time::Duration::from_millis(10_000))
        .send()
        .await
        .map_err(|e| anyhow::anyhow!("Trello move card failed: {}", e))?;

    if !resp.status().is_success() {
        let text = resp.text().await.unwrap_or_default();
        anyhow::bail!("Trello move card failed: {}", text);
    }

    let card: Value = resp
        .json()
        .await
        .map_err(|e| anyhow::anyhow!("Trello move card failed: {}", e))?;

    Ok(json!({
        "success": true,
        "card": {
            "id":     card.get("id"),
            "name":   card.get("name"),
            "idList": card.get("idList"),
        }
    }))
}

// ─── Document (proxy to document-service) ────────────────────────────────────

pub async fn document_read(
    client: &Client,
    config: &Config,
    params: &Value,
) -> anyhow::Result<Value> {
    if !config.enable_file_operations {
        anyhow::bail!("File operations are disabled");
    }
    let path = require_str(params, "path")?;
    let safe = resolve_workspace_path(config, path)?;
    let encoding = params
        .get("encoding")
        .and_then(|v| v.as_str())
        .unwrap_or("utf-8");

    let resp = client
        .post(format!(
            "{}/api/documents/parse-path",
            config.document_service_url
        ))
        .json(&json!({ "path": safe.to_string_lossy(), "encoding": encoding }))
        .send()
        .await
        .map_err(|e| anyhow::anyhow!("document_read failed for \"{}\": {}", path, e))?;

    if !resp.status().is_success() {
        let detail: Value = resp.json().await.unwrap_or(Value::Null);
        anyhow::bail!(
            "document_read failed for \"{}\": {}",
            path,
            detail
                .get("detail")
                .and_then(|v| v.as_str())
                .unwrap_or("unknown error")
        );
    }

    resp.json::<Value>()
        .await
        .map_err(|e| anyhow::anyhow!("document_read failed: {}", e))
}

pub async fn document_parse_image(
    client: &Client,
    config: &Config,
    params: &Value,
) -> anyhow::Result<Value> {
    if !config.enable_file_operations {
        anyhow::bail!("File operations are disabled");
    }
    let path = require_str(params, "path")?;
    let safe = resolve_workspace_path(config, path)?;

    let resp = client
        .post(format!(
            "{}/api/documents/parse-image-path",
            config.document_service_url
        ))
        .json(&json!({ "path": safe.to_string_lossy() }))
        .send()
        .await
        .map_err(|e| anyhow::anyhow!("document_parse_image failed for \"{}\": {}", path, e))?;

    if !resp.status().is_success() {
        let detail: Value = resp.json().await.unwrap_or(Value::Null);
        anyhow::bail!(
            "document_parse_image failed for \"{}\": {}",
            path,
            detail
                .get("detail")
                .and_then(|v| v.as_str())
                .unwrap_or("unknown error")
        );
    }

    resp.json::<Value>()
        .await
        .map_err(|e| anyhow::anyhow!("document_parse_image failed: {}", e))
}

pub async fn document_generate(
    client: &Client,
    config: &Config,
    params: &Value,
    user_id: Option<String>,
) -> anyhow::Result<Value> {
    if !config.enable_file_operations {
        anyhow::bail!("File operations are disabled");
    }
    let format = require_str(params, "format")?;
    let output_path = params.get("outputPath").and_then(|v| v.as_str());

    let body = json!({
        "format":   format,
        "title":    params.get("title").unwrap_or(&json!("Document")),
        "author":   params.get("author"),
        "sections": params.get("sections"),
        "table":    params.get("table"),
        "userId":   user_id,
    });

    let resp = client
        .post(format!("{}/api/documents/generate", config.document_service_url))
        .json(&body)
        .send()
        .await
        .map_err(|e| anyhow::anyhow!("document_generate failed: {}", e))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let text = resp.text().await.unwrap_or_default();
        anyhow::bail!("document_generate failed with status {}: {}", status, text);
    }

    let content_disposition = resp
        .headers()
        .get("content-disposition")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("")
        .to_string();
    let mime_type = resp
        .headers()
        .get("content-type")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("")
        .to_string();
    let filename = content_disposition
        .split("filename=")
        .nth(1)
        .map(|s| s.trim_matches('"').to_string())
        .unwrap_or_else(|| format!("document.{}", format));

    let bytes = resp
        .bytes()
        .await
        .map_err(|e| anyhow::anyhow!("document_generate failed: {}", e))?;

    // Write to local workspace if outputPath is inside workspace
    let local_path: Option<String> = if let Some(out_path) = output_path {
        match resolve_workspace_path(config, out_path) {
            Ok(safe) => {
                if let Some(parent) = safe.parent() {
                    tokio::fs::create_dir_all(parent)
                        .await
                        .map_err(|e| anyhow::anyhow!("document_generate failed: {}", e))?;
                }
                tokio::fs::write(&safe, &bytes)
                    .await
                    .map_err(|e| anyhow::anyhow!("document_generate failed: {}", e))?;
                Some(safe.to_string_lossy().to_string())
            }
            Err(_) => None,
        }
    } else {
        None
    };

    // Always upload to cloud when userId is available so the user gets a download URL
    if let Some(uid) = &user_id {
        let cloud_result =
            upload_to_cloud(client, config, &filename, &filename, &bytes, uid).await?;
        let url = cloud_result["url"].as_str().unwrap_or("").to_string();
        let file_id = cloud_result["fileId"].as_str().unwrap_or("").to_string();
        let stored_as = cloud_result["storedAs"].as_str().unwrap_or(&filename).to_string();
        return Ok(json!({
            "success":   true,
            "url":       url,
            "filename":  filename,
            "fileId":    file_id,
            "storedAs":  stored_as,
            "size":      bytes.len(),
            "type":      "cloud",
            "localPath": local_path,
        }));
    }

    // No userId: return local path if it was written, otherwise base64
    if let Some(path) = local_path {
        return Ok(json!({
            "success":  true,
            "path":     path,
            "filename": filename,
            "size":     bytes.len(),
            "type":     "local"
        }));
    }

    let b64 = base64::engine::general_purpose::STANDARD.encode(&bytes);
    Ok(json!({
        "success":  true,
        "filename": filename,
        "mimeType": mime_type,
        "size":     bytes.len(),
        "base64":   b64,
    }))
}

pub async fn document_delete(
    client: &Client,
    config: &Config,
    params: &Value,
) -> anyhow::Result<Value> {
    if !config.enable_file_operations {
        anyhow::bail!("File operations are disabled");
    }
    let path = require_str(params, "path")?;
    let safe = resolve_workspace_path(config, path)?;

    let resp = client
        .post(format!("{}/api/documents/delete", config.document_service_url))
        .json(&json!({ "path": safe.to_string_lossy() }))
        .send()
        .await
        .map_err(|e| anyhow::anyhow!("document_delete failed: {}", e))?;

    if !resp.status().is_success() {
        let text = resp.text().await.unwrap_or_default();
        anyhow::bail!("document_delete failed: {}", text);
    }

    Ok(resp.json().await?)
}

pub async fn document_write(
    client: &Client,
    config: &Config,
    params: &Value,
    user_id: Option<String>,
) -> anyhow::Result<Value> {
    if !config.enable_file_operations {
        anyhow::bail!("File operations are disabled");
    }
    let path = require_str(params, "path")?;
    let content = require_str(params, "content")?;
    let encoding = params
        .get("encoding")
        .and_then(|v| v.as_str())
        .unwrap_or("utf-8");

    let cwd = params
        .get("cwd")
        .and_then(|v| v.as_str());

    let resp = client
        .post(format!("{}/api/documents/write", config.document_service_url))
        .json(&json!({
            "path": path,
            "content": content,
            "encoding": encoding,
            "userId": user_id,
            "workspaceRoot": cwd
        }))
        .send()
        .await
        .map_err(|e| anyhow::anyhow!("document_write failed: {}", e))?;

    if !resp.status().is_success() {
        let text = resp.text().await.unwrap_or_default();
        anyhow::bail!("document_write failed: {}", text);
    }

    Ok(resp.json().await?)
}

// ─── helpers ─────────────────────────────────────────────────────────────────

fn require_str<'a>(params: &'a Value, key: &str) -> anyhow::Result<&'a str> {
    params
        .get(key)
        .and_then(|v| v.as_str())
        .ok_or_else(|| anyhow::anyhow!("{} is required", key))
}

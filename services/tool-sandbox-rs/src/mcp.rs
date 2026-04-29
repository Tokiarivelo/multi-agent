use std::collections::HashMap;
use std::sync::atomic::{AtomicI64, Ordering};

use reqwest::Client;
use serde_json::{json, Value};

static RPC_COUNTER: AtomicI64 = AtomicI64::new(1);

pub async fn execute_mcp(
    client: &Client,
    server_url: &str,
    tool_name: &str,
    parameters: Value,
    headers: &HashMap<String, String>,
    timeout_ms: u64,
) -> anyhow::Result<Value> {
    let id = RPC_COUNTER.fetch_add(1, Ordering::SeqCst);

    let request = json!({
        "jsonrpc": "2.0",
        "id": id,
        "method": "tools/call",
        "params": { "name": tool_name, "arguments": parameters },
    });

    let mut req = client
        .post(server_url)
        .json(&request)
        .timeout(std::time::Duration::from_millis(timeout_ms));

    for (k, v) in headers {
        req = req.header(k.as_str(), v.as_str());
    }

    let rpc: Value = req
        .send()
        .await
        .map_err(|e| anyhow::anyhow!("MCP execution failed: {}", e))?
        .json()
        .await
        .map_err(|e| anyhow::anyhow!("MCP execution failed: {}", e))?;

    if let Some(error) = rpc.get("error") {
        let code = error.get("code").and_then(|c| c.as_i64()).unwrap_or(0);
        let msg = error
            .get("message")
            .and_then(|m| m.as_str())
            .unwrap_or("unknown error");
        anyhow::bail!("MCP error {}: {}", code, msg);
    }

    let result = match rpc.get("result") {
        None | Some(Value::Null) => return Ok(Value::Null),
        Some(r) => r,
    };

    // Unwrap content array (standard MCP text content blocks)
    if let Some(content) = result.get("content").and_then(|c| c.as_array()) {
        let texts: Vec<&str> = content
            .iter()
            .filter(|c| c.get("type").and_then(|t| t.as_str()) == Some("text"))
            .filter_map(|c| c.get("text").and_then(|t| t.as_str()))
            .collect();

        return match texts.len() {
            1 => Ok(Value::String(texts[0].to_string())),
            n if n > 1 => Ok(Value::Array(
                texts.iter().map(|t| Value::String(t.to_string())).collect(),
            )),
            _ => Ok(result.clone()),
        };
    }

    Ok(result.clone())
}

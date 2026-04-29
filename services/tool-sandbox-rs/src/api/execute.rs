use std::collections::HashMap;
use std::time::Instant;

use axum::{extract::State, Json};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use utoipa::ToSchema;

use crate::{db, mcp, sandbox, tools, AppState};

/// Request body for POST /api/tools/execute.
///
/// Mirrors the TypeScript `ExecuteToolUseCase` input shape exactly.
#[derive(Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ExecuteRequest {
    /// Database ID of the tool to execute (use toolId OR toolName).
    pub tool_id: Option<String>,
    /// Name of the tool to execute (use toolId OR toolName).
    pub tool_name: Option<String>,
    /// JSON parameters passed to the tool's execute function.
    pub parameters: Value,
    /// Wall-clock timeout in milliseconds (overrides server default).
    pub timeout: Option<u64>,
    /// Authenticated user ID (injected by gateway middleware).
    pub user_id: Option<String>,
    /// Working directory injected into shell/git tool parameters.
    pub cwd: Option<String>,
}

/// Response body for POST /api/tools/execute.
///
/// Always HTTP 200 — the `success` field distinguishes pass from fail.
#[derive(Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ExecuteResponse {
    /// `true` when the tool returned a result, `false` on error.
    pub success: bool,
    /// Tool output (present when success = true).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<Value>,
    /// Error message (present when success = false).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    /// Wall-clock execution time in milliseconds.
    pub execution_time: u64,
}

/// Mirrors TypeScript's execute-tool.use-case.ts — always returns 200 with
/// `{ success, data?, error?, executionTime }`, even on validation failures.
///
/// # POST /api/tools/execute
#[utoipa::path(
    post,
    path = "/api/tools/execute",
    tag = "tools",
    request_body = ExecuteRequest,
    responses(
        (status = 200, description = "Tool executed (check `success` field)", body = ExecuteResponse),
    ),
    security(
        ("BearerAuth" = [])
    )
)]
pub async fn execute_tool(
    State(state): State<AppState>,
    Json(req): Json<ExecuteRequest>,
) -> Json<ExecuteResponse> {
    let start = Instant::now();

    let result = run(&state, &req).await;
    let execution_time = start.elapsed().as_millis() as u64;

    match result {
        Ok(data) => Json(ExecuteResponse {
            success: true,
            data: Some(data),
            error: None,
            execution_time,
        }),
        Err(e) => Json(ExecuteResponse {
            success: false,
            data: None,
            error: Some(e.to_string()),
            execution_time,
        }),
    }
}

async fn run(state: &AppState, req: &ExecuteRequest) -> anyhow::Result<Value> {
    if req.tool_id.is_none() && req.tool_name.is_none() {
        anyhow::bail!("Either toolId or toolName must be provided");
    }

    let tool = if let Some(ref id) = req.tool_id {
        db::find_tool_by_id(&state.pool, id).await?
    } else {
        db::find_tool_by_name(&state.pool, req.tool_name.as_ref().unwrap()).await?
    }
    .ok_or_else(|| anyhow::anyhow!("Tool not found"))?;

    let timeout_ms = req
        .timeout
        .unwrap_or(state.config.tool_execution_timeout_ms);

    // Inject cwd into parameters when caller provided it but params don't already have it
    let mut params = req.parameters.clone();
    if let (Some(cwd), Some(obj)) = (&req.cwd, params.as_object_mut()) {
        obj.entry("cwd").or_insert_with(|| Value::String(cwd.clone()));
    }

    // ── MCP ──────────────────────────────────────────────────────────────────
    if tool.category == "MCP" {
        let mcp_cfg = tool
            .mcp_config
            .as_ref()
            .ok_or_else(|| anyhow::anyhow!("MCP tool missing mcpConfig"))?;

        // Inject owner/repo from repoFullName
        if let Some(ref full_name) = tool.repo_full_name {
            if let Some((owner, repo)) = full_name.split_once('/') {
                if let Some(obj) = params.as_object_mut() {
                    obj.insert("owner".into(), Value::String(owner.to_string()));
                    obj.insert("repo".into(), Value::String(repo.to_string()));
                }
            }
        }

        // Build extra headers
        let mut headers: HashMap<String, String> = mcp_cfg
            .get("headers")
            .and_then(|h| h.as_object())
            .map(|h| {
                h.iter()
                    .filter_map(|(k, v)| v.as_str().map(|s| (k.clone(), s.to_string())))
                    .collect()
            })
            .unwrap_or_default();

        // Inject GitHub OAuth token when the tool is repo-scoped
        if tool.repo_full_name.is_some() {
            if let Some(ref user_id) = req.user_id {
                match db::find_github_token(&state.pool, user_id).await? {
                    None => return Ok(Value::String("__GITHUB_AUTH_REQUIRED__".into())),
                    Some(t) => {
                        headers.insert("x-github-token".into(), t);
                    }
                }
            }
        }

        let server_url = mcp_cfg
            .get("serverUrl")
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow::anyhow!("MCP tool missing serverUrl"))?;
        let tool_name = mcp_cfg
            .get("toolName")
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow::anyhow!("MCP tool missing toolName"))?;

        return match mcp::execute_mcp(
            &state.http_client,
            server_url,
            tool_name,
            params,
            &headers,
            timeout_ms,
        )
        .await
        {
            Ok(r) => Ok(r),
            Err(e) => {
                if tool.repo_full_name.is_some() && is_github_auth_error(&e.to_string()) {
                    if let Some(ref uid) = req.user_id {
                        let _ = db::clear_github_token(&state.pool, uid).await;
                    }
                    return Ok(Value::String("__GITHUB_AUTH_REQUIRED__".into()));
                }
                Err(e)
            }
        };
    }

    // ── Built-in ─────────────────────────────────────────────────────────────
    if tool.is_built_in {
        return tools::dispatch_builtin(
            &state.http_client,
            &state.config,
            &tool.name,
            params,
            timeout_ms,
        )
        .await;
    }

    // ── Custom code (B2 + B3) ────────────────────────────────────────────────
    if let Some(code) = tool.code {
        if code.starts_with("AGFzb") {
            return sandbox::wasmtime_runner::execute_wasm(code, params, timeout_ms).await;
        }
        return sandbox::runner::execute_js(code, params, timeout_ms).await;
    }

    anyhow::bail!("Tool has no executable code");
}

fn is_github_auth_error(msg: &str) -> bool {
    let lower = msg.to_lowercase();
    lower.contains("bad credentials")
        || lower.contains("[http 401]")
        || lower.contains("[http 403]")
        || lower.contains("unauthorized")
        || lower.contains("token has been revoked")
        || lower.contains("token is expired")
        || lower.contains("requires authentication")
        || lower.contains("mcp error -32603:")
            && lower.ends_with("mcp error -32603:")
        || (lower.contains("github") && lower.contains("403"))
}

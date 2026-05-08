use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use utoipa::{IntoParams, ToSchema};

use crate::{db, AppState};

// ── Response type ─────────────────────────────────────────────────────────────

#[derive(Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ToolResponse {
    pub id: String,
    pub name: String,
    pub description: String,
    pub category: String,
    pub parameters: Value,
    pub code: Option<String>,
    pub icon: Option<String>,
    pub is_built_in: bool,
    pub mcp_config: Option<Value>,
    pub repo_full_name: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

impl From<db::FullToolRow> for ToolResponse {
    fn from(r: db::FullToolRow) -> Self {
        Self {
            id: r.id,
            name: r.name,
            description: r.description,
            category: r.category,
            parameters: r.parameters,
            code: r.code,
            icon: r.icon,
            is_built_in: r.is_built_in,
            mcp_config: r.mcp_config,
            repo_full_name: r.repo_full_name,
            created_at: r.created_at,
            updated_at: r.updated_at,
        }
    }
}

#[derive(Serialize, ToSchema)]
pub struct PaginatedResponse {
    pub data: Vec<ToolResponse>,
    pub total: i64,
    pub page: u32,
    pub limit: u32,
    #[serde(rename = "totalPages")]
    pub total_pages: u32,
}

// ── Request types ─────────────────────────────────────────────────────────────

#[derive(Deserialize, IntoParams)]
#[serde(rename_all = "camelCase")]
pub struct ListQuery {
    /// Page number (1-based, default 1).
    pub page: Option<u32>,
    /// Number of items per page (default 20, max 100).
    pub limit: Option<u32>,
    /// Alias for `limit`.
    pub page_size: Option<u32>,
    /// Filter by category (e.g. "MCP", "CUSTOM", "BUILT_IN").
    pub category: Option<String>,
    /// Filter to built-in tools only.
    pub is_built_in: Option<bool>,
}

#[derive(Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CreateRequest {
    pub name: String,
    pub description: String,
    pub category: String,
    pub parameters: Value,
    pub code: Option<String>,
    #[serde(default)]
    pub is_built_in: bool,
    pub icon: Option<String>,
    pub mcp_config: Option<Value>,
    pub repo_full_name: Option<String>,
}

/// Partial update — omitted fields are left unchanged; `null` clears nullable fields.
#[derive(Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct UpdateRequest {
    pub name: Option<String>,
    pub description: Option<String>,
    pub category: Option<String>,
    pub parameters: Option<Value>,
    pub code: Option<Value>,
    pub icon: Option<Value>,
    pub mcp_config: Option<Value>,
    pub repo_full_name: Option<Value>,
}

// ── Handlers ──────────────────────────────────────────────────────────────────

/// List tools (paginated)
#[utoipa::path(
    get,
    path = "/api/tools",
    tag = "tools",
    params(ListQuery),
    responses(
        (status = 200, description = "Paginated list of tools", body = PaginatedResponse),
    ),
    security(("BearerAuth" = []))
)]
pub async fn list(
    State(state): State<AppState>,
    Query(q): Query<ListQuery>,
) -> Result<Json<PaginatedResponse>, (StatusCode, String)> {
    let page = q.page.unwrap_or(1).max(1);
    let limit = q.limit.or(q.page_size).unwrap_or(20).clamp(1, 100);

    let (rows, total) = db::list_tools(
        &state.pool,
        page,
        limit,
        q.category.as_deref(),
        q.is_built_in,
    )
    .await
    .map_err(internal)?;

    let total_pages = ((total as f64) / (limit as f64)).ceil() as u32;
    Ok(Json(PaginatedResponse {
        data: rows.into_iter().map(ToolResponse::from).collect(),
        total,
        page,
        limit,
        total_pages,
    }))
}

/// Get a single tool by ID
#[utoipa::path(
    get,
    path = "/api/tools/{id}",
    tag = "tools",
    params(("id" = String, Path, description = "Tool UUID")),
    responses(
        (status = 200, description = "Tool found", body = ToolResponse),
        (status = 404, description = "Tool not found"),
    ),
    security(("BearerAuth" = []))
)]
pub async fn get_by_id(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<ToolResponse>, (StatusCode, String)> {
    db::get_full_tool(&state.pool, &id)
        .await
        .map_err(internal)?
        .map(|r| Json(ToolResponse::from(r)))
        .ok_or_else(|| (StatusCode::NOT_FOUND, format!("Tool {id} not found")))
}

/// Create a new tool
#[utoipa::path(
    post,
    path = "/api/tools",
    tag = "tools",
    request_body = CreateRequest,
    responses(
        (status = 201, description = "Tool created", body = ToolResponse),
        (status = 400, description = "Validation error"),
    ),
    security(("BearerAuth" = []))
)]
pub async fn create(
    State(state): State<AppState>,
    Json(req): Json<CreateRequest>,
) -> Result<(StatusCode, Json<ToolResponse>), (StatusCode, String)> {
    let tool = db::create_tool(
        &state.pool,
        db::CreateToolInput {
            name: req.name,
            description: req.description,
            category: req.category,
            parameters: req.parameters,
            code: req.code,
            is_built_in: req.is_built_in,
            icon: req.icon,
            mcp_config: req.mcp_config,
            repo_full_name: req.repo_full_name,
        },
    )
    .await
    .map_err(internal)?;

    Ok((StatusCode::CREATED, Json(ToolResponse::from(tool))))
}

/// Update a tool (PUT or PATCH — all fields optional)
#[utoipa::path(
    put,
    path = "/api/tools/{id}",
    tag = "tools",
    params(("id" = String, Path, description = "Tool UUID")),
    request_body = UpdateRequest,
    responses(
        (status = 200, description = "Tool updated", body = ToolResponse),
        (status = 404, description = "Tool not found"),
    ),
    security(("BearerAuth" = []))
)]
pub async fn update(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(req): Json<UpdateRequest>,
) -> Result<Json<ToolResponse>, (StatusCode, String)> {
    // Fetch current to allow partial updates
    let current = db::get_full_tool(&state.pool, &id)
        .await
        .map_err(internal)?
        .ok_or_else(|| (StatusCode::NOT_FOUND, format!("Tool {id} not found")))?;

    let values = db::ToolUpdateValues {
        name: req.name.unwrap_or(current.name),
        description: req.description.unwrap_or(current.description),
        category: req.category.unwrap_or(current.category),
        parameters: req.parameters.unwrap_or(current.parameters),
        is_built_in: current.is_built_in,
        code: merge_nullable(req.code, current.code),
        icon: merge_nullable(req.icon, current.icon),
        mcp_config: merge_nullable_json(req.mcp_config, current.mcp_config),
        repo_full_name: merge_nullable(req.repo_full_name, current.repo_full_name),
    };

    let updated = db::update_tool(&state.pool, &id, values)
        .await
        .map_err(internal)?
        .ok_or_else(|| (StatusCode::NOT_FOUND, format!("Tool {id} not found")))?;

    Ok(Json(ToolResponse::from(updated)))
}

/// Delete a tool
#[utoipa::path(
    delete,
    path = "/api/tools/{id}",
    tag = "tools",
    params(("id" = String, Path, description = "Tool UUID")),
    responses(
        (status = 204, description = "Deleted"),
        (status = 404, description = "Tool not found"),
    ),
    security(("BearerAuth" = []))
)]
pub async fn delete(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<StatusCode, (StatusCode, String)> {
    let found = db::delete_tool(&state.pool, &id)
        .await
        .map_err(internal)?;
    if found {
        Ok(StatusCode::NO_CONTENT)
    } else {
        Err((StatusCode::NOT_FOUND, format!("Tool {id} not found")))
    }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

fn internal(e: anyhow::Error) -> (StatusCode, String) {
    tracing::error!("{e}");
    (StatusCode::INTERNAL_SERVER_ERROR, e.to_string())
}

/// `None` = don't change; `Some(Value::Null)` = clear; `Some(Value::String(s))` = set.
fn merge_nullable(patch: Option<Value>, current: Option<String>) -> Option<String> {
    match patch {
        None => current,
        Some(Value::Null) => None,
        Some(v) => v.as_str().map(|s| s.to_string()).or(current),
    }
}

fn merge_nullable_json(patch: Option<Value>, current: Option<Value>) -> Option<Value> {
    match patch {
        None => current,
        Some(Value::Null) => None,
        Some(v) => Some(v),
    }
}

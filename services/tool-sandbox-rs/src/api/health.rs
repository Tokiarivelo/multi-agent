use axum::Json;
use serde_json::{json, Value};

/// Health godoc
///
/// Returns `{"status":"ok"}` when the service is alive.
#[utoipa::path(
    get,
    path = "/health",
    tag = "health",
    responses(
        (status = 200, description = "Service is healthy", body = Value,
         example = json!({"status": "ok"}))
    )
)]
pub async fn health() -> Json<Value> {
    Json(json!({ "status": "ok" }))
}

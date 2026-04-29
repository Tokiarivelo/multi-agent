use axum::{
    extract::{Multipart, State},
    Json,
};
use base64::prelude::*;
use serde::Serialize;
use utoipa::ToSchema;

use crate::AppState;

#[derive(Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct UploadWasmResponse {
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

/// Uploads a WASM binary for a tool and stores it as base64 in the `code` column.
///
/// The WASM file must start with the standard `\0asm` magic header.
///
/// # POST /api/tools/upload-wasm
#[utoipa::path(
    post,
    path = "/api/tools/upload-wasm",
    tag = "tools",
    responses(
        (status = 200, description = "WASM uploaded successfully", body = UploadWasmResponse),
        (status = 400, description = "Bad Request (invalid WASM or missing fields)", body = UploadWasmResponse),
        (status = 404, description = "Tool not found", body = UploadWasmResponse)
    ),
    security(
        ("BearerAuth" = [])
    )
)]
pub async fn upload_wasm(
    State(state): State<AppState>,
    mut multipart: Multipart,
) -> Json<UploadWasmResponse> {
    let mut tool_id: Option<String> = None;
    let mut wasm_data: Option<Vec<u8>> = None;

    while let Ok(Some(field)) = multipart.next_field().await {
        let name = field.name().unwrap_or("").to_string();
        if name == "toolId" {
            if let Ok(text) = field.text().await {
                tool_id = Some(text);
            }
        } else if name == "file" {
            if let Ok(bytes) = field.bytes().await {
                wasm_data = Some(bytes.to_vec());
            }
        }
    }

    let tool_id = match tool_id {
        Some(id) => id,
        None => {
            return Json(UploadWasmResponse {
                success: false,
                tool_id: None,
                error: Some("Missing toolId in form data".to_string()),
            })
        }
    };

    let wasm_data = match wasm_data {
        Some(data) => data,
        None => {
            return Json(UploadWasmResponse {
                success: false,
                tool_id: Some(tool_id),
                error: Some("Missing file in form data".to_string()),
            })
        }
    };

    // Verify WASM magic header: \0asm (0x00, 0x61, 0x73, 0x6d)
    if wasm_data.len() < 4 || &wasm_data[0..4] != b"\0asm" {
        return Json(UploadWasmResponse {
            success: false,
            tool_id: Some(tool_id),
            error: Some("Invalid WASM binary: missing \\0asm magic header".to_string()),
        });
    }

    let base64_code = BASE64_STANDARD.encode(&wasm_data);

    // Save to the database
    let updated = sqlx::query(
        r#"
        UPDATE tools
        SET code = $1, "updatedAt" = NOW()
        WHERE id = $2
        "#
    )
    .bind(base64_code)
    .bind(tool_id.clone())
    .execute(&state.pool)
    .await;

    match updated {
        Ok(result) if result.rows_affected() > 0 => Json(UploadWasmResponse {
            success: true,
            tool_id: Some(tool_id),
            error: None,
        }),
        Ok(_) => Json(UploadWasmResponse {
            success: false,
            tool_id: Some(tool_id),
            error: Some("Tool not found".to_string()),
        }),
        Err(e) => Json(UploadWasmResponse {
            success: false,
            tool_id: Some(tool_id),
            error: Some(format!("Database error: {}", e)),
        }),
    }
}

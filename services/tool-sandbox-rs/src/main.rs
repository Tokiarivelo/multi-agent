mod api;
mod config;
mod db;
mod mcp;
mod sandbox;
mod tools;

use std::sync::Arc;

use axum::{
    routing::{get, post},
    Router,
};
use sqlx::postgres::PgPoolOptions;
use tower_http::cors::CorsLayer;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};
use utoipa::OpenApi;
use utoipa_swagger_ui::SwaggerUi;

use config::Config;

// ── OpenAPI root descriptor ───────────────────────────────────────────────────

/// OpenAPI specification for the Rust tool-sandbox service.
///
/// Generated at startup and served at `/docs/openapi.json`.
/// Swagger UI is available at `/docs/`.
#[derive(OpenApi)]
#[openapi(
    info(
        title = "Tool Sandbox API",
        version = "1.0.0",
        description = "Rust/Axum service that executes built-in tools, custom JS code (QuickJS sandbox), and MCP tools. Drop-in replacement for the TypeScript tool-service.",
        contact(name = "Multi-Agent Platform", url = "https://github.com/multi-agent"),
        license(name = "MIT")
    ),
    paths(
        api::health::health,
        api::execute::execute_tool,
        api::wasm::upload_wasm,
    ),
    components(
        schemas(
            api::execute::ExecuteRequest,
            api::execute::ExecuteResponse,
            api::wasm::UploadWasmResponse,
        )
    ),
    tags(
        (name = "health", description = "Liveness probe"),
        (name = "tools",  description = "Tool execution — built-in, custom JS, and MCP"),
    ),
    security(
        ("BearerAuth" = [])
    )
)]
struct ApiDoc;

// ── Application state ─────────────────────────────────────────────────────────

#[derive(Clone)]
pub struct AppState {
    pub pool: sqlx::PgPool,
    pub config: Arc<Config>,
    pub http_client: reqwest::Client,
}

// ── Entry point ───────────────────────────────────────────────────────────────

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "info".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    let config = Config::from_env()?;
    let port = config.port;

    let pool = PgPoolOptions::new()
        .max_connections(10)
        .connect(&config.database_url)
        .await?;

    let http_client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(60))
        .build()?;

    let state = AppState {
        pool,
        config: Arc::new(config),
        http_client,
    };

    let app = Router::new()
        .route("/health", get(api::health::health))
        .route("/api/tools/execute", post(api::execute::execute_tool))
        .route("/api/tools/upload-wasm", post(api::wasm::upload_wasm))
        // ── CRUD ─────────────────────────────────────────────────────────────
        .route("/api/tools", get(api::crud::list).post(api::crud::create))
        .route(
            "/api/tools/:id",
            get(api::crud::get_by_id)
                .put(api::crud::update)
                .patch(api::crud::update)
                .delete(api::crud::delete),
        )
        // ── Swagger UI ────────────────────────────────────────────────────────
        // Serves the interactive API explorer at http://localhost:3030/docs/
        .merge(SwaggerUi::new("/docs").url("/docs/openapi.json", ApiDoc::openapi()))
        .layer(CorsLayer::permissive())
        .with_state(state);

    let addr = format!("0.0.0.0:{}", port);
    tracing::info!("tool-sandbox-rs listening on {} | Swagger UI → http://{}/docs/", addr, addr);

    let listener = tokio::net::TcpListener::bind(&addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}

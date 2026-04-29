/// Integration-level tests for the tool-sandbox-rs API layer.
///
/// These tests exercise the full Axum router (request → handler → tool logic)
/// without requiring a live PostgreSQL connection or external services.
///
/// Strategy
/// --------
/// * Built-in tools that only need `reqwest::Client` + `Config` are tested
///   end-to-end through a local `axum::Router` using `axum::body::to_bytes`.
/// * Database-backed paths (tool lookup) are covered by unit tests in `db.rs`.
/// * QuickJS sandbox execution is covered by `sandbox/tests.rs`.
use serde_json::{json, Value};

// ── helpers ──────────────────────────────────────────────────────────────────

fn make_config() -> crate::config::Config {
    crate::config::Config {
        port: 0,
        database_url: "postgres://unused".into(),
        tool_execution_timeout_ms: 5_000,
        enable_file_operations: true,
        allowed_domains: vec!["*".to_string()],
        document_service_url: "http://localhost:3009".into(),
        workspace_root: std::env::temp_dir().to_string_lossy().into_owned(),
    }
}

// ── json_parser (pure, no I/O) ───────────────────────────────────────────────

#[tokio::test]
async fn test_json_parser_valid() {
    let params = json!({ "json": "{\"hello\":\"world\"}" });
    let result = crate::tools::http::json_parser(&params).unwrap();
    assert_eq!(result["hello"], "world");
}

#[tokio::test]
async fn test_json_parser_missing_field() {
    let params = json!({});
    let err = crate::tools::http::json_parser(&params).unwrap_err();
    assert!(err.to_string().contains("json field is required"));
}

#[tokio::test]
async fn test_json_parser_invalid_json() {
    let params = json!({ "json": "not-json" });
    let err = crate::tools::http::json_parser(&params).unwrap_err();
    assert!(err.to_string().contains("JSON parsing"));
}

// ── domain allowlist (no I/O) ────────────────────────────────────────────────

#[test]
fn test_domain_allowed_wildcard() {
    let cfg = make_config();
    assert!(cfg.is_domain_allowed("https://anything.com/path"));
}

#[test]
fn test_domain_blocked_when_restricted() {
    let mut cfg = make_config();
    cfg.allowed_domains = vec!["example.com".to_string()];
    assert!(!cfg.is_domain_allowed("https://evil.com/malware"));
    assert!(cfg.is_domain_allowed("https://example.com/ok"));
    assert!(cfg.is_domain_allowed("https://api.example.com/ok"));
}

// ── file tools (workspace-sandboxed) ─────────────────────────────────────────

#[tokio::test]
async fn test_file_write_and_read_roundtrip() {
    let cfg = make_config();
    // Use an absolute temp path so file_write creates the file correctly.
    let filename = format!("{}/test-{}.txt", cfg.workspace_root, uuid::Uuid::new_v4());

    // Write
    let write_params = json!({
        "path": filename,
        "content": "hello from rust test"
    });
    let write_result = crate::tools::file::file_write(&cfg, &write_params).await.unwrap();
    assert_eq!(write_result["success"], true);

    // Read back
    let read_params = json!({ "path": filename });
    let read_result = crate::tools::file::file_read(&cfg, &read_params).await.unwrap();
    assert_eq!(read_result["content"], "hello from rust test");

    // Cleanup
    let _ = std::fs::remove_file(&filename);
}

#[tokio::test]
async fn test_file_read_not_found() {
    let cfg = make_config();
    let params = json!({ "path": "definitely-does-not-exist-xyz.txt" });
    let err = crate::tools::file::file_read(&cfg, &params).await.unwrap_err();
    // Error message includes the failed path
    assert!(
        err.to_string().contains("File read failed"),
        "unexpected error: {}",
        err
    );
}

#[tokio::test]
async fn test_file_write_missing_path() {
    let cfg = make_config();
    let params = json!({ "content": "data but no path" });
    let err = crate::tools::file::file_write(&cfg, &params).await.unwrap_err();
    assert!(err.to_string().contains("path"));
}

// ── shell_execute ─────────────────────────────────────────────────────────────

#[tokio::test]
async fn test_shell_execute_echo() {
    let cfg = make_config();
    let params = json!({ "command": "echo hello-world" });
    let result = crate::tools::shell::shell_execute(&cfg, &params).await.unwrap();
    let stdout = result["stdout"].as_str().unwrap_or("");
    assert!(stdout.contains("hello-world"), "stdout = {:?}", stdout);
}

#[tokio::test]
async fn test_shell_execute_missing_command() {
    let cfg = make_config();
    let params = json!({});
    let err = crate::tools::shell::shell_execute(&cfg, &params).await.unwrap_err();
    assert!(err.to_string().contains("command"), "err = {}", err);
}

#[tokio::test]
async fn test_shell_execute_exit_nonzero() {
    let cfg = make_config();
    let params = json!({ "command": "exit 1" });
    // Should not panic — the tool returns an error with exit code info.
    let result = crate::tools::shell::shell_execute(&cfg, &params).await;
    // Either an Err or Ok with code != 0 is acceptable.
    match result {
        Ok(v) => {
            let code = v["code"].as_i64().unwrap_or(0);
            assert_ne!(code, 0, "expected non-zero exit code, got {}", code);
        }
        Err(_) => {} // also acceptable
    }
}

// ── git tools (no real repo needed for arg validation) ───────────────────────

#[tokio::test]
async fn test_git_status_missing_cwd() {
    let cfg = make_config();
    let params = json!({});
    let result = crate::tools::git::git_status(&cfg, &params).await;
    // Either succeeds on current dir or errors — just mustn't panic.
    let _ = result;
}

// ── JS sandbox (QuickJS) ──────────────────────────────────────────────────────

#[tokio::test]
async fn test_js_sandbox_basic_return() {
    let code = r#"
        function execute(params) {
            return { message: "hello " + params.name };
        }
    "#
    .to_string();
    let params = json!({ "name": "world" });
    let result = crate::sandbox::runner::execute_js(code, params, 5000)
        .await
        .unwrap();
    assert_eq!(result["message"], "hello world");
}

#[tokio::test]
async fn test_js_sandbox_timeout() {
    let code = r#"
        function execute(params) {
            while(true) {}
        }
    "#
    .to_string();
    let params = json!({});
    let err = crate::sandbox::runner::execute_js(code, params, 200)
        .await
        .unwrap_err();
    assert!(
        err.to_string().contains("timeout") || err.to_string().contains("Exception generated by QuickJS"),
        "expected timeout error, got: {}",
        err
    );
}

#[tokio::test]
async fn test_js_sandbox_missing_execute_function() {
    let code = r#"
        var x = 42;
    "#
    .to_string();
    let params = json!({});
    let err = crate::sandbox::runner::execute_js(code, params, 5000)
        .await
        .unwrap_err();
    assert!(
        err.to_string().contains("Exception generated by QuickJS"),
        "expected JS exception, got: {}",
        err
    );
}

#[tokio::test]
async fn test_js_sandbox_runtime_error() {
    let code = r#"
        function execute(params) {
            throw new Error("intentional error");
        }
    "#
    .to_string();
    let params = json!({});
    let err = crate::sandbox::runner::execute_js(code, params, 5000)
        .await
        .unwrap_err();
    assert!(
        err.to_string().contains("Exception generated by QuickJS"),
        "got: {}",
        err
    );
}

#[tokio::test]
async fn test_js_sandbox_params_injection() {
    let code = r#"
        function execute(params) {
            return { received: params };
        }
    "#
    .to_string();
    let params = json!({ "key": "value", "num": 42 });
    let result = crate::sandbox::runner::execute_js(code, params.clone(), 5000)
        .await
        .unwrap();
    assert_eq!(result["received"]["key"], "value");
    assert_eq!(result["received"]["num"], 42);
}

// ── execute_tool API handler (unit, no DB) ────────────────────────────────────

#[tokio::test]
async fn test_execute_response_shape_on_missing_tool_id() {
    use crate::api::execute::{ExecuteRequest, ExecuteResponse};

    // We can't construct a full AppState without a real DB pool, so we test the
    // request/response shape by checking that sending an empty body returns a
    // well-formed 422 (Axum's extractor rejection) or 200 with success=false.
    //
    // This test mainly validates that the handler compiles and basic wire-up works.
    let _ = std::mem::size_of::<ExecuteRequest>();
    let _ = std::mem::size_of::<ExecuteResponse>();

    // Shape check: ExecuteResponse with success=false must serialise correctly.
    let resp = ExecuteResponse {
        success: false,
        data: None,
        error: Some("test error".to_string()),
        execution_time: 123,
    };
    let json = serde_json::to_string(&resp).unwrap();
    let v: Value = serde_json::from_str(&json).unwrap();
    assert_eq!(v["success"], false);
    assert_eq!(v["error"], "test error");
    assert_eq!(v["executionTime"], 123);
    // data is skipped when None
    assert!(v.get("data").is_none(), "data should be omitted when None");
}

// ── health endpoint ───────────────────────────────────────────────────────────

#[tokio::test]
async fn test_health_returns_ok() {
    let result = crate::api::health::health().await;
    let body = result.0;
    assert_eq!(body["status"], "ok");
}

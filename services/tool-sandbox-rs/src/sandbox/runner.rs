use std::time::{Duration, Instant};

use rquickjs::{Context, Runtime};
use serde_json::Value;

/// Execute custom JS tool code in an isolated QuickJS runtime.
///
/// Each invocation gets its own `Runtime` + `Context` (separate GC heap,
/// no shared globals). The interrupt handler fires every N JS operations and
/// aborts execution when the wall-clock deadline is exceeded.
///
/// Replaces the TypeScript `new Function()` / `isolated-vm` paths.
pub async fn execute_js(
    code: String,
    params: Value,
    timeout_ms: u64,
) -> anyhow::Result<Value> {
    // Run synchronous QuickJS execution on the blocking thread pool so it
    // doesn't stall the async runtime.
    let outer_timeout = Duration::from_millis(timeout_ms.saturating_add(500));

    tokio::time::timeout(
        outer_timeout,
        tokio::task::spawn_blocking(move || run_sandbox(&code, params, timeout_ms)),
    )
    .await
    .map_err(|_| anyhow::anyhow!("Execution timeout after {}ms", timeout_ms))?
    .map_err(|e| anyhow::anyhow!("Sandbox thread error: {}", e))?
}

fn run_sandbox(code: &str, params: Value, timeout_ms: u64) -> anyhow::Result<Value> {
    let rt = Runtime::new()
        .map_err(|e| anyhow::anyhow!("Failed to create QuickJS runtime: {}", e))?;

    // Interrupt handler: checked by QuickJS between bytecode operations.
    // Returns true → stop execution immediately.
    let deadline = Instant::now() + Duration::from_millis(timeout_ms);
    rt.set_interrupt_handler(Some(Box::new(move || Instant::now() >= deadline)));

    let ctx = Context::full(&rt)
        .map_err(|e| anyhow::anyhow!("Failed to create QuickJS context: {}", e))?;

    let params_json =
        serde_json::to_string(&params).map_err(|e| anyhow::anyhow!("Params serialize: {}", e))?;

    // IIFE for scope isolation: injects params, defines execute, calls it.
    let script = format!(
        r#"(function() {{
  var params = {params_json};
  var parameters = params;
  {user_code}
  if (typeof execute !== 'function') {{
    throw new Error('Tool code must define an execute(params) function');
  }}
  var __result = execute(params);
  return JSON.stringify(__result !== undefined ? __result : null);
}})();"#,
        params_json = params_json,
        user_code = code,
    );

    let result_json: String = ctx
        .with(|ctx| ctx.eval::<String, _>(script.as_str()))
        .map_err(|e| {
            let msg = e.to_string();
            if msg.contains("interrupted") || msg.contains("InternalError") {
                anyhow::anyhow!("Execution timeout after {}ms", timeout_ms)
            } else {
                anyhow::anyhow!("Custom code execution failed: {}", msg)
            }
        })?;

    serde_json::from_str(&result_json)
        .map_err(|e| anyhow::anyhow!("Failed to parse tool result: {}", e))
}

use anyhow::Result;
use serde_json::Value;
use tokio::time::timeout;
use wasmtime::*;
use wasmtime_wasi::WasiCtxBuilder;

/// Pre-compiles the WASM binary and returns a Module.
/// In a real production setup, the engine/module should be cached per-tool
/// to avoid recompiling the WASM file on every execution.
fn create_engine_and_module(wasm_bytes: &[u8]) -> Result<(Engine, Module)> {
    let mut config = Config::new();
    config.async_support(true);
    config.consume_fuel(true);
    // Setting up memory/cpu limits happens in the Store.

    let engine = Engine::new(&config)?;
    let module = Module::new(&engine, wasm_bytes)?;
    
    Ok((engine, module))
}

pub async fn execute_wasm(
    base64_wasm: String,
    params: Value,
    timeout_ms: u64,
) -> Result<Value> {
    use base64::prelude::*;

    let wasm_bytes = BASE64_STANDARD.decode(&base64_wasm)
        .map_err(|_| anyhow::anyhow!("Invalid base64 payload for WASM"))?;

    let (engine, module) = create_engine_and_module(&wasm_bytes)?;

    let mut linker = Linker::new(&engine);
    wasmtime_wasi::add_to_linker(&mut linker, |s| s)?;

    // We pass parameters via a temporary WASI file or environment variables.
    // The cleanest way is an env var.
    let params_str = serde_json::to_string(&params)?;

    let mut wasi_builder = WasiCtxBuilder::new();
    wasi_builder.inherit_stdout().inherit_stderr();
    wasi_builder.env("TOOL_PARAMS", &params_str)?;
    let wasi = wasi_builder.build();

    let mut store = Store::new(&engine, wasi);
    store.set_fuel(10_000_000)?; // Fuel cap for execution (CPU accounting)

    let instance = linker.instantiate_async(&mut store, &module).await?;

    // WASM tools must export an `execute` or `_start` function.
    let func = instance.get_typed_func::<(), ()>(&mut store, "_start")
        .map_err(|_| anyhow::anyhow!("WASM module must export a '_start' function (WASI standard entry point)"))?;

    // Execute with a wall-clock timeout
    let result = timeout(
        std::time::Duration::from_millis(timeout_ms),
        func.call_async(&mut store, ())
    ).await;

    match result {
        Ok(Ok(_)) => {
            // For now we assume the tool prints to stdout. We inherited stdout above.
            // To capture it cleanly, we could pipe WASI stdout to a buffer.
            // Since this is a simple port, we'll just return a success payload.
            // A more advanced version would capture the WASI stdout buffer here.
            Ok(serde_json::json!({
                "message": "WASM module executed successfully",
            }))
        }
        Ok(Err(e)) => anyhow::bail!("WASM execution error: {}", e),
        Err(_) => anyhow::bail!("WASM execution timed out after {}ms", timeout_ms),
    }
}

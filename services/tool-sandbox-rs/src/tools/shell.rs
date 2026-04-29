use std::path::Path;

use serde_json::{json, Value};
use tokio::process::Command;
use tokio::time::{timeout, Duration};

use crate::config::Config;

pub async fn shell_execute(config: &Config, params: &Value) -> anyhow::Result<Value> {
    if !config.enable_file_operations {
        anyhow::bail!("Shell operations are disabled by policy (ENABLE_FILE_OPERATIONS=false).");
    }

    let command = params
        .get("command")
        .and_then(|v| v.as_str())
        .ok_or_else(|| anyhow::anyhow!("command is required"))?;

    let timeout_ms = params
        .get("timeout")
        .and_then(|v| v.as_u64())
        .unwrap_or(30_000);

    let exec_cwd = match params.get("cwd").and_then(|v| v.as_str()) {
        Some(c) if Path::new(c).is_absolute() => c.to_string(),
        Some(c) => Path::new(&config.workspace_root)
            .join(c)
            .to_string_lossy()
            .to_string(),
        None => config.workspace_root.clone(),
    };

    let output = timeout(
        Duration::from_millis(timeout_ms),
        Command::new("sh")
            .arg("-c")
            .arg(command)
            .current_dir(&exec_cwd)
            .output(),
    )
    .await
    .map_err(|_| anyhow::anyhow!("Command timed out after {}ms", timeout_ms))?
    .map_err(|e| anyhow::anyhow!("Command failed: {}", e))?;

    Ok(json!({
        "stdout": String::from_utf8_lossy(&output.stdout).to_string(),
        "stderr": String::from_utf8_lossy(&output.stderr).to_string(),
        "code":   output.status.code().unwrap_or(-1),
    }))
}

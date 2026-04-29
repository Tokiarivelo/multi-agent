use std::path::Path;

use serde_json::{json, Value};
use tokio::process::Command;

use crate::config::Config;

fn resolve_cwd(config: &Config, cwd: Option<&str>) -> String {
    match cwd {
        None => config.workspace_root.clone(),
        Some(c) if Path::new(c).is_absolute() => c.to_string(),
        Some(c) => Path::new(&config.workspace_root)
            .join(c)
            .to_string_lossy()
            .to_string(),
    }
}

async fn exec_git(cmd: &str, cwd: &str) -> anyhow::Result<Value> {
    let output = Command::new("sh")
        .arg("-c")
        .arg(cmd)
        .current_dir(cwd)
        .output()
        .await
        .map_err(|e| anyhow::anyhow!("Git command failed: {}", e))?;

    Ok(json!({
        "stdout": String::from_utf8_lossy(&output.stdout).to_string(),
        "stderr": String::from_utf8_lossy(&output.stderr).to_string(),
        "code":   output.status.code().unwrap_or(-1),
    }))
}

async fn current_branch(cwd: &str) -> anyhow::Result<String> {
    let output = Command::new("git")
        .args(["rev-parse", "--abbrev-ref", "HEAD"])
        .current_dir(cwd)
        .output()
        .await?;
    Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
}

pub async fn git_status(config: &Config, params: &Value) -> anyhow::Result<Value> {
    if !config.enable_file_operations {
        anyhow::bail!("File operations are disabled");
    }
    let cwd = resolve_cwd(config, params.get("cwd").and_then(|v| v.as_str()));
    exec_git("git status", &cwd).await
}

pub async fn git_add(config: &Config, params: &Value) -> anyhow::Result<Value> {
    if !config.enable_file_operations {
        anyhow::bail!("File operations are disabled");
    }
    let cwd = resolve_cwd(config, params.get("cwd").and_then(|v| v.as_str()));
    let paths = match params.get("paths") {
        Some(Value::Array(arr)) => arr
            .iter()
            .filter_map(|v| v.as_str())
            .collect::<Vec<_>>()
            .join(" "),
        Some(Value::String(s)) => s.clone(),
        _ => ".".to_string(),
    };
    exec_git(&format!("git add {}", paths), &cwd).await
}

pub async fn git_commit(config: &Config, params: &Value) -> anyhow::Result<Value> {
    if !config.enable_file_operations {
        anyhow::bail!("File operations are disabled");
    }
    let cwd = resolve_cwd(config, params.get("cwd").and_then(|v| v.as_str()));
    let message = params
        .get("message")
        .and_then(|v| v.as_str())
        .ok_or_else(|| anyhow::anyhow!("message is required"))?;
    exec_git(&format!("git commit -m {:?}", message), &cwd).await
}

pub async fn git_push(config: &Config, params: &Value) -> anyhow::Result<Value> {
    if !config.enable_file_operations {
        anyhow::bail!("File operations are disabled");
    }
    let cwd = resolve_cwd(config, params.get("cwd").and_then(|v| v.as_str()));
    let remote = params
        .get("remote")
        .and_then(|v| v.as_str())
        .unwrap_or("origin");
    let branch = match params.get("branch").and_then(|v| v.as_str()) {
        Some(b) => b.to_string(),
        None => current_branch(&cwd).await?,
    };
    exec_git(&format!("git push {} {}", remote, branch), &cwd).await
}

pub async fn git_pull(config: &Config, params: &Value) -> anyhow::Result<Value> {
    if !config.enable_file_operations {
        anyhow::bail!("File operations are disabled");
    }
    let cwd = resolve_cwd(config, params.get("cwd").and_then(|v| v.as_str()));
    let remote = params
        .get("remote")
        .and_then(|v| v.as_str())
        .unwrap_or("origin");
    let branch = match params.get("branch").and_then(|v| v.as_str()) {
        Some(b) => b.to_string(),
        None => current_branch(&cwd).await?,
    };
    exec_git(&format!("git pull {} {}", remote, branch), &cwd).await
}

pub async fn git_branch_create(config: &Config, params: &Value) -> anyhow::Result<Value> {
    if !config.enable_file_operations {
        anyhow::bail!("File operations are disabled");
    }
    let cwd = resolve_cwd(config, params.get("cwd").and_then(|v| v.as_str()));
    let name = params
        .get("name")
        .and_then(|v| v.as_str())
        .ok_or_else(|| anyhow::anyhow!("name is required"))?;
    let checkout = params
        .get("checkout")
        .and_then(|v| v.as_bool())
        .unwrap_or(false);
    let cmd = if checkout {
        format!("git checkout -b {}", name)
    } else {
        format!("git branch {}", name)
    };
    exec_git(&cmd, &cwd).await
}

use std::env;

#[derive(Clone, Debug)]
pub struct Config {
    pub port: u16,
    pub database_url: String,
    pub tool_execution_timeout_ms: u64,
    pub enable_file_operations: bool,
    pub allowed_domains: Vec<String>,
    pub document_service_url: String,
    pub workspace_root: String,
}

impl Config {
    pub fn from_env() -> anyhow::Result<Self> {
        dotenvy::dotenv().ok();

        let allowed_domains_str = env::var("ALLOWED_DOMAINS").unwrap_or_else(|_| "*".to_string());
        let allowed_domains = if allowed_domains_str == "*" {
            vec!["*".to_string()]
        } else {
            allowed_domains_str
                .split(',')
                .map(|s| s.trim().to_string())
                .collect()
        };

        let workspace_root = env::var("WORKSPACE_ROOT").unwrap_or_else(|_| {
            env::current_dir()
                .map(|p| p.to_string_lossy().to_string())
                .unwrap_or_else(|_| ".".to_string())
        });

        Ok(Config {
            port: env::var("PORT")
                .unwrap_or_else(|_| "3030".to_string())
                .parse()
                .unwrap_or(3030),
            database_url: env::var("DATABASE_URL")
                .map_err(|_| anyhow::anyhow!("DATABASE_URL is required"))?,
            tool_execution_timeout_ms: env::var("TOOL_EXECUTION_TIMEOUT")
                .unwrap_or_else(|_| "30000".to_string())
                .parse()
                .unwrap_or(30000),
            enable_file_operations: env::var("ENABLE_FILE_OPERATIONS")
                .unwrap_or_else(|_| "true".to_string())
                .to_lowercase()
                != "false",
            allowed_domains,
            document_service_url: env::var("DOCUMENT_SERVICE_URL")
                .unwrap_or_else(|_| "http://localhost:3009".to_string()),
            workspace_root,
        })
    }

    pub fn is_domain_allowed(&self, url: &str) -> bool {
        if self.allowed_domains.contains(&"*".to_string()) {
            return true;
        }
        if let Ok(parsed) = reqwest::Url::parse(url) {
            if let Some(host) = parsed.host_str() {
                return self
                    .allowed_domains
                    .iter()
                    .any(|d| host == d || host.ends_with(&format!(".{}", d)));
            }
        }
        false
    }
}

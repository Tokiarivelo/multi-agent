pub mod file;
pub mod git;
pub mod http;
pub mod integrations;
pub mod shell;

use reqwest::Client;
use serde_json::Value;

use crate::config::Config;

pub async fn dispatch_builtin(
    client: &Client,
    config: &Config,
    tool_name: &str,
    params: Value,
    _timeout_ms: u64,
) -> anyhow::Result<Value> {
    match tool_name {
        // HTTP / parsing
        "http_request" => http::http_request(client, config, &params).await,
        "web_scraper" => http::web_scraper(client, config, &params).await,
        "json_parser" => http::json_parser(&params),

        // File system
        "file_read" => file::file_read(config, &params).await,
        "pdf_read" => file::pdf_read(client, config, &params).await,
        "file_write" => file::file_write(config, &params).await,
        "workspace_read" => file::workspace_read(config, &params).await,
        "workspace_write" => file::workspace_write(config, &params).await,

        // Shell
        "shell_execute" => shell::shell_execute(config, &params).await,

        // Git
        "git_status" => git::git_status(config, &params).await,
        "git_add" => git::git_add(config, &params).await,
        "git_commit" => git::git_commit(config, &params).await,
        "git_push" => git::git_push(config, &params).await,
        "git_pull" => git::git_pull(config, &params).await,
        "git_branch_create" => git::git_branch_create(config, &params).await,

        // Integrations
        "github_api" => integrations::github_api(client, &params).await,
        "slack_post_message" => integrations::slack_post_message(client, &params).await,
        "whatsapp_send_message" => integrations::whatsapp_send_message(client, &params).await,
        "trello_create_card" => integrations::trello_create_card(client, &params).await,
        "trello_get_lists" => integrations::trello_get_lists(client, &params).await,
        "trello_move_card" => integrations::trello_move_card(client, &params).await,

        // Document (proxy to document-service)
        "document_read" => integrations::document_read(client, config, &params).await,
        "document_parse_image" => integrations::document_parse_image(client, config, &params).await,
        "document_generate" => integrations::document_generate(client, config, &params).await,
        "document_delete" => integrations::document_delete(client, config, &params).await,
        "document_write" => integrations::document_write(client, config, &params).await,

        _ => anyhow::bail!("Unknown built-in tool: {}", tool_name),
    }
}

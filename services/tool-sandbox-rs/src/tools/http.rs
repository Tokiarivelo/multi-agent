use reqwest::Client;
use scraper::{Html, Selector};
use serde_json::{json, Value};

use crate::config::Config;

pub async fn http_request(client: &Client, config: &Config, params: &Value) -> anyhow::Result<Value> {
    let url = params
        .get("url")
        .and_then(|v| v.as_str())
        .ok_or_else(|| anyhow::anyhow!("url is required"))?;

    if !config.is_domain_allowed(url) {
        anyhow::bail!("Domain not allowed: {}", url);
    }

    let method = params
        .get("method")
        .and_then(|v| v.as_str())
        .unwrap_or("GET")
        .parse::<reqwest::Method>()?;

    let mut req = client
        .request(method, url)
        .timeout(std::time::Duration::from_millis(10_000));

    if let Some(Value::Object(headers)) = params.get("headers") {
        for (k, v) in headers {
            if let Some(s) = v.as_str() {
                req = req.header(k.as_str(), s);
            }
        }
    }

    if let Some(body) = params.get("body") {
        req = req.json(body);
    }

    let resp = req
        .send()
        .await
        .map_err(|e| anyhow::anyhow!("HTTP request failed: {}", e))?;

    let status = resp.status().as_u16();
    let resp_headers: serde_json::Map<String, Value> = resp
        .headers()
        .iter()
        .map(|(k, v)| {
            (
                k.to_string(),
                json!(v.to_str().unwrap_or("")),
            )
        })
        .collect();

    let data: Value = resp.json().await.unwrap_or(Value::Null);

    Ok(json!({ "status": status, "headers": resp_headers, "data": data }))
}

pub async fn web_scraper(
    client: &Client,
    config: &Config,
    params: &Value,
) -> anyhow::Result<Value> {
    let url = params
        .get("url")
        .and_then(|v| v.as_str())
        .ok_or_else(|| anyhow::anyhow!("url is required"))?;

    if !config.is_domain_allowed(url) {
        anyhow::bail!("Domain not allowed: {}", url);
    }

    let selector_str = params.get("selector").and_then(|v| v.as_str());

    let html = client
        .get(url)
        .timeout(std::time::Duration::from_millis(10_000))
        .send()
        .await
        .map_err(|e| anyhow::anyhow!("Web scraping failed: {}", e))?
        .text()
        .await
        .map_err(|e| anyhow::anyhow!("Web scraping failed: {}", e))?;

    let document = Html::parse_document(&html);

    if let Some(sel_str) = selector_str {
        let selector = Selector::parse(sel_str)
            .map_err(|_| anyhow::anyhow!("Invalid CSS selector: {}", sel_str))?;

        let results: Vec<Value> = document
            .select(&selector)
            .map(|el| {
                let text = el.text().collect::<Vec<_>>().join("").trim().to_string();
                let inner_html = el.inner_html();
                let attrs: serde_json::Map<String, Value> = el
                    .value()
                    .attrs()
                    .map(|(k, v)| (k.to_string(), json!(v)))
                    .collect();
                json!({ "text": text, "html": inner_html, "attributes": attrs })
            })
            .collect();

        return Ok(Value::Array(results));
    }

    let title_sel = Selector::parse("title").unwrap();
    let body_sel = Selector::parse("body").unwrap();

    let title = document
        .select(&title_sel)
        .next()
        .map(|el| el.text().collect::<String>())
        .unwrap_or_default();

    let body_text = document
        .select(&body_sel)
        .next()
        .map(|el| {
            el.text()
                .collect::<Vec<_>>()
                .join(" ")
                .split_whitespace()
                .collect::<Vec<_>>()
                .join(" ")
        })
        .unwrap_or_default();

    Ok(json!({ "title": title, "text": body_text }))
}

pub fn json_parser(params: &Value) -> anyhow::Result<Value> {
    let json_str = params
        .get("json")
        .and_then(|v| v.as_str())
        .ok_or_else(|| anyhow::anyhow!("json field is required"))?;
    serde_json::from_str(json_str).map_err(|e| anyhow::anyhow!("JSON parsing failed: {}", e))
}

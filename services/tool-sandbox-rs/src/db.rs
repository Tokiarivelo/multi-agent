use serde_json::Value;
use sqlx::{postgres::PgRow, PgPool, Row};

const FULL_COLS: &str = concat!(
    r#"id, name, description, category::text AS category, parameters, code, "#,
    r#""isBuiltIn" AS is_built_in, icon, "mcpConfig" AS mcp_config, "#,
    r#""repoFullName" AS repo_full_name, "#,
    r#"TO_CHAR("createdAt" AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS created_at, "#,
    r#"TO_CHAR("updatedAt" AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS updated_at"#,
);

#[derive(Debug, Clone)]
pub struct FullToolRow {
    pub id: String,
    pub name: String,
    pub description: String,
    pub category: String,
    pub parameters: Value,
    pub code: Option<String>,
    pub is_built_in: bool,
    pub icon: Option<String>,
    pub mcp_config: Option<Value>,
    pub repo_full_name: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

fn map_full(r: PgRow) -> FullToolRow {
    FullToolRow {
        id: r.get("id"),
        name: r.get("name"),
        description: r.get("description"),
        category: r.get::<Option<String>, _>("category").unwrap_or_default(),
        parameters: r.get("parameters"),
        code: r.get("code"),
        is_built_in: r.get("is_built_in"),
        icon: r.get("icon"),
        mcp_config: r.get("mcp_config"),
        repo_full_name: r.get("repo_full_name"),
        created_at: r.get("created_at"),
        updated_at: r.get("updated_at"),
    }
}

pub struct CreateToolInput {
    pub name: String,
    pub description: String,
    pub category: String,
    pub parameters: Value,
    pub code: Option<String>,
    pub is_built_in: bool,
    pub icon: Option<String>,
    pub mcp_config: Option<Value>,
    pub repo_full_name: Option<String>,
}

pub struct ToolUpdateValues {
    pub name: String,
    pub description: String,
    pub category: String,
    pub parameters: Value,
    pub code: Option<String>,
    pub is_built_in: bool,
    pub icon: Option<String>,
    pub mcp_config: Option<Value>,
    pub repo_full_name: Option<String>,
}

#[derive(Debug, Clone)]
#[allow(dead_code)]
pub struct ToolRow {
    pub id: String,
    pub name: String,
    pub category: String,
    pub code: Option<String>,
    pub is_built_in: bool,
    pub mcp_config: Option<Value>,
    pub repo_full_name: Option<String>,
}

fn map_tool(r: PgRow) -> ToolRow {
    ToolRow {
        id: r.get("id"),
        name: r.get("name"),
        category: r.get::<Option<String>, _>("category").unwrap_or_default(),
        code: r.get("code"),
        is_built_in: r.get("is_built_in"),
        mcp_config: r.get("mcp_config"),
        repo_full_name: r.get("repo_full_name"),
    }
}

pub async fn find_tool_by_id(pool: &PgPool, id: &str) -> anyhow::Result<Option<ToolRow>> {
    let row = sqlx::query(
        r#"SELECT id, name, category::text AS category, code,
              "isBuiltIn" AS is_built_in, "mcpConfig" AS mcp_config, "repoFullName" AS repo_full_name
           FROM tools WHERE id = $1"#,
    )
    .bind(id)
    .fetch_optional(pool)
    .await?
    .map(map_tool);
    Ok(row)
}

pub async fn find_tool_by_name(pool: &PgPool, name: &str) -> anyhow::Result<Option<ToolRow>> {
    let row = sqlx::query(
        r#"SELECT id, name, category::text AS category, code,
              "isBuiltIn" AS is_built_in, "mcpConfig" AS mcp_config, "repoFullName" AS repo_full_name
           FROM tools WHERE name = $1"#,
    )
    .bind(name)
    .fetch_optional(pool)
    .await?
    .map(map_tool);
    Ok(row)
}

pub async fn find_github_token(pool: &PgPool, user_id: &str) -> anyhow::Result<Option<String>> {
    let row = sqlx::query(r#"SELECT settings FROM users WHERE id = $1"#)
        .bind(user_id)
        .fetch_optional(pool)
        .await?;

    if let Some(r) = row {
        let settings: Option<Value> = r.get("settings");
        if let Some(s) = settings {
            if let Some(token) = s.get("githubToken").and_then(|v| v.as_str()) {
                return Ok(Some(token.to_string()));
            }
        }
    }
    Ok(None)
}

pub async fn clear_github_token(pool: &PgPool, user_id: &str) -> anyhow::Result<()> {
    let row = sqlx::query(r#"SELECT settings FROM users WHERE id = $1"#)
        .bind(user_id)
        .fetch_optional(pool)
        .await?;

    if let Some(r) = row {
        let mut settings: serde_json::Map<String, Value> = r
            .get::<Option<Value>, _>("settings")
            .and_then(|v| v.as_object().cloned())
            .unwrap_or_default();
        settings.remove("githubToken");

        sqlx::query(r#"UPDATE users SET settings = $1 WHERE id = $2"#)
            .bind(Value::Object(settings))
            .bind(user_id)
            .execute(pool)
            .await?;
    }
    Ok(())
}

// ── CRUD ─────────────────────────────────────────────────────────────────────

pub async fn list_tools(
    pool: &PgPool,
    page: u32,
    limit: u32,
    category: Option<&str>,
    is_built_in: Option<bool>,
) -> anyhow::Result<(Vec<FullToolRow>, i64)> {
    let offset = (page.saturating_sub(1) as i64) * (limit as i64);
    let sql = format!(
        r#"SELECT {FULL_COLS} FROM tools
           WHERE ($3::text IS NULL OR category::text = $3)
             AND ($4::boolean IS NULL OR "isBuiltIn" = $4)
           ORDER BY "createdAt" DESC LIMIT $1 OFFSET $2"#
    );
    let rows = sqlx::query(&sql)
        .bind(limit as i64)
        .bind(offset)
        .bind(category)
        .bind(is_built_in)
        .fetch_all(pool)
        .await?
        .into_iter()
        .map(map_full)
        .collect();

    let total: i64 = sqlx::query_scalar(
        r#"SELECT COUNT(*) FROM tools
           WHERE ($1::text IS NULL OR category::text = $1)
             AND ($2::boolean IS NULL OR "isBuiltIn" = $2)"#,
    )
    .bind(category)
    .bind(is_built_in)
    .fetch_one(pool)
    .await?;

    Ok((rows, total))
}

pub async fn get_full_tool(pool: &PgPool, id: &str) -> anyhow::Result<Option<FullToolRow>> {
    let sql = format!("SELECT {FULL_COLS} FROM tools WHERE id = $1");
    let row = sqlx::query(&sql)
        .bind(id)
        .fetch_optional(pool)
        .await?
        .map(map_full);
    Ok(row)
}

pub async fn create_tool(pool: &PgPool, input: CreateToolInput) -> anyhow::Result<FullToolRow> {
    let id = uuid::Uuid::new_v4().to_string();
    let sql = format!(
        r#"WITH t AS (
           INSERT INTO tools
             (id, name, description, category, parameters, code,
              "isBuiltIn", icon, "mcpConfig", "repoFullName", "createdAt", "updatedAt")
           VALUES ($1,$2,$3,$4::"ToolCategory",$5,$6,$7,$8,$9,$10,NOW(),NOW())
           RETURNING *)
           SELECT {FULL_COLS} FROM t"#
    );
    let row = sqlx::query(&sql)
        .bind(&id)
        .bind(&input.name)
        .bind(&input.description)
        .bind(&input.category)
        .bind(&input.parameters)
        .bind(&input.code)
        .bind(input.is_built_in)
        .bind(&input.icon)
        .bind(&input.mcp_config)
        .bind(&input.repo_full_name)
        .fetch_one(pool)
        .await
        .map(map_full)?;
    Ok(row)
}

pub async fn update_tool(
    pool: &PgPool,
    id: &str,
    v: ToolUpdateValues,
) -> anyhow::Result<Option<FullToolRow>> {
    let sql = format!(
        r#"WITH t AS (
           UPDATE tools
           SET name=$2, description=$3, category=$4::"ToolCategory", parameters=$5,
               code=$6, "isBuiltIn"=$7, icon=$8, "mcpConfig"=$9, "repoFullName"=$10,
               "updatedAt"=NOW()
           WHERE id=$1 RETURNING *)
           SELECT {FULL_COLS} FROM t"#
    );
    let row = sqlx::query(&sql)
        .bind(id)
        .bind(&v.name)
        .bind(&v.description)
        .bind(&v.category)
        .bind(&v.parameters)
        .bind(&v.code)
        .bind(v.is_built_in)
        .bind(&v.icon)
        .bind(&v.mcp_config)
        .bind(&v.repo_full_name)
        .fetch_optional(pool)
        .await?
        .map(map_full);
    Ok(row)
}

pub async fn delete_tool(pool: &PgPool, id: &str) -> anyhow::Result<bool> {
    let deleted = sqlx::query(r#"DELETE FROM tools WHERE id = $1 RETURNING id"#)
        .bind(id)
        .fetch_optional(pool)
        .await?;
    Ok(deleted.is_some())
}

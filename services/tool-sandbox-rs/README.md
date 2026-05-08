# Tool Sandbox (Rust)

> Rust/Axum drop-in replacement for the TypeScript tool-service. Executes built-in tools, custom JavaScript (QuickJS sandbox), WASM modules, and MCP tools.

## Stack

| Library | Purpose |
|---------|---------|
| Axum | HTTP server |
| SQLx + PostgreSQL | Tool persistence |
| Tokio | Async runtime |
| QuickJS (rquickjs) | JS sandbox |
| Wasmtime | WASM execution |
| utoipa + utoipa-swagger-ui | OpenAPI / Swagger UI |

## Port

`3030` — proxied by the gateway under `/api/tools/*`

## API

### `GET /health`
Liveness probe. Returns `{ "status": "ok" }`.

### `GET /api/tools`
List tools (paginated).

| Query param | Default | Description |
|-------------|---------|-------------|
| `page` | `1` | Page number (1-based) |
| `limit` | `20` | Items per page (max 100) |
| `category` | — | Filter by category (`MCP`, `CUSTOM`, `BUILT_IN`) |
| `isBuiltIn` | — | Filter to built-in tools only |

### `GET /api/tools/:id`
Get a single tool by UUID.

### `POST /api/tools`
Create a new tool.

### `PUT /api/tools/:id` / `PATCH /api/tools/:id`
Update a tool. All fields are optional; `null` clears nullable fields.

### `DELETE /api/tools/:id`
Delete a tool. Returns `204 No Content` on success.

### `POST /api/tools/execute`
Execute a tool by ID or name.

```json
{
  "toolId": "uuid-or-use-toolName",
  "toolName": "web_search",
  "parameters": { "query": "OpenAI latest news" },
  "timeout": 30000,
  "userId": "user-uuid"
}
```

Response always `200` — check the `success` field:

```json
{ "success": true, "data": { ... }, "executionTime": 142 }
{ "success": false, "error": "Tool not found", "executionTime": 3 }
```

### `POST /api/tools/upload-wasm`
Upload a WASM binary for a tool (`multipart/form-data`).

| Field | Type | Description |
|-------|------|-------------|
| `toolId` | `string` | UUID of the target tool |
| `file` | `binary` | WASM file (must start with `\0asm` magic) |

## Swagger UI

Interactive API explorer available at **`http://localhost:3030/docs/`** when the service is running.

OpenAPI JSON spec: `http://localhost:3030/docs/openapi.json`

## Running locally

```bash
cd services/tool-sandbox-rs
cp ../../.env .env          # or set DATABASE_URL manually
cargo run
```

Environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | required | PostgreSQL connection string |
| `PORT` | `3030` | Listening port |
| `TOOL_EXECUTION_TIMEOUT_MS` | `30000` | Default tool timeout |

## Running with Docker

```bash
docker build -t tool-sandbox-rs .
docker run -p 3030:3030 -e DATABASE_URL=... tool-sandbox-rs
```

## Tests

```bash
cargo test
```

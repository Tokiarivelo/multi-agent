# GitHub MCP Server — Implementation Guide

## Overview

This document describes how to implement and configure the `github-mcp-service`, a Model Context Protocol (MCP) server that gives AI agents access to GitHub via a **GitHub App** (short-lived Installation Tokens, not personal access tokens).

```
Agent ──► tool-service (McpExecutorService) ──► github-mcp-service ──► GitHub API
                                                       │
                                               GitHub App JWT
                                                       │
                                               Installation Token (1h TTL)
```

---

## 1. Create a GitHub App

### 1.1 Register the App

1. Go to **Settings → Developer settings → GitHub Apps → New GitHub App**
2. Fill in:
   | Field | Value |
   |-------|-------|
   | GitHub App name | `multi-agent-mcp` (must be unique) |
   | Homepage URL | your domain or `http://localhost` |
   | Webhook | **disable** (uncheck "Active") |
   | Callback URL | leave empty |

3. **Permissions** (Repository):
   | Permission | Level |
   |------------|-------|
   | Contents | Read & Write |
   | Issues | Read & Write |
   | Pull requests | Read & Write |
   | Metadata | Read-only (mandatory) |
   | Actions | Read-only (optional) |

4. **Where can this GitHub App be installed?** → "Only on this account" for private use, "Any account" for SaaS.

5. Click **Create GitHub App**.

### 1.2 Generate a Private Key

On the App page → **Generate a private key** → download the `.pem` file.

### 1.3 Install the App on a Repository / Organization

On the App page → **Install App** → choose account → select repositories.

After installation, note the **Installation ID** from the URL:
```
https://github.com/settings/installations/<INSTALLATION_ID>
```

### 1.4 Collect Credentials

```env
GITHUB_APP_ID=123456
GITHUB_APP_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----"
GITHUB_APP_INSTALLATION_ID=78910
```

> Store the private key as a single-line string with `\n` for newlines, or mount it as a file
> and set `GITHUB_APP_PRIVATE_KEY_PATH=/run/secrets/github-app.pem`.

---

## 2. Authentication Flow

```
1. Build JWT:
   - iss  = App ID
   - iat  = now - 60s   (clock skew tolerance)
   - exp  = now + 600s  (10 min max)
   - alg  = RS256
   Sign with private key (PEM)

2. Exchange JWT for Installation Token:
   POST https://api.github.com/app/installations/{installation_id}/access_tokens
   Authorization: Bearer <JWT>
   → { token: "ghs_...", expires_at: "..." }

3. Use token for all GitHub API calls:
   Authorization: token ghs_...

4. Refresh when expires_at < now + 5 min
```

The service caches the Installation Token and refreshes it proactively 5 minutes before expiry.

---

## 3. Service Architecture

```
services/github-mcp-service/
├── src/
│   ├── app.module.ts
│   ├── main.ts
│   ├── application/
│   │   └── dto/
│   │       └── mcp-request.dto.ts        # JSON-RPC request schema
│   ├── domain/
│   │   └── github-tool.interface.ts      # Tool input/output types
│   ├── infrastructure/
│   │   ├── config/
│   │   │   ├── configuration.ts          # Env var mapping
│   │   │   └── env.validation.ts         # Joi/Zod schema
│   │   └── github/
│   │       ├── github-auth.service.ts    # JWT + Installation Token cache
│   │       └── github-api.service.ts     # Octokit wrapper
│   └── presentation/
│       ├── controllers/
│       │   └── mcp.controller.ts         # POST /mcp  (JSON-RPC dispatcher)
│       └── tools/                        # One class per MCP tool
│           ├── search-repositories.tool.ts
│           ├── get-file-contents.tool.ts
│           ├── push-files.tool.ts
│           ├── create-branch.tool.ts
│           ├── list-issues.tool.ts
│           ├── create-issue.tool.ts
│           ├── list-pull-requests.tool.ts
│           ├── create-pull-request.tool.ts
│           └── index.ts
├── package.json
├── tsconfig.json
└── nest-cli.json
```

---

## 4. MCP Protocol Contract

The service exposes a single endpoint:

```
POST /mcp
Content-Type: application/json
```

### 4.1 `tools/list` — Discover available tools

**Request:**
```json
{ "jsonrpc": "2.0", "id": 1, "method": "tools/list", "params": {} }
```

**Response:**
```json
{
  "jsonrpc": "2.0", "id": 1,
  "result": {
    "tools": [
      {
        "name": "github_search_repositories",
        "description": "Search GitHub repositories by keyword, language, or topic",
        "inputSchema": {
          "type": "object",
          "properties": {
            "query":    { "type": "string", "description": "GitHub search query (e.g. 'nestjs language:typescript')" },
            "per_page": { "type": "number", "description": "Results per page (max 30)", "default": 10 }
          },
          "required": ["query"]
        }
      }
    ]
  }
}
```

### 4.2 `tools/call` — Invoke a tool

**Request:**
```json
{
  "jsonrpc": "2.0", "id": 2,
  "method": "tools/call",
  "params": {
    "name": "github_get_file_contents",
    "arguments": { "owner": "org", "repo": "repo", "path": "src/index.ts" }
  }
}
```

**Response:**
```json
{
  "jsonrpc": "2.0", "id": 2,
  "result": {
    "content": [{ "type": "text", "text": "file content here..." }]
  }
}
```

---

## 5. Tool Catalog

| Tool Name | Description | Key Parameters |
|-----------|-------------|----------------|
| `github_search_repositories` | Search repos | `query`, `per_page` |
| `github_get_file_contents` | Read file or directory | `owner`, `repo`, `path`, `branch?` |
| `github_push_files` | Create or update files | `owner`, `repo`, `branch`, `files[]`, `message` |
| `github_create_branch` | Create branch from ref | `owner`, `repo`, `branch`, `from_branch?` |
| `github_list_issues` | List issues | `owner`, `repo`, `state?`, `labels?` |
| `github_create_issue` | Open an issue | `owner`, `repo`, `title`, `body?`, `labels?` |
| `github_list_pull_requests` | List PRs | `owner`, `repo`, `state?`, `base?` |
| `github_create_pull_request` | Open a PR | `owner`, `repo`, `title`, `body`, `head`, `base` |
| `github_merge_pull_request` | Merge a PR | `owner`, `repo`, `pull_number`, `merge_method?` |
| `github_fork_repository` | Fork a repo | `owner`, `repo`, `organization?` |

---

## 6. Registering with the Tool Service

After the service is running (default port `3010`), register each tool via the tool-service API:

```bash
curl -X POST http://localhost:3006/api/tools \
  -H "Content-Type: application/json" \
  -d '{
    "name": "github_search_repositories",
    "description": "Search GitHub repositories",
    "category": "MCP",
    "parameters": [
      { "name": "query", "type": "string", "description": "Search query", "required": true },
      { "name": "per_page", "type": "number", "description": "Results per page", "required": false, "default": 10 }
    ],
    "mcpConfig": {
      "serverUrl": "http://github-mcp-service:3010/mcp",
      "toolName": "github_search_repositories",
      "transport": "http"
    }
  }'
```

Or use the seed script: `pnpm --filter @multi-agent/github-mcp-service seed`.

---

## 7. Environment Variables

```env
# GitHub App credentials (required)
GITHUB_APP_ID=123456
GITHUB_APP_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----"
GITHUB_APP_INSTALLATION_ID=78910

# Optional: file path instead of inline key
# GITHUB_APP_PRIVATE_KEY_PATH=/run/secrets/github-app.pem

# Service
GITHUB_MCP_PORT=3010
NODE_ENV=production
LOG_LEVEL=info
```

---

## 8. Docker Compose Integration

Add to `docker-compose.yml`:

```yaml
github-mcp-service:
  build:
    context: ./services/github-mcp-service
    dockerfile: Dockerfile
  ports:
    - "3010:3010"
  environment:
    GITHUB_APP_ID: ${GITHUB_APP_ID}
    GITHUB_APP_PRIVATE_KEY: ${GITHUB_APP_PRIVATE_KEY}
    GITHUB_APP_INSTALLATION_ID: ${GITHUB_APP_INSTALLATION_ID}
    GITHUB_MCP_PORT: 3010
  restart: unless-stopped
```

---

## 9. Security Considerations

- **Never commit** the private key (`.pem`) or `.env` to git.
- Mount the private key as a **Docker secret** or **Kubernetes Secret** in production.
- The Installation Token is scoped to the specific repositories chosen at install time.
- Rate limit the `/mcp` endpoint (the service is internal, but still apply a firewall rule).
- Rotate the private key periodically via the GitHub App settings.

---

## 10. Local Development

```bash
# 1. Install dependencies
pnpm --filter @multi-agent/github-mcp-service install

# 2. Copy env template
cp services/github-mcp-service/.env.example services/github-mcp-service/.env
# → fill in GITHUB_APP_ID, GITHUB_APP_PRIVATE_KEY, GITHUB_APP_INSTALLATION_ID

# 3. Start the service
pnpm --filter @multi-agent/github-mcp-service dev

# 4. Smoke test
curl -X POST http://localhost:3010/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
```

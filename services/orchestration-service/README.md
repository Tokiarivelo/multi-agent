# Orchestration Service

The Orchestration Service is a workflow engine that manages workflow CRUD operations and orchestrates workflow execution by calling agent-service and tool-service. Built with Clean Architecture principles using NestJS.

## Features

### Workflow Management
- **CRUD Operations**: Create, read, update, delete workflows
- **Workflow Validation**: Validates workflow structure before execution
- **Status Management**: Draft, Active, Inactive, Archived states
- **User Isolation**: Per-user workflow management

### Workflow Execution Engine
- **Node Types**: Support for AGENT, TOOL, CONDITIONAL, TRANSFORM, START, and END nodes
- **Edge-based Flow**: Execute nodes in correct order based on edges
- **Conditional Logic**: Evaluate conditions to determine execution paths
- **Data Transformation**: Transform data between nodes using custom scripts
- **Retry Logic**: Configurable retry mechanism for failed nodes
- **Async Execution**: Non-blocking workflow execution with status updates

### Real-time Updates
- **WebSocket Gateway**: Real-time execution updates via Socket.IO
- **Event Streaming**: Live updates for execution status, node status, and errors
- **Room-based Subscriptions**: Subscribe to specific execution updates

### Service Integration
- **Agent Service**: Execute AI agents via REST API
- **Tool Service**: Execute tools via REST API
- **Execution Service**: Log execution progress (optional)

## Architecture

### Clean Architecture Layers

```
src/
├── domain/              # Business logic and entities
│   ├── entities/        # Domain entities (Workflow, WorkflowExecution)
│   ├── repositories/    # Repository interfaces
│   └── services/        # Domain services
├── application/         # Use cases and DTOs
│   ├── use-cases/       # Business use cases
│   ├── dto/             # Data transfer objects
│   └── interfaces/      # Application interfaces
├── infrastructure/      # External concerns
│   ├── database/        # Database connections
│   ├── persistence/     # Repository implementations
│   ├── external/        # External service clients
│   └── config/          # Configuration
└── presentation/        # API layer
    ├── controllers/     # REST controllers
    ├── gateways/        # WebSocket gateways
    └── filters/         # Exception filters
```

## Installation

```bash
# Install dependencies
pnpm install

# Build the service
pnpm build

# Start in development mode
pnpm start:dev

# Start in production mode
pnpm start:prod
```

## Configuration

Create a `.env` file with the following variables:

```env
# Server
PORT=3001
NODE_ENV=development

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/multi_agent

# CORS
CORS_ORIGIN=*

# External Services
AGENT_SERVICE_URL=http://localhost:3002
TOOL_SERVICE_URL=http://localhost:3006
EXECUTION_SERVICE_URL=http://localhost:3004

# Execution Settings
MAX_RETRY_ATTEMPTS=3
EXECUTION_TIMEOUT=300000
```

## API Endpoints

### Workflows

```http
POST /workflows
GET /workflows
GET /workflows/:id
POST /workflows/execute
GET /workflows/executions/:executionId
POST /workflows/executions/:executionId/cancel
```

### Health Check

```http
GET /health
```

## WebSocket Events

### Client → Server

- `subscribe`: Subscribe to execution updates
  ```json
  { "executionId": "execution-id" }
  ```

- `unsubscribe`: Unsubscribe from execution updates
  ```json
  { "executionId": "execution-id" }
  ```

- `join`: Join execution room
  ```json
  { "executionId": "execution-id" }
  ```

- `leave`: Leave execution room
  ```json
  { "executionId": "execution-id" }
  ```

### Server → Client

- `execution:update`: Execution status update
  ```json
  {
    "executionId": "execution-id",
    "workflowId": "workflow-id",
    "status": "RUNNING",
    "currentNodeId": "node-id",
    "nodeExecutions": [...],
    "timestamp": "2024-01-01T00:00:00.000Z"
  }
  ```

- `node:update`: Node status update
  ```json
  {
    "executionId": "execution-id",
    "nodeId": "node-id",
    "status": "COMPLETED",
    "data": {...},
    "timestamp": "2024-01-01T00:00:00.000Z"
  }
  ```

- `execution:error`: Execution error
  ```json
  {
    "executionId": "execution-id",
    "error": "Error message",
    "timestamp": "2024-01-01T00:00:00.000Z"
  }
  ```

## Workflow Definition Structure

```json
{
  "name": "Example Workflow",
  "description": "A sample workflow",
  "definition": {
    "nodes": [
      {
        "id": "start",
        "type": "START",
        "config": {},
        "position": { "x": 0, "y": 0 }
      },
      {
        "id": "agent-1",
        "type": "AGENT",
        "config": {
          "agentId": "agent-id",
          "inputMapping": {
            "query": "$variables.userInput"
          }
        },
        "position": { "x": 200, "y": 0 }
      },
      {
        "id": "tool-1",
        "type": "TOOL",
        "config": {
          "toolId": "tool-id"
        },
        "position": { "x": 400, "y": 0 }
      },
      {
        "id": "end",
        "type": "END",
        "config": {},
        "position": { "x": 600, "y": 0 }
      }
    ],
    "edges": [
      {
        "id": "e1",
        "source": "start",
        "target": "agent-1"
      },
      {
        "id": "e2",
        "source": "agent-1",
        "target": "tool-1"
      },
      {
        "id": "e3",
        "source": "tool-1",
        "target": "end"
      }
    ],
    "version": 1
  },
  "status": "ACTIVE"
}
```

## Node Types

### START
Entry point of the workflow. Required, must have exactly one.

### END
Exit point of the workflow. Required, must have at least one.

### AGENT
Executes an AI agent via agent-service.
```json
{
  "type": "AGENT",
  "config": {
    "agentId": "agent-id",
    "retry": true
  }
}
```

### TOOL
Executes a tool via tool-service.
```json
{
  "type": "TOOL",
  "config": {
    "toolId": "tool-id",
    "retry": true
  }
}
```

### CONDITIONAL
Evaluates conditions to determine flow.
```json
{
  "type": "CONDITIONAL",
  "config": {}
}
```

### TRANSFORM
Transforms data between nodes.
```json
{
  "type": "TRANSFORM",
  "config": {
    "script": "return { result: data.value * 2 }"
  }
}
```

## Testing

```bash
# Run unit tests
pnpm test

# Run tests with coverage
pnpm test:cov

# Run e2e tests
pnpm test:e2e
```

## Docker

Build and run with Docker:

```bash
# Build image
docker build -t orchestration-service .

# Run container
docker run -p 3001:3001 \
  -e DATABASE_URL=postgresql://user:password@host:5432/db \
  -e AGENT_SERVICE_URL=http://agent-service:3002 \
  -e TOOL_SERVICE_URL=http://tool-sandbox-rs:3006 \
  orchestration-service
```

## API Documentation

Once the service is running, API documentation is available at:

- Swagger UI: `http://localhost:3001/api`

## Dependencies

- **@nestjs/core**: NestJS framework
- **@nestjs/websockets**: WebSocket support
- **@nestjs/axios**: HTTP client
- **@prisma/client**: Database ORM
- **socket.io**: WebSocket library
- **class-validator**: Request validation
- **@multi-agent/types**: Shared types
- **@multi-agent/common**: Shared utilities

## License

MIT

---

## Gmail Watch — Real-Time Email Push Trigger / Déclencheur Email en Temps Réel

> **EN** — This feature enables workflows to be triggered automatically the moment a new email arrives in a Gmail inbox, using Gmail's push notification API via Google Cloud Pub/Sub.
>
> **FR** — Cette fonctionnalité permet de déclencher automatiquement un workflow dès qu'un nouvel email arrive dans une boîte Gmail, via l'API Gmail push notification et Google Cloud Pub/Sub.

---

### Architecture Overview / Vue d'ensemble

```
Gmail Inbox
    │  (new email)
    ▼
Gmail API (users.watch)
    │  push notification
    ▼
Google Cloud Pub/Sub Topic
    │  HTTP POST push delivery
    ▼
orchestration-service  POST /api/webhooks/gmail/push
    │  lookup GmailWatchSubscription
    ▼
ExecuteWorkflowUseCase → fires matched workflow(s)
    │  with input: { trigger, gmailUser, historyId, labelIds }
    ▼
Workflow: [START] → [EMAIL: fetch] → [AGENT: analyze] → [EMAIL: send] → [END]
```

---

### Step 1 — Google Cloud Setup / Configuration Google Cloud

**EN:**
1. Go to [Google Cloud Console](https://console.cloud.google.com/) → **APIs & Services** → **Library**
2. Enable **Gmail API**
3. Go to **APIs & Services** → **Credentials** → **Create credentials** → **OAuth 2.0 Client ID**
   - Application type: `Web application`
   - Add `http://localhost` as an authorized redirect URI (for local token generation)
4. Download the JSON credentials and note `client_id` and `client_secret`
5. Go to **Pub/Sub** → **Topics** → **Create topic**, name it (e.g. `gmail-push`)
6. Go to **Pub/Sub** → **Subscriptions** → **Create subscription**:
   - Delivery type: **Push**
   - Endpoint URL: `https://your-orchestration-host/api/webhooks/gmail/push`
   - Enable **authentication** (recommended — add token to URL as query param)
7. Grant the Gmail service account publish rights on your topic:
   - Add `gmail-api-push@system.gserviceaccount.com` as **Pub/Sub Publisher** on the topic

**FR:**
1. Allez sur [Google Cloud Console](https://console.cloud.google.com/) → **APIs & Services** → **Bibliothèque**
2. Activez **l'API Gmail**
3. Allez dans **APIs & Services** → **Identifiants** → **Créer des identifiants** → **ID client OAuth 2.0**
   - Type : `Application Web`
   - Ajoutez `http://localhost` comme URI de redirection autorisée
4. Téléchargez le JSON et notez `client_id` et `client_secret`
5. Allez dans **Pub/Sub** → **Sujets** → **Créer un sujet** (ex. `gmail-push`)
6. Allez dans **Pub/Sub** → **Abonnements** → **Créer un abonnement** :
   - Type : **Push**
   - URL de point de terminaison : `https://votre-hôte-orchestration/api/webhooks/gmail/push`
7. Accordez à `gmail-api-push@system.gserviceaccount.com` le rôle **Éditeur Pub/Sub** sur le sujet

---

### Step 2 — Generate a Refresh Token / Générer un Refresh Token

**EN:** Use the OAuth2 Playground or the `googleapis` library to exchange an authorization code for a refresh token. Scopes needed: `https://www.googleapis.com/auth/gmail.modify`

```bash
# Quick token generation via Google OAuth2 Playground:
# 1. Open https://developers.google.com/oauthplayground/
# 2. Click Settings (gear icon) → Use your own OAuth credentials → enter client_id + client_secret
# 3. Select scope: https://www.googleapis.com/auth/gmail.modify
# 4. Click "Authorize APIs" → "Exchange authorization code for tokens"
# 5. Copy the refresh_token value
```

**FR :** Utilisez le Playground OAuth2 ou la bibliothèque `googleapis` pour échanger un code d'autorisation contre un refresh token. Scope requis : `https://www.googleapis.com/auth/gmail.modify`

---

### Step 3 — Environment Variables / Variables d'environnement

#### `services/email-mcp-service/.env`

```env
# Gmail Watch — OAuth2 credentials (required for gmail_watch / gmail_stop_watch tools)
GMAIL_CLIENT_ID=<your-google-oauth2-client-id>
GMAIL_CLIENT_SECRET=<your-google-oauth2-client-secret>
```

#### `services/orchestration-service/.env`

```env
# Gmail Webhook — optional secret for Pub/Sub push authentication
# Set the same value as the token appended to your Pub/Sub push endpoint URL
GMAIL_WEBHOOK_SECRET=<random-secret-string>
```

---

### Step 4 — Register the Watch / Enregistrer le Watch

**Step 4a — Call `gmail_watch` on email-mcp-service (port 3012):**

```bash
curl -X POST http://localhost:3012/api/mcp \
  -H 'Content-Type: application/json' \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "gmail_watch",
      "arguments": {
        "refreshToken": "<your-refresh-token>",
        "topicName": "projects/<gcp-project-id>/topics/gmail-push",
        "labelIds": "INBOX"
      }
    }
  }'
```

Response will contain `historyId` and `expiration` (Unix ms, max 7 days):
```json
{
  "content": [{
    "type": "text",
    "text": "{ \"success\": true, \"historyId\": \"12345\", \"expiration\": \"1748000000000\", \"expiresAt\": \"2026-05-22T...\" }"
  }]
}
```

**Step 4b — Register the subscription in orchestration-service:**

```bash
curl -X POST http://localhost:3003/api/webhooks/gmail/subscriptions \
  -H 'Content-Type: application/json' \
  -d '{
    "workflowId": "<your-workflow-id>",
    "userId": "<your-user-id>",
    "gmailUser": "you@gmail.com",
    "topicName": "projects/<gcp-project-id>/topics/gmail-push",
    "labelIds": ["INBOX"],
    "historyId": "12345",
    "expiration": "1748000000000"
  }'
```

---

### Step 5 — Build the Email Analysis Workflow / Construire le Workflow

Build this topology in the UI (or via API):

```
[START] → [EMAIL: fetch] → [AGENT: analyze] → [EMAIL: send] → [END]
```

| Node | Type | Key Config |
|---|---|---|
| Start | `START` | — |
| Fetch Email | `EMAIL` | `action=fetch`, `query=is:unread`, `limit=1` |
| Analyze | `AGENT` | `outputFormat=json`, `outputKey=reply` |
| Send Reply | `EMAIL` | `action=send`, `to={{reply.to}}`, `subject={{reply.subject}}`, `body={{reply.body}}` |
| End | `END` | — |

The workflow's `inputSchema` should declare:
```json
[
  { "key": "gmailUser",         "type": "string" },
  { "key": "historyId",         "type": "string" },
  { "key": "previousHistoryId", "type": "string" },
  { "key": "labelIds",          "type": "array"  }
]
```

> **EN:** When the push arrives, the orchestration service injects `{ trigger: "gmail_watch", gmailUser, historyId, previousHistoryId, labelIds }` as the workflow input so the EMAIL fetch node can target the right account and messages.
>
> **FR :** Lorsque la notification push arrive, le service d'orchestration injecte `{ trigger: "gmail_watch", gmailUser, historyId, previousHistoryId, labelIds }` comme entrée du workflow afin que le nœud EMAIL puisse cibler le bon compte et les bons messages.

---

### Step 6 — Stop the Watch / Arrêter le Watch

**Stop Gmail API watch:**
```bash
curl -X POST http://localhost:3012/api/mcp \
  -H 'Content-Type: application/json' \
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/call",
    "params": {
      "name": "gmail_stop_watch",
      "arguments": { "refreshToken": "<your-refresh-token>" }
    }
  }'
```

**Unregister in orchestration-service:**
```bash
curl -X DELETE http://localhost:3003/api/webhooks/gmail/subscriptions \
  -H 'Content-Type: application/json' \
  -d '{ "workflowId": "<workflow-id>", "gmailUser": "you@gmail.com" }'
```

---

### Watch Renewal / Renouvellement du Watch

> **EN:** Google's watch subscriptions expire after **7 days maximum**. You must renew by calling `gmail_watch` again and then calling `POST /api/webhooks/gmail/subscriptions` with the new `historyId` and `expiration`. The upsert logic ensures no duplicate subscriptions are created.
>
> Set up a cron job or scheduled workflow to renew every ~6 days:
>
> **FR :** Les abonnements Google expirent après **7 jours maximum**. Renouvelez en rappelant `gmail_watch`, puis `POST /api/webhooks/gmail/subscriptions` avec le nouveau `historyId` et `expiration`. La logique upsert garantit qu'il n'y a pas de doublon.
>
> Configurez un cron ou un workflow planifié pour renouveler toutes les ~6 jours.

```bash
# Example cron (every 6 days at 02:00)
0 2 */6 * * curl -X POST http://localhost:3003/api/webhooks/gmail/subscriptions \
  -H 'Content-Type: application/json' \
  -d '{ "workflowId": "...", "userId": "...", "gmailUser": "...", ... }'
```

---

### Webhook API Reference / Référence API Webhook

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/webhooks/gmail/push` | Pub/Sub push receiver (called by Google) |
| `POST` | `/api/webhooks/gmail/subscriptions` | Register/update a watch→workflow mapping |
| `DELETE` | `/api/webhooks/gmail/subscriptions` | Deactivate a subscription |
| `GET` | `/api/webhooks/gmail/subscriptions/:workflowId` | List subscriptions for a workflow |

---

### Makefile Targets / Commandes Make

```bash
make dev-email-mcp       # Start email-mcp-service (port 3012)
make test-email-mcp      # Run email-mcp-service tests
make test-gmail-webhook  # Smoke-test the Gmail push webhook endpoint
make test-orchestration  # Run all orchestration-service tests (includes gmail tests)
```

---

### Database / Base de données

A new table `gmail_watch_subscriptions` is created by migration `20260508171616_add_gmail_watch_subscriptions`.

| Column | Type | Description |
|---|---|---|
| `id` | UUID | Primary key |
| `workflowId` | String | Workflow to trigger |
| `userId` | String | User who owns the workflow |
| `gmailUser` | String | Gmail address being watched |
| `topicName` | String | Pub/Sub topic name |
| `labelIds` | JSON | Label IDs filter (default `["INBOX"]`) |
| `historyId` | String? | Last processed Gmail historyId |
| `expiration` | String? | Unix ms expiry from Gmail API |
| `isActive` | Boolean | Whether the subscription is active |

---

### Files Added / Fichiers ajoutés

| Service | File | Purpose |
|---|---|---|
| `email-mcp-service` | `src/infrastructure/email/gmail-watch.service.ts` | Gmail API OAuth2 watch/stop |
| `email-mcp-service` | `src/presentation/tools/gmail-watch.tool.ts` | MCP tool `gmail_watch` |
| `email-mcp-service` | `src/presentation/tools/gmail-stop-watch.tool.ts` | MCP tool `gmail_stop_watch` |
| `orchestration-service` | `src/domain/services/gmail-trigger.service.ts` | Subscription registry (DB) |
| `orchestration-service` | `src/application/dto/gmail-webhook.dto.ts` | Request/response DTOs |
| `orchestration-service` | `src/presentation/controllers/gmail-webhook.controller.ts` | Webhook + subscription API |
| `orchestration-service` | `src/domain/services/gmail-trigger.service.spec.ts` | Unit tests (8 tests) |
| `orchestration-service` | `src/presentation/controllers/gmail-webhook.controller.spec.ts` | Unit tests (6 tests) |
| `packages/database` | `prisma/migrations/20260508171616_add_gmail_watch_subscriptions/` | DB migration |

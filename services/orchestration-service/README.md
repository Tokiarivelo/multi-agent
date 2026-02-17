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
TOOL_SERVICE_URL=http://localhost:3003
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
  -e TOOL_SERVICE_URL=http://tool-service:3003 \
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

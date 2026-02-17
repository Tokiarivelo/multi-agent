# API Documentation

## Table of Contents

- [Overview](#overview)
- [Authentication](#authentication)
- [Error Handling](#error-handling)
- [Gateway Service API](#gateway-service-api)
- [Agent Service API](#agent-service-api)
- [Orchestration Service API](#orchestration-service-api)
- [Execution Service API](#execution-service-api)
- [Model Service API](#model-service-api)
- [Tool Service API](#tool-service-api)
- [Vector Service API](#vector-service-api)
- [WebSocket Events](#websocket-events)

## Overview

The Multi-Agent Platform exposes RESTful APIs and WebSocket connections for real-time communication.

### Base URLs

- **Local Development**:
  - Gateway: `http://localhost:3000`
  - Agent: `http://localhost:3002`
  - Orchestration: `http://localhost:3003`
  - Execution: `http://localhost:3004`
  - Model: `http://localhost:3005`
  - Tool: `http://localhost:3006`
  - Vector: `http://localhost:3007`

- **Production**: Configure via environment variables

### Swagger Documentation

Interactive API documentation is available at:
- **Gateway**: `http://localhost:3000/api`

## Authentication

### JWT Bearer Token

All protected endpoints require a JWT token in the Authorization header:

```bash
Authorization: Bearer <access_token>
```

### Register a New User

**Endpoint**: `POST /auth/register`

**Request**:
```json
{
  "email": "user@example.com",
  "password": "securePassword123",
  "firstName": "John",
  "lastName": "Doe"
}
```

**Response** (201):
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "firstName": "John",
  "lastName": "Doe",
  "role": "USER",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

### Login

**Endpoint**: `POST /auth/login`

**Request**:
```json
{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

**Response** (200):
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "role": "USER"
  }
}
```

### Get Current User

**Endpoint**: `GET /auth/me`

**Headers**: `Authorization: Bearer <token>`

**Response** (200):
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "firstName": "John",
  "lastName": "Doe",
  "role": "USER"
}
```

## Error Handling

### Standard Error Response

```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "error": "Bad Request",
  "details": [
    {
      "field": "email",
      "message": "Invalid email format"
    }
  ]
}
```

### HTTP Status Codes

- **200 OK**: Successful request
- **201 Created**: Resource created successfully
- **400 Bad Request**: Invalid request data
- **401 Unauthorized**: Missing or invalid authentication
- **403 Forbidden**: Insufficient permissions
- **404 Not Found**: Resource not found
- **409 Conflict**: Resource already exists
- **422 Unprocessable Entity**: Validation failed
- **500 Internal Server Error**: Server error

## Gateway Service API

### Users

#### List Users (Admin Only)

**Endpoint**: `GET /users`

**Headers**: `Authorization: Bearer <admin_token>`

**Query Parameters**:
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10)

**Response** (200):
```json
{
  "data": [
    {
      "id": "uuid",
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "role": "USER"
    }
  ],
  "meta": {
    "total": 100,
    "page": 1,
    "limit": 10,
    "totalPages": 10
  }
}
```

#### Get User by ID

**Endpoint**: `GET /users/:id`

**Headers**: `Authorization: Bearer <token>`

**Response** (200):
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "firstName": "John",
  "lastName": "Doe",
  "role": "USER",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

#### Update User

**Endpoint**: `PATCH /users/:id`

**Headers**: `Authorization: Bearer <token>`

**Request**:
```json
{
  "firstName": "Jane",
  "lastName": "Smith"
}
```

**Response** (200):
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "firstName": "Jane",
  "lastName": "Smith",
  "role": "USER"
}
```

#### Delete User (Admin Only)

**Endpoint**: `DELETE /users/:id`

**Headers**: `Authorization: Bearer <admin_token>`

**Response** (204): No content

## Agent Service API

### Agents

#### Create Agent

**Endpoint**: `POST /agents`

**Headers**: `Authorization: Bearer <token>`

**Request**:
```json
{
  "name": "Customer Support Agent",
  "description": "AI agent for customer support",
  "systemPrompt": "You are a helpful customer support agent. Be friendly and professional.",
  "modelId": "gpt-4",
  "temperature": 0.7,
  "maxTokens": 2000,
  "toolIds": ["tool-id-1", "tool-id-2"]
}
```

**Response** (201):
```json
{
  "id": "agent-uuid",
  "name": "Customer Support Agent",
  "description": "AI agent for customer support",
  "systemPrompt": "You are a helpful customer support agent.",
  "modelId": "gpt-4",
  "temperature": 0.7,
  "maxTokens": 2000,
  "userId": "user-uuid",
  "tools": [
    {
      "id": "tool-id-1",
      "name": "Web Search"
    }
  ],
  "createdAt": "2024-01-01T00:00:00.000Z"
}
```

#### List Agents

**Endpoint**: `GET /agents`

**Headers**: `Authorization: Bearer <token>`

**Query Parameters**:
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10)
- `search` (optional): Search by name or description

**Response** (200):
```json
{
  "data": [
    {
      "id": "agent-uuid",
      "name": "Customer Support Agent",
      "description": "AI agent for customer support",
      "modelId": "gpt-4"
    }
  ],
  "meta": {
    "total": 5,
    "page": 1,
    "limit": 10
  }
}
```

#### Get Agent by ID

**Endpoint**: `GET /agents/:id`

**Headers**: `Authorization: Bearer <token>`

**Response** (200):
```json
{
  "id": "agent-uuid",
  "name": "Customer Support Agent",
  "description": "AI agent for customer support",
  "systemPrompt": "You are a helpful customer support agent.",
  "modelId": "gpt-4",
  "temperature": 0.7,
  "maxTokens": 2000,
  "userId": "user-uuid",
  "tools": [
    {
      "id": "tool-id-1",
      "name": "Web Search",
      "category": "WEB"
    }
  ],
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

#### Update Agent

**Endpoint**: `PATCH /agents/:id`

**Headers**: `Authorization: Bearer <token>`

**Request**:
```json
{
  "name": "Updated Agent Name",
  "temperature": 0.8
}
```

**Response** (200):
```json
{
  "id": "agent-uuid",
  "name": "Updated Agent Name",
  "temperature": 0.8
}
```

#### Delete Agent

**Endpoint**: `DELETE /agents/:id`

**Headers**: `Authorization: Bearer <token>`

**Response** (204): No content

#### Execute Agent (HTTP)

**Endpoint**: `POST /agents/:id/execute`

**Headers**: `Authorization: Bearer <token>`

**Request**:
```json
{
  "input": "What is the weather in San Francisco?",
  "conversationId": "optional-conversation-id"
}
```

**Response** (200):
```json
{
  "output": "The current weather in San Francisco is sunny with a temperature of 72°F...",
  "conversationId": "conversation-uuid",
  "tokensUsed": 150,
  "executionTime": 2500
}
```

#### Execute Agent (WebSocket - Streaming)

See [WebSocket Events](#websocket-events) section.

## Orchestration Service API

### Workflows

#### Create Workflow

**Endpoint**: `POST /workflows`

**Headers**: `Authorization: Bearer <token>`

**Request**:
```json
{
  "name": "Customer Onboarding",
  "description": "Automated customer onboarding workflow",
  "graph": {
    "nodes": [
      {
        "id": "node-1",
        "type": "agent",
        "agentId": "agent-uuid",
        "input": "Welcome the user"
      },
      {
        "id": "node-2",
        "type": "tool",
        "toolId": "tool-uuid",
        "input": "{{ node-1.output }}"
      }
    ],
    "edges": [
      {
        "source": "node-1",
        "target": "node-2"
      }
    ]
  }
}
```

**Response** (201):
```json
{
  "id": "workflow-uuid",
  "name": "Customer Onboarding",
  "description": "Automated customer onboarding workflow",
  "graph": { ... },
  "status": "DRAFT",
  "userId": "user-uuid",
  "createdAt": "2024-01-01T00:00:00.000Z"
}
```

#### List Workflows

**Endpoint**: `GET /workflows`

**Headers**: `Authorization: Bearer <token>`

**Query Parameters**:
- `page` (optional): Page number
- `limit` (optional): Items per page
- `status` (optional): Filter by status (DRAFT, ACTIVE, ARCHIVED)

**Response** (200):
```json
{
  "data": [
    {
      "id": "workflow-uuid",
      "name": "Customer Onboarding",
      "description": "Automated customer onboarding workflow",
      "status": "ACTIVE"
    }
  ],
  "meta": {
    "total": 10,
    "page": 1,
    "limit": 10
  }
}
```

#### Get Workflow by ID

**Endpoint**: `GET /workflows/:id`

**Headers**: `Authorization: Bearer <token>`

**Response** (200):
```json
{
  "id": "workflow-uuid",
  "name": "Customer Onboarding",
  "description": "Automated customer onboarding workflow",
  "graph": {
    "nodes": [...],
    "edges": [...]
  },
  "status": "ACTIVE",
  "userId": "user-uuid",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

#### Update Workflow

**Endpoint**: `PATCH /workflows/:id`

**Headers**: `Authorization: Bearer <token>`

**Request**:
```json
{
  "name": "Updated Workflow Name",
  "status": "ACTIVE"
}
```

**Response** (200):
```json
{
  "id": "workflow-uuid",
  "name": "Updated Workflow Name",
  "status": "ACTIVE"
}
```

#### Delete Workflow

**Endpoint**: `DELETE /workflows/:id`

**Headers**: `Authorization: Bearer <token>`

**Response** (204): No content

#### Execute Workflow

**Endpoint**: `POST /workflows/:id/execute`

**Headers**: `Authorization: Bearer <token>`

**Request**:
```json
{
  "input": {
    "userId": "123",
    "email": "user@example.com"
  }
}
```

**Response** (200):
```json
{
  "executionId": "execution-uuid",
  "workflowId": "workflow-uuid",
  "status": "RUNNING",
  "startedAt": "2024-01-01T00:00:00.000Z"
}
```

## Execution Service API

### Executions

#### Get Execution by ID

**Endpoint**: `GET /executions/:id`

**Headers**: `Authorization: Bearer <token>`

**Response** (200):
```json
{
  "id": "execution-uuid",
  "workflowId": "workflow-uuid",
  "status": "COMPLETED",
  "input": { ... },
  "output": { ... },
  "startedAt": "2024-01-01T00:00:00.000Z",
  "completedAt": "2024-01-01T00:00:10.000Z",
  "executionTime": 10000,
  "logs": [
    {
      "id": "log-uuid",
      "nodeId": "node-1",
      "nodeName": "Welcome Agent",
      "status": "COMPLETED",
      "input": { ... },
      "output": { ... },
      "startedAt": "2024-01-01T00:00:00.000Z",
      "completedAt": "2024-01-01T00:00:05.000Z",
      "executionTime": 5000
    }
  ]
}
```

#### List Executions

**Endpoint**: `GET /executions`

**Headers**: `Authorization: Bearer <token>`

**Query Parameters**:
- `workflowId` (optional): Filter by workflow
- `status` (optional): Filter by status
- `page` (optional): Page number
- `limit` (optional): Items per page

**Response** (200):
```json
{
  "data": [
    {
      "id": "execution-uuid",
      "workflowId": "workflow-uuid",
      "status": "COMPLETED",
      "startedAt": "2024-01-01T00:00:00.000Z",
      "executionTime": 10000
    }
  ],
  "meta": {
    "total": 50,
    "page": 1,
    "limit": 10
  }
}
```

#### Get Execution Logs

**Endpoint**: `GET /executions/:id/logs`

**Headers**: `Authorization: Bearer <token>`

**Response** (200):
```json
{
  "executionId": "execution-uuid",
  "logs": [
    {
      "id": "log-uuid",
      "nodeId": "node-1",
      "nodeName": "Welcome Agent",
      "status": "COMPLETED",
      "input": { ... },
      "output": { ... },
      "error": null,
      "startedAt": "2024-01-01T00:00:00.000Z",
      "completedAt": "2024-01-01T00:00:05.000Z",
      "executionTime": 5000
    }
  ]
}
```

## Model Service API

### Models

#### Create Model Configuration

**Endpoint**: `POST /models`

**Headers**: `Authorization: Bearer <token>`

**Request**:
```json
{
  "name": "GPT-4 Turbo",
  "provider": "OPENAI",
  "modelId": "gpt-4-turbo-preview",
  "maxTokens": 4096,
  "supportsStreaming": true,
  "supportsFunctions": true
}
```

**Response** (201):
```json
{
  "id": "model-uuid",
  "name": "GPT-4 Turbo",
  "provider": "OPENAI",
  "modelId": "gpt-4-turbo-preview",
  "maxTokens": 4096,
  "supportsStreaming": true,
  "supportsFunctions": true,
  "createdAt": "2024-01-01T00:00:00.000Z"
}
```

#### List Models

**Endpoint**: `GET /models`

**Headers**: `Authorization: Bearer <token>`

**Query Parameters**:
- `provider` (optional): Filter by provider (OPENAI, ANTHROPIC, GOOGLE, etc.)

**Response** (200):
```json
{
  "data": [
    {
      "id": "model-uuid",
      "name": "GPT-4 Turbo",
      "provider": "OPENAI",
      "modelId": "gpt-4-turbo-preview"
    }
  ]
}
```

### API Keys

#### Add API Key

**Endpoint**: `POST /api-keys`

**Headers**: `Authorization: Bearer <token>`

**Request**:
```json
{
  "provider": "OPENAI",
  "apiKey": "sk-proj-..."
}
```

**Response** (201):
```json
{
  "id": "api-key-uuid",
  "provider": "OPENAI",
  "userId": "user-uuid",
  "createdAt": "2024-01-01T00:00:00.000Z"
}
```

**Note**: The API key is never returned in plain text after creation.

#### List API Keys

**Endpoint**: `GET /api-keys`

**Headers**: `Authorization: Bearer <token>`

**Response** (200):
```json
{
  "data": [
    {
      "id": "api-key-uuid",
      "provider": "OPENAI",
      "userId": "user-uuid",
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

#### Delete API Key

**Endpoint**: `DELETE /api-keys/:id`

**Headers**: `Authorization: Bearer <token>`

**Response** (204): No content

## Tool Service API

### Tools

#### Register Tool

**Endpoint**: `POST /tools`

**Headers**: `Authorization: Bearer <token>`

**Request**:
```json
{
  "name": "Weather API",
  "description": "Get current weather information",
  "category": "API",
  "parameters": {
    "type": "object",
    "properties": {
      "location": {
        "type": "string",
        "description": "City name"
      }
    },
    "required": ["location"]
  },
  "implementation": "async function execute({ location }) { ... }"
}
```

**Response** (201):
```json
{
  "id": "tool-uuid",
  "name": "Weather API",
  "description": "Get current weather information",
  "category": "API",
  "parameters": { ... },
  "userId": "user-uuid",
  "createdAt": "2024-01-01T00:00:00.000Z"
}
```

#### List Tools

**Endpoint**: `GET /tools`

**Headers**: `Authorization: Bearer <token>`

**Query Parameters**:
- `category` (optional): Filter by category (WEB, API, DATABASE, FILE, CUSTOM)

**Response** (200):
```json
{
  "data": [
    {
      "id": "tool-uuid",
      "name": "Weather API",
      "description": "Get current weather information",
      "category": "API"
    }
  ]
}
```

#### Execute Tool

**Endpoint**: `POST /tools/:id/execute`

**Headers**: `Authorization: Bearer <token>`

**Request**:
```json
{
  "parameters": {
    "location": "San Francisco"
  }
}
```

**Response** (200):
```json
{
  "result": {
    "temperature": 72,
    "condition": "Sunny",
    "humidity": 60
  },
  "executionTime": 1500
}
```

## Vector Service API

### Vector Collections

#### Create Collection

**Endpoint**: `POST /collections`

**Headers**: `Authorization: Bearer <token>`

**Request**:
```json
{
  "name": "Customer Documents",
  "description": "Vector embeddings for customer documents",
  "dimension": 1536
}
```

**Response** (201):
```json
{
  "id": "collection-uuid",
  "name": "Customer Documents",
  "description": "Vector embeddings for customer documents",
  "dimension": 1536,
  "userId": "user-uuid",
  "createdAt": "2024-01-01T00:00:00.000Z"
}
```

#### List Collections

**Endpoint**: `GET /collections`

**Headers**: `Authorization: Bearer <token>`

**Response** (200):
```json
{
  "data": [
    {
      "id": "collection-uuid",
      "name": "Customer Documents",
      "dimension": 1536,
      "vectorCount": 1000
    }
  ]
}
```

#### Upsert Vectors

**Endpoint**: `POST /collections/:id/vectors`

**Headers**: `Authorization: Bearer <token>`

**Request**:
```json
{
  "vectors": [
    {
      "id": "doc-1",
      "vector": [0.1, 0.2, 0.3, ...],
      "metadata": {
        "title": "Product Documentation",
        "content": "..."
      }
    }
  ]
}
```

**Response** (200):
```json
{
  "upserted": 1
}
```

#### Search Vectors

**Endpoint**: `POST /collections/:id/search`

**Headers**: `Authorization: Bearer <token>`

**Request**:
```json
{
  "vector": [0.1, 0.2, 0.3, ...],
  "limit": 10,
  "scoreThreshold": 0.7
}
```

**Response** (200):
```json
{
  "results": [
    {
      "id": "doc-1",
      "score": 0.95,
      "metadata": {
        "title": "Product Documentation",
        "content": "..."
      }
    }
  ]
}
```

## WebSocket Events

### Agent Execution (Streaming)

**Connection**: `ws://localhost:3002`

**Namespace**: `/agents`

#### Client Events

##### Execute Agent
```typescript
socket.emit('executeAgent', {
  agentId: 'agent-uuid',
  input: 'What is the weather today?',
  conversationId: 'optional-conversation-id'
});
```

#### Server Events

##### Agent Token (Streaming)
```typescript
socket.on('agentToken', (data) => {
  console.log(data);
  // {
  //   token: 'The',
  //   conversationId: 'conversation-uuid'
  // }
});
```

##### Agent Complete
```typescript
socket.on('agentComplete', (data) => {
  console.log(data);
  // {
  //   output: 'The weather today is sunny...',
  //   conversationId: 'conversation-uuid',
  //   tokensUsed: 150,
  //   executionTime: 2500
  // }
});
```

##### Agent Error
```typescript
socket.on('agentError', (error) => {
  console.error(error);
  // {
  //   message: 'Error message',
  //   conversationId: 'conversation-uuid'
  // }
});
```

### Workflow Execution (Real-time Updates)

**Connection**: `ws://localhost:3003`

**Namespace**: `/workflows`

#### Client Events

##### Execute Workflow
```typescript
socket.emit('executeWorkflow', {
  workflowId: 'workflow-uuid',
  input: { userId: '123' }
});
```

#### Server Events

##### Workflow Started
```typescript
socket.on('workflowStarted', (data) => {
  // {
  //   executionId: 'execution-uuid',
  //   workflowId: 'workflow-uuid',
  //   startedAt: '2024-01-01T00:00:00.000Z'
  // }
});
```

##### Node Started
```typescript
socket.on('nodeStarted', (data) => {
  // {
  //   executionId: 'execution-uuid',
  //   nodeId: 'node-1',
  //   nodeName: 'Welcome Agent'
  // }
});
```

##### Node Completed
```typescript
socket.on('nodeCompleted', (data) => {
  // {
  //   executionId: 'execution-uuid',
  //   nodeId: 'node-1',
  //   output: { ... }
  // }
});
```

##### Workflow Completed
```typescript
socket.on('workflowCompleted', (data) => {
  // {
  //   executionId: 'execution-uuid',
  //   output: { ... },
  //   executionTime: 10000
  // }
});
```

##### Workflow Error
```typescript
socket.on('workflowError', (error) => {
  // {
  //   executionId: 'execution-uuid',
  //   message: 'Error message'
  // }
});
```

---

**Last Updated**: 2024
**Version**: 1.0.0

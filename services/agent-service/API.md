# Agent Service API Documentation

## Base URL
```
http://localhost:3002/api
```

## Authentication
Currently, the API does not require authentication. This will be added in future versions.

---

## Endpoints

### Health Check

#### GET /health
Check service health status.

**Response**
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "service": "agent-service"
}
```

---

### Agents

#### POST /agents
Create a new agent.

**Request Body**
```json
{
  "name": "string (required)",
  "description": "string (optional)",
  "modelId": "string (required)",
  "systemPrompt": "string (optional)",
  "temperature": "number (optional, 0-2, default: 0.7)",
  "maxTokens": "number (optional, min: 1, default: 2000)",
  "tools": ["string"] (optional),
  "metadata": {} (optional)
}
```

**Response** (201 Created)
```json
{
  "id": "uuid",
  "name": "Code Assistant",
  "description": "Helps with coding tasks",
  "modelId": "gpt-4",
  "systemPrompt": "You are a helpful assistant",
  "temperature": 0.7,
  "maxTokens": 2000,
  "tools": ["code-search"],
  "metadata": {},
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

**Error Responses**
- `400 Bad Request` - Invalid input data
- `500 Internal Server Error` - Server error

---

#### GET /agents
List all agents with optional filters.

**Query Parameters**
- `name` (string, optional) - Filter by agent name (case-insensitive)
- `modelId` (string, optional) - Filter by model ID
- `limit` (number, optional) - Limit number of results
- `offset` (number, optional) - Offset for pagination

**Example**
```
GET /agents?name=Code&limit=10&offset=0
```

**Response** (200 OK)
```json
[
  {
    "id": "uuid",
    "name": "Code Assistant",
    "description": "Helps with coding tasks",
    "modelId": "gpt-4",
    "systemPrompt": "You are a helpful assistant",
    "temperature": 0.7,
    "maxTokens": 2000,
    "tools": ["code-search"],
    "metadata": {},
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
]
```

---

#### GET /agents/:id
Get a specific agent by ID.

**Parameters**
- `id` (string, required) - Agent UUID

**Response** (200 OK)
```json
{
  "id": "uuid",
  "name": "Code Assistant",
  "description": "Helps with coding tasks",
  "modelId": "gpt-4",
  "systemPrompt": "You are a helpful assistant",
  "temperature": 0.7,
  "maxTokens": 2000,
  "tools": ["code-search"],
  "metadata": {},
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

**Error Responses**
- `404 Not Found` - Agent not found

---

#### PUT /agents/:id
Update an existing agent.

**Parameters**
- `id` (string, required) - Agent UUID

**Request Body** (all fields optional)
```json
{
  "name": "string",
  "description": "string",
  "modelId": "string",
  "systemPrompt": "string",
  "temperature": "number (0-2)",
  "maxTokens": "number",
  "tools": ["string"],
  "metadata": {}
}
```

**Response** (200 OK)
```json
{
  "id": "uuid",
  "name": "Updated Agent",
  "description": "Updated description",
  "modelId": "gpt-4",
  "systemPrompt": "Updated prompt",
  "temperature": 0.5,
  "maxTokens": 3000,
  "tools": ["code-search", "calculator"],
  "metadata": {},
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:01.000Z"
}
```

**Error Responses**
- `400 Bad Request` - Invalid input data
- `404 Not Found` - Agent not found

---

#### DELETE /agents/:id
Delete an agent.

**Parameters**
- `id` (string, required) - Agent UUID

**Response** (204 No Content)

**Error Responses**
- `404 Not Found` - Agent not found

---

#### POST /agents/:id/execute
Execute an agent with given input (non-streaming).

**Parameters**
- `id` (string, required) - Agent UUID

**Request Body**
```json
{
  "input": "string (required)",
  "conversationHistory": [
    {
      "role": "user | assistant | system",
      "content": "string"
    }
  ] (optional),
  "stream": false,
  "metadata": {} (optional)
}
```

**Response** (200 OK)
```json
{
  "id": "execution-uuid",
  "agentId": "agent-uuid",
  "input": "Write a Python function",
  "output": "Here is a Python function...",
  "tokens": 150,
  "status": "COMPLETED",
  "error": null,
  "startedAt": "2024-01-01T00:00:00.000Z",
  "completedAt": "2024-01-01T00:00:05.000Z"
}
```

**Error Responses**
- `400 Bad Request` - Invalid input or execution failed
- `404 Not Found` - Agent not found

---

## WebSocket API

### Namespace: /agent-execution

#### Event: execute
Execute an agent with streaming output.

**Emit**
```javascript
socket.emit('execute', {
  agentId: "agent-uuid",
  dto: {
    input: "Your prompt here",
    conversationHistory: [],
    stream: true,
    metadata: {}
  }
});
```

**Listen: token**
Receive individual tokens as they are generated.
```javascript
socket.on('token', (data) => {
  console.log(data.token); // "Hello"
});
```

**Listen: complete**
Receive completion notification with full results.
```javascript
socket.on('complete', (result) => {
  console.log(result);
  // {
  //   output: "Full response text",
  //   tokens: 150
  // }
});
```

**Listen: error**
Receive error notifications.
```javascript
socket.on('error', (error) => {
  console.error(error.message);
});
```

#### Event: ping
Ping the server to check connection.

**Emit**
```javascript
socket.emit('ping');
```

**Listen: pong**
```javascript
socket.on('pong', (data) => {
  console.log(data.timestamp);
});
```

---

## Error Response Format

All errors follow this format:

```json
{
  "statusCode": 400,
  "message": "Error message",
  "details": "Additional details (optional)",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "path": "/api/agents"
}
```

### Common Status Codes
- `200 OK` - Request successful
- `201 Created` - Resource created
- `204 No Content` - Resource deleted
- `400 Bad Request` - Invalid request data
- `404 Not Found` - Resource not found
- `429 Too Many Requests` - Rate limit exceeded
- `500 Internal Server Error` - Server error

---

## Rate Limiting

Rate limits are enforced by the LLM providers. The service implements retry logic with exponential backoff.

---

## Data Models

### Agent
```typescript
interface Agent {
  id: string;
  name: string;
  description?: string;
  modelId: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  tools?: string[];
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}
```

### AgentExecution
```typescript
interface AgentExecution {
  id: string;
  agentId: string;
  input: string;
  output?: string;
  tokens?: number;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  error?: string;
  startedAt: Date;
  completedAt?: Date;
}
```

### ConversationMessage
```typescript
interface ConversationMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}
```

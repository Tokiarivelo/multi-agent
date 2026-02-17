# Agent Service

Manages AI agents and executes agent workflows using LangChain with multiple LLM provider support.

## Features

- **Agent CRUD Operations**: Create, read, update, delete, and list AI agents
- **Multi-Provider LLM Support**: OpenAI, Anthropic, Google, Azure, Ollama
- **Real-time Streaming**: WebSocket support for token streaming
- **Tool Integration**: Dynamic tool injection and execution
- **Conversation History**: Maintain context across multiple interactions
- **Clean Architecture**: Proper separation of concerns with DDD principles

## Architecture

```
src/
├── domain/           # Business logic and entities
├── application/      # Use cases and DTOs
├── infrastructure/   # External services and persistence
└── presentation/     # Controllers and WebSocket gateways
```

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL
- pnpm

### Installation

```bash
cd services/agent-service
pnpm install
```

### Configuration

Copy `.env.example` to `.env` and configure:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/agent_service
MODEL_SERVICE_URL=http://localhost:3001
TOOL_SERVICE_URL=http://localhost:3003
PORT=3002
```

### Database Setup

```bash
pnpm run prisma:generate
npx prisma migrate dev --name init
```

### Running

```bash
# Development
pnpm run start:dev

# Production
pnpm run build
pnpm run start:prod
```

## API Endpoints

### REST API

- `POST /api/agents` - Create a new agent
- `GET /api/agents` - List all agents
- `GET /api/agents/:id` - Get agent by ID
- `PUT /api/agents/:id` - Update agent
- `DELETE /api/agents/:id` - Delete agent
- `POST /api/agents/:id/execute` - Execute agent (non-streaming)
- `GET /api/health` - Health check

### WebSocket

Connect to `ws://localhost:3002/agent-execution` for streaming execution:

```javascript
const socket = io('ws://localhost:3002/agent-execution');

socket.emit('execute', {
  agentId: 'agent-id',
  dto: {
    input: 'Your prompt here',
    conversationHistory: [],
    stream: true
  }
});

socket.on('token', (data) => {
  console.log('Token:', data.token);
});

socket.on('complete', (result) => {
  console.log('Complete:', result);
});

socket.on('error', (error) => {
  console.error('Error:', error);
});
```

## Usage Examples

### Create an Agent

```bash
curl -X POST http://localhost:3002/api/agents \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Code Assistant",
    "description": "Helps with coding tasks",
    "modelId": "gpt-4",
    "systemPrompt": "You are a helpful coding assistant.",
    "temperature": 0.7,
    "maxTokens": 2000,
    "tools": ["code-search", "file-reader"]
  }'
```

### Execute an Agent

```bash
curl -X POST http://localhost:3002/api/agents/{agent-id}/execute \
  -H "Content-Type: application/json" \
  -d '{
    "input": "Write a function to sort an array",
    "conversationHistory": [],
    "stream": false
  }'
```

## LLM Providers

### Supported Providers

- **OpenAI**: GPT-3.5, GPT-4, GPT-4-turbo
- **Anthropic**: Claude 2, Claude 3 (Opus, Sonnet, Haiku)
- **Google**: Gemini Pro (coming soon)
- **Azure OpenAI**: (coming soon)
- **Ollama**: Local models (coming soon)

### Provider Configuration

Models and API keys are managed by the model-service. The agent-service fetches configuration dynamically.

## Development

### Project Structure

```
services/agent-service/
├── src/
│   ├── domain/              # Core business logic
│   │   ├── entities/        # Domain entities
│   │   ├── repositories/    # Repository interfaces
│   │   └── services/        # Domain services
│   ├── application/         # Application layer
│   │   ├── use-cases/       # Use case implementations
│   │   ├── dto/             # Data transfer objects
│   │   └── interfaces/      # Application interfaces
│   ├── infrastructure/      # Infrastructure layer
│   │   ├── database/        # Database connection
│   │   ├── persistence/     # Repository implementations
│   │   ├── external/        # External service clients
│   │   └── config/          # Configuration
│   └── presentation/        # Presentation layer
│       ├── controllers/     # REST controllers
│       ├── gateways/        # WebSocket gateways
│       └── filters/         # Exception filters
├── prisma/                  # Database schema
├── package.json
└── tsconfig.json
```

### Testing

```bash
pnpm run test
pnpm run test:watch
pnpm run test:cov
```

### Linting

```bash
pnpm run lint
```

## Error Handling

The service implements comprehensive error handling:

- Validation errors (400)
- Not found errors (404)
- Rate limiting errors (429)
- Internal server errors (500)

All errors are logged and returned in a consistent format.

## Rate Limiting

The service respects rate limits from LLM providers and implements retry logic with exponential backoff.

## Security

- API keys are never exposed in responses
- All sensitive data is encrypted at rest
- Input validation on all endpoints
- CORS configured for production

## License

MIT

# Architecture Documentation

## Table of Contents

- [System Overview](#system-overview)
- [Architectural Principles](#architectural-principles)
- [Microservices Architecture](#microservices-architecture)
- [Event-Driven Architecture](#event-driven-architecture)
- [Clean Architecture](#clean-architecture)
- [Data Flow](#data-flow)
- [Security Architecture](#security-architecture)
- [Scalability & Performance](#scalability--performance)

## System Overview

The Multi-Agent Platform is built on a microservices architecture with event-driven communication, following clean architecture principles and domain-driven design patterns.

### High-Level Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                         Client Layer                          │
│  ┌────────────────┐              ┌──────────────────────┐    │
│  │  Web Browser   │              │   Mobile/Desktop     │    │
│  │   (Next.js)    │              │   (Future Support)   │    │
│  └────────┬───────┘              └──────────┬───────────┘    │
└───────────┼─────────────────────────────────┼────────────────┘
            │                                  │
            │         HTTPS + WebSocket        │
            ▼                                  ▼
┌──────────────────────────────────────────────────────────────┐
│                       API Gateway Layer                       │
│  ┌──────────────────────────────────────────────────────┐    │
│  │              Gateway Service (NestJS)                 │    │
│  │  • JWT Authentication (Passport)                      │    │
│  │  • Authorization (RBAC)                               │    │
│  │  • Request Routing                                    │    │
│  │  • Rate Limiting                                      │    │
│  │  • CORS Configuration                                 │    │
│  └──────────────────────────────────────────────────────┘    │
└───────────┬──────────────────────────────────────────────────┘
            │
            │         Internal Service Mesh
            ▼
┌──────────────────────────────────────────────────────────────┐
│                      Service Layer                            │
│  ┌────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐          │
│  │ Agent  │  │  Orch.  │  │  Exec.  │  │  Model  │          │
│  │ :3002  │  │  :3003  │  │  :3004  │  │  :3005  │          │
│  └────┬───┘  └────┬────┘  └────┬────┘  └────┬────┘          │
│       │           │            │            │                │
│  ┌────┴───┐  ┌───┴────┐                                      │
│  │  Tool  │  │ Vector │                                      │
│  │ :3006  │  │ :3007  │                                      │
│  └────────┘  └────────┘                                      │
└───────────┬──────────────────────────────────────────────────┘
            │
            │         NATS JetStream (Pub/Sub)
            ▼
┌──────────────────────────────────────────────────────────────┐
│                       Data Layer                              │
│  ┌──────────────┐         ┌─────────────┐                    │
│  │  PostgreSQL  │         │   Qdrant    │                    │
│  │   (Prisma)   │         │ (Vectors)   │                    │
│  └──────────────┘         └─────────────┘                    │
└──────────────────────────────────────────────────────────────┘
```

## Architectural Principles

### 1. Microservices Architecture

Each service is:
- **Independent**: Can be developed, deployed, and scaled independently
- **Single Responsibility**: Focused on a specific business capability
- **Technology Agnostic**: Can use different technologies if needed
- **Resilient**: Failure in one service doesn't cascade to others

### 2. Event-Driven Communication

- **Asynchronous**: Services communicate via NATS messages
- **Decoupled**: Services don't need to know about each other
- **Scalable**: Can handle high throughput with message queuing
- **Resilient**: Message persistence ensures no data loss

### 3. Clean Architecture

Each service follows Clean Architecture with layers:
- **Domain**: Business logic and entities (core)
- **Application**: Use cases and business rules
- **Infrastructure**: External dependencies (DB, APIs, messaging)
- **Presentation**: Controllers, WebSocket gateways

### 4. Domain-Driven Design (DDD)

- **Bounded Contexts**: Each service represents a bounded context
- **Aggregates**: Domain entities with clear boundaries
- **Value Objects**: Immutable objects representing domain concepts
- **Domain Events**: Business events that trigger actions

## Microservices Architecture

### Service Descriptions

#### 1. Gateway Service (Port 3000)

**Responsibility**: API Gateway and Authentication

```
┌─────────────────────────────────────┐
│        Gateway Service              │
├─────────────────────────────────────┤
│  Controllers:                       │
│    • AuthController                 │
│    • UserController                 │
│                                     │
│  Services:                          │
│    • AuthService (JWT)              │
│    • UserService                    │
│    • JwtStrategy (Passport)         │
│                                     │
│  Guards:                            │
│    • JwtAuthGuard                   │
│    • RolesGuard                     │
│                                     │
│  Middleware:                        │
│    • RateLimitMiddleware            │
│    • CorsMiddleware                 │
└─────────────────────────────────────┘
```

**Key Features**:
- JWT token generation and validation
- Password hashing with bcrypt
- Role-based access control (ADMIN, USER, VIEWER)
- User management (CRUD)
- Request routing to backend services

**Technology Stack**:
- NestJS 10.3
- Passport JWT
- bcrypt
- class-validator
- Prisma

#### 2. Agent Service (Port 3002)

**Responsibility**: AI Agent Management and Execution

```
┌─────────────────────────────────────┐
│         Agent Service               │
├─────────────────────────────────────┤
│  Domain Layer:                      │
│    • Agent Entity                   │
│    • AgentRepository Interface      │
│                                     │
│  Application Layer:                 │
│    • CreateAgentUseCase             │
│    • ExecuteAgentUseCase            │
│    • ListAgentsUseCase              │
│                                     │
│  Infrastructure Layer:              │
│    • PrismaAgentRepository          │
│    • LangChainService               │
│    • OpenAIProvider                 │
│    • AnthropicProvider              │
│    • GoogleProvider                 │
│                                     │
│  Presentation Layer:                │
│    • AgentController (REST)         │
│    • AgentGateway (WebSocket)       │
└─────────────────────────────────────┘
```

**Key Features**:
- Agent CRUD operations
- LLM integration (OpenAI, Anthropic, Google)
- Tool binding and configuration
- Real-time execution via WebSocket
- Token streaming for responsive UI
- Execution history

**Technology Stack**:
- NestJS 10.3
- LangChain
- OpenAI SDK
- Anthropic SDK
- Google GenAI SDK
- Socket.io
- Prisma

#### 3. Orchestration Service (Port 3003)

**Responsibility**: Workflow Orchestration and Execution

```
┌─────────────────────────────────────┐
│    Orchestration Service            │
├─────────────────────────────────────┤
│  Domain Layer:                      │
│    • Workflow Entity                │
│    • WorkflowNode                   │
│    • WorkflowEdge                   │
│                                     │
│  Application Layer:                 │
│    • CreateWorkflowUseCase          │
│    • ExecuteWorkflowUseCase         │
│    • WorkflowEngine                 │
│                                     │
│  Infrastructure Layer:              │
│    • PrismaWorkflowRepository       │
│    • AgentServiceClient             │
│    • ToolServiceClient              │
│    • ExecutionServiceClient         │
│                                     │
│  Presentation Layer:                │
│    • WorkflowController             │
│    • WorkflowGateway (WebSocket)    │
└─────────────────────────────────────┘
```

**Key Features**:
- DAG-based workflow definition
- Node-based execution graph
- Real-time execution monitoring
- Conditional branching
- Parallel execution
- Error handling and retry logic
- Integration with Agent and Tool services

**Technology Stack**:
- NestJS 10.3
- Socket.io
- Axios (HTTP client)
- Prisma

#### 4. Execution Service (Port 3004)

**Responsibility**: Execution Tracking and Audit Logs

```
┌─────────────────────────────────────┐
│       Execution Service             │
├─────────────────────────────────────┤
│  Domain Layer:                      │
│    • Execution Entity               │
│    • ExecutionLog Entity            │
│                                     │
│  Application Layer:                 │
│    • TrackExecutionUseCase          │
│    • LogExecutionNodeUseCase        │
│    • QueryExecutionLogsUseCase      │
│                                     │
│  Infrastructure Layer:              │
│    • PrismaExecutionRepository      │
│    • NATSEventPublisher             │
│    • NATSEventSubscriber            │
│                                     │
│  Presentation Layer:                │
│    • ExecutionController            │
└─────────────────────────────────────┘
```

**Key Features**:
- Execution status tracking (PENDING, RUNNING, COMPLETED, FAILED)
- Per-node execution logs with timing
- Error tracking and metadata storage
- Event-driven updates via NATS
- Query execution history
- Audit trail

**Technology Stack**:
- NestJS 10.3
- Prisma
- NATS Client

#### 5. Model Service (Port 3005)

**Responsibility**: LLM Provider Management and API Key Encryption

```
┌─────────────────────────────────────┐
│         Model Service               │
├─────────────────────────────────────┤
│  Domain Layer:                      │
│    • Model Entity                   │
│    • ApiKey Entity                  │
│    • EncryptionService Interface    │
│                                     │
│  Application Layer:                 │
│    • CreateModelUseCase             │
│    • AddApiKeyUseCase               │
│    • GetApiKeyUseCase               │
│                                     │
│  Infrastructure Layer:              │
│    • PrismaModelRepository          │
│    • AESEncryptionService           │
│      - AES-256-GCM                  │
│      - scrypt key derivation        │
│      - 32-byte salt                 │
│      - 16-byte IV                   │
│                                     │
│  Presentation Layer:                │
│    • ModelController                │
│    • ApiKeyController               │
└─────────────────────────────────────┘
```

**Key Features**:
- Model configuration (OpenAI, Anthropic, Google, Azure, Ollama)
- Secure API key storage (AES-256-GCM)
- User-level API key isolation
- Provider validation
- Model capability configuration

**Security Details**:
- **Encryption**: AES-256-GCM (Galois/Counter Mode)
- **Key Derivation**: scryptSync with 32-byte salt
- **IV**: 16-byte random initialization vector per key
- **Auth Tag**: 16-byte HMAC for integrity
- **Never Exposed**: API keys never returned in plain text

**Technology Stack**:
- NestJS 10.3
- Prisma
- Node.js crypto module

#### 6. Tool Service (Port 3006)

**Responsibility**: Tool Registry and Sandboxed Execution

```
┌─────────────────────────────────────┐
│          Tool Service               │
├─────────────────────────────────────┤
│  Domain Layer:                      │
│    • Tool Entity                    │
│    • ToolParameter                  │
│                                     │
│  Application Layer:                 │
│    • RegisterToolUseCase            │
│    • ExecuteToolUseCase             │
│    • ToolExecutionEngine            │
│                                     │
│  Infrastructure Layer:              │
│    • PrismaToolRepository           │
│    • IsolatedVMExecutor             │
│    • HttpToolExecutor               │
│    • WebScraperExecutor             │
│                                     │
│  Presentation Layer:                │
│    • ToolController                 │
└─────────────────────────────────────┘
```

**Key Features**:
- Tool registry (Web, API, Database, File, Custom)
- Sandboxed JavaScript execution (isolated-vm)
- Built-in tools: HTTP requests, web scraping
- Rate limiting (30 req/min per service)
- Tool versioning
- Parameter validation

**Security**:
- Isolated VM environment (no access to host)
- Memory limits
- Execution timeout
- No network access in sandbox (except HTTP tool)

**Technology Stack**:
- NestJS 10.3
- isolated-vm
- Cheerio (web scraping)
- Axios
- Prisma

#### 7. Vector Service (Port 3007)

**Responsibility**: Vector Storage and Semantic Search

```
┌─────────────────────────────────────┐
│        Vector Service               │
├─────────────────────────────────────┤
│  Domain Layer:                      │
│    • VectorCollection Entity        │
│    • VectorDocument                 │
│                                     │
│  Application Layer:                 │
│    • CreateCollectionUseCase        │
│    • UpsertVectorsUseCase           │
│    • SearchVectorsUseCase           │
│                                     │
│  Infrastructure Layer:              │
│    • QdrantVectorRepository         │
│    • PrismaMetadataRepository       │
│                                     │
│  Presentation Layer:                │
│    • VectorController               │
└─────────────────────────────────────┘
```

**Key Features**:
- Vector collection management per user
- Document upsert with embeddings
- Semantic similarity search
- Configurable dimensions
- Metadata storage in PostgreSQL
- Full-text search support

**Technology Stack**:
- NestJS 10.3
- Qdrant client
- Prisma

## Event-Driven Architecture

### NATS JetStream

NATS JetStream provides:
- **Persistence**: Messages are stored on disk
- **Replay**: Can replay messages from any point
- **At-Least-Once Delivery**: Guaranteed message delivery
- **Stream Processing**: Process messages in order

### Event Flow

```
┌─────────────────────────────────────────────────────────────┐
│                       Event Flow                            │
└─────────────────────────────────────────────────────────────┘

  Orchestration Service                Execution Service
         │                                    │
         │  1. Start Workflow                 │
         ├────────────────────────────────────┤
         │                                    │
         │  2. Publish: workflow.started      │
         │────────────────────────────────────▶
         │                                    │
         │                           3. Log event
         │                           4. Update status
         │                                    │
         │  5. Execute Node                   │
         │                                    │
         │  6. Publish: workflow.node.started │
         │────────────────────────────────────▶
         │                                    │
         │                           7. Log node start
         │                                    │
         │  8. Node execution...              │
         │                                    │
         │  9. Publish: workflow.node.completed
         │────────────────────────────────────▶
         │                                    │
         │                           10. Log node result
         │                                    │
         │  11. Continue workflow...          │
         │                                    │
         │  12. Publish: workflow.completed   │
         │────────────────────────────────────▶
         │                                    │
         │                           13. Finalize logs
         │                           14. Update status
```

### Event Types

**Workflow Events** (`@multi-agent/events`):
- `workflow.started`: Workflow execution begins
- `workflow.node.started`: Node execution begins
- `workflow.node.completed`: Node execution completes
- `workflow.node.failed`: Node execution fails
- `workflow.completed`: Workflow execution completes
- `workflow.failed`: Workflow execution fails

**Agent Events**:
- `agent.execution.started`
- `agent.execution.completed`
- `agent.execution.failed`

**Tool Events**:
- `tool.execution.started`
- `tool.execution.completed`
- `tool.execution.failed`

### Event Schema Example

```typescript
interface WorkflowNodeStartedEvent {
  type: 'workflow.node.started';
  data: {
    workflowId: string;
    executionId: string;
    nodeId: string;
    nodeName: string;
    timestamp: string;
  };
}
```

## Clean Architecture

### Layer Dependency Rules

```
┌──────────────────────────────────────────────────┐
│              Presentation Layer                  │
│   (Controllers, Gateways, DTOs)                  │
│   • HTTP endpoints                               │
│   • WebSocket gateways                           │
│   • Request/Response validation                  │
└──────────────┬───────────────────────────────────┘
               │ depends on
               ▼
┌──────────────────────────────────────────────────┐
│             Application Layer                    │
│   (Use Cases, Business Rules)                    │
│   • CreateAgentUseCase                           │
│   • ExecuteWorkflowUseCase                       │
│   • Business logic                               │
└──────────────┬───────────────────────────────────┘
               │ depends on
               ▼
┌──────────────────────────────────────────────────┐
│              Domain Layer                        │
│   (Entities, Value Objects, Interfaces)          │
│   • Agent                                        │
│   • Workflow                                     │
│   • Repository Interfaces                        │
└──────────────────────────────────────────────────┘
               ▲
               │ implemented by
               │
┌──────────────┴───────────────────────────────────┐
│           Infrastructure Layer                   │
│   (External Dependencies)                        │
│   • PrismaRepository                             │
│   • NATSEventBus                                 │
│   • External APIs                                │
└──────────────────────────────────────────────────┘
```

### Example: Agent Service Structure

```
services/agent-service/src/
├── domain/
│   ├── entities/
│   │   └── agent.entity.ts
│   ├── repositories/
│   │   └── agent.repository.interface.ts
│   └── value-objects/
│       └── agent-config.vo.ts
├── application/
│   └── use-cases/
│       ├── create-agent.use-case.ts
│       ├── execute-agent.use-case.ts
│       └── list-agents.use-case.ts
├── infrastructure/
│   ├── repositories/
│   │   └── prisma-agent.repository.ts
│   ├── services/
│   │   ├── langchain.service.ts
│   │   └── openai-provider.service.ts
│   └── events/
│       └── nats-event-publisher.ts
└── presentation/
    ├── controllers/
    │   └── agent.controller.ts
    ├── gateways/
    │   └── agent.gateway.ts
    └── dto/
        ├── create-agent.dto.ts
        └── execute-agent.dto.ts
```

## Data Flow

### Workflow Execution Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    Workflow Execution                       │
└─────────────────────────────────────────────────────────────┘

  Client           Gateway        Orchestration      Execution
    │                │                │                 │
    │  POST /workflows/:id/execute   │                 │
    ├────────────────▶                │                 │
    │                │                │                 │
    │                │  Forward       │                 │
    │                ├────────────────▶                 │
    │                │                │                 │
    │                │         1. Parse workflow graph  │
    │                │         2. Validate nodes/edges  │
    │                │         3. Create execution      │
    │                │                │                 │
    │                │         4. Publish event         │
    │                │────────────────────────────────▶ │
    │                │                │                 │
    │                │                │         5. Create execution log
    │                │                │         6. Set status RUNNING
    │                │                │                 │
    │                │         7. Execute first node    │
    │                │                │                 │
    │                │         8. Call Agent Service    │
    │                │         (or Tool Service)        │
    │                │                │                 │
    │                │         9. Wait for result       │
    │                │                │                 │
    │                │         10. Publish node complete│
    │                │────────────────────────────────▶ │
    │                │                │                 │
    │                │                │         11. Log node result
    │                │                │                 │
    │                │         12. Continue to next node│
    │                │                │                 │
    │                │         13. Repeat until complete│
    │                │                │                 │
    │                │         14. Publish workflow complete
    │                │────────────────────────────────▶ │
    │                │                │                 │
    │                │                │         15. Finalize logs
    │                │                │         16. Set status COMPLETED
    │                │                │                 │
    │  WebSocket: workflow.completed  │                 │
    │◀────────────────────────────────                 │
```

### Agent Execution Flow (with Streaming)

```
┌─────────────────────────────────────────────────────────────┐
│                  Agent Execution (Streaming)                │
└─────────────────────────────────────────────────────────────┘

  Client           Gateway          Agent          Model
    │                │                │              │
    │  WebSocket: executeAgent        │              │
    ├────────────────▶                │              │
    │                │                │              │
    │                │  Forward       │              │
    │                ├────────────────▶              │
    │                │                │              │
    │                │         1. Load agent config  │
    │                │         2. Get API key (encrypted)
    │                │                ├──────────────▶
    │                │                │              │
    │                │                │◀─────────────┤
    │                │                │  Decrypted key
    │                │                │              │
    │                │         3. Initialize LangChain
    │                │         4. Setup streaming    │
    │                │                │              │
    │                │         5. Call LLM           │
    │                │                │              │
    │                │         6. Stream tokens      │
    │                │                │              │
    │  agentToken: {...}              │              │
    │◀────────────────────────────────              │
    │  agentToken: {...}              │              │
    │◀────────────────────────────────              │
    │  agentToken: {...}              │              │
    │◀────────────────────────────────              │
    │                │                │              │
    │                │         7. Complete execution │
    │                │                │              │
    │  agentComplete: {...}           │              │
    │◀────────────────────────────────              │
```

## Security Architecture

### Authentication Flow

```
┌─────────────────────────────────────────────────────────────┐
│                   Authentication Flow                       │
└─────────────────────────────────────────────────────────────┘

  Client           Gateway          Database
    │                │                │
    │  POST /auth/login              │
    ├────────────────▶                │
    │  { email, password }            │
    │                │                │
    │                │  1. Query user │
    │                ├────────────────▶
    │                │                │
    │                │◀───────────────┤
    │                │  User data     │
    │                │                │
    │         2. Compare password hash│
    │         (bcrypt)                │
    │                │                │
    │         3. Generate JWT token   │
    │         (includes userId, role) │
    │                │                │
    │  { access_token, user }         │
    │◀────────────────                │
    │                │                │
    │  Subsequent requests with token │
    ├────────────────▶                │
    │  Authorization: Bearer <token>  │
    │                │                │
    │         4. Validate JWT         │
    │         5. Extract user info    │
    │         6. Check permissions    │
    │                │                │
    │         7. Forward to service   │
```

### API Key Encryption

```
┌─────────────────────────────────────────────────────────────┐
│              API Key Encryption (AES-256-GCM)               │
└─────────────────────────────────────────────────────────────┘

Plain Text API Key
       │
       ▼
┌──────────────────────┐
│  Generate Salt       │
│  (32 bytes random)   │
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│  Derive Key          │
│  scryptSync(         │
│    master_key,       │
│    salt,             │
│    32                │
│  )                   │
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│  Generate IV         │
│  (16 bytes random)   │
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│  Encrypt with        │
│  AES-256-GCM         │
│  • cipher            │
│  • auth tag (16B)    │
└──────┬───────────────┘
       │
       ▼
Store in Database:
{
  encryptedKey: Buffer,
  salt: Buffer,
  iv: Buffer,
  authTag: Buffer
}
```

### Authorization (RBAC)

**Roles**:
- **ADMIN**: Full system access
- **USER**: Create and manage own resources
- **VIEWER**: Read-only access

**Example Permissions**:

| Resource | ADMIN | USER | VIEWER |
|----------|-------|------|--------|
| Create Workflow | ✅ | ✅ | ❌ |
| Execute Workflow | ✅ | ✅ (own) | ❌ |
| View Workflow | ✅ | ✅ (own) | ✅ (own) |
| Delete Workflow | ✅ | ✅ (own) | ❌ |
| Manage Users | ✅ | ❌ | ❌ |
| View Execution Logs | ✅ | ✅ (own) | ✅ (own) |

## Scalability & Performance

### Horizontal Scaling

All services are stateless and can be scaled horizontally:

```
┌─────────────────────────────────────────────────────────────┐
│                    Load Balancer                            │
└────────┬──────────────┬──────────────┬──────────────────────┘
         │              │              │
    ┌────▼────┐    ┌───▼─────┐   ┌───▼─────┐
    │ Gateway │    │ Gateway │   │ Gateway │
    │ Pod 1   │    │ Pod 2   │   │ Pod 3   │
    └────┬────┘    └────┬────┘   └────┬────┘
         │              │              │
         └──────────────┴──────────────┘
                        │
         ┌──────────────┴──────────────┐
         │                             │
    ┌────▼────┐                   ┌───▼─────┐
    │  Agent  │                   │  Agent  │
    │  Pod 1  │                   │  Pod 2  │
    └─────────┘                   └─────────┘
```

### Performance Optimizations

1. **Connection Pooling**: Database connection pooling with Prisma
2. **Caching**: Redis for frequently accessed data (future)
3. **Message Queue**: NATS for asynchronous processing
4. **Streaming**: Token streaming for responsive UI
5. **Batch Operations**: Bulk inserts for execution logs
6. **Indexed Queries**: Database indexes on frequently queried fields

### Monitoring

**Metrics to Monitor**:
- Request rate and latency per service
- Error rate and types
- Database connection pool usage
- NATS message queue depth
- Memory and CPU usage per pod
- Workflow execution time
- Agent response time

**Tools** (Future):
- Prometheus for metrics collection
- Grafana for visualization
- Jaeger for distributed tracing
- ELK stack for centralized logging

---

**Last Updated**: 2024
**Version**: 1.0.0

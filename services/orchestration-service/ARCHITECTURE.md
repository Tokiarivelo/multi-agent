# Orchestration Service Architecture

## Overview

The Orchestration Service is a comprehensive workflow orchestration engine built with Clean Architecture principles. It manages workflow definitions and executes them by coordinating calls to agent-service and tool-service.

## Clean Architecture Layers

### 1. Domain Layer (`src/domain/`)

The core business logic layer, containing pure business rules with no external dependencies.

#### Entities
- **workflow.entity.ts**: Workflow domain model
  - Workflow status management (DRAFT, ACTIVE, INACTIVE, ARCHIVED)
  - Workflow definition with nodes and edges
  - Workflow validation logic
  - Version management

- **workflow-execution.entity.ts**: Workflow execution tracking
  - Execution status (PENDING, RUNNING, COMPLETED, FAILED, CANCELLED)
  - Node execution tracking
  - Retry count management
  - Timeline tracking (start/completion times)

#### Repositories (Interfaces)
- **workflow.repository.interface.ts**: Repository contract for workflow persistence

#### Services
- **workflow-execution.service.ts**: Domain service for workflow execution logic
  - Next node determination based on edges
  - Condition evaluation
  - Data transformation
  - Input mapping
  - Retry logic

### 2. Application Layer (`src/application/`)

Use cases and application-specific business rules.

#### Use Cases
- **create-workflow.use-case.ts**: Create and validate new workflows
- **get-workflow.use-case.ts**: Retrieve workflows by ID, user, or list all
- **execute-workflow.use-case.ts**: Execute workflows, get status, cancel execution

#### DTOs
- **create-workflow.dto.ts**: Workflow creation request
- **execute-workflow.dto.ts**: Workflow execution request

#### Interfaces
- **workflow-executor.interface.ts**: Contract for workflow execution engine

### 3. Infrastructure Layer (`src/infrastructure/`)

External concerns and framework-specific implementations.

#### Database
- **prisma.service.ts**: Prisma ORM connection management

#### Persistence
- **workflow.repository.ts**: Concrete implementation of workflow repository using Prisma

#### External Services
- **agent-client.service.ts**: HTTP client for agent-service
- **tool-client.service.ts**: HTTP client for tool-service
- **workflow-executor.service.ts**: Concrete workflow execution engine
  - Async execution management
  - Node execution by type (AGENT, TOOL, TRANSFORM, etc.)
  - WebSocket notification integration
  - Retry logic implementation

#### Config
- **config.module.ts**: NestJS configuration module
- **env.validation.ts**: Environment variable validation

### 4. Presentation Layer (`src/presentation/`)

API layer for external communication.

#### Controllers
- **workflow.controller.ts**: REST API endpoints
  - POST /workflows - Create workflow
  - GET /workflows - List workflows
  - GET /workflows/:id - Get workflow by ID
  - POST /workflows/execute - Execute workflow
  - GET /workflows/executions/:executionId - Get execution status
  - POST /workflows/executions/:executionId/cancel - Cancel execution

- **health.controller.ts**: Health check endpoint

#### Gateways
- **workflow.gateway.ts**: WebSocket gateway for real-time updates
  - Room-based subscriptions
  - Execution updates
  - Node updates
  - Error notifications

#### Filters
- **http-exception.filter.ts**: Global exception handling

## Data Flow

### Workflow Creation Flow
```
Client Request → WorkflowController
  → CreateWorkflowUseCase
  → WorkflowRepository
  → Database
```

### Workflow Execution Flow
```
Client Request → WorkflowController
  → ExecuteWorkflowUseCase
  → WorkflowExecutorService
    → WorkflowExecutionService (node determination)
    → AgentClientService / ToolClientService (node execution)
    → WorkflowGateway (real-time updates)
  → Database (state persistence)
```

### Real-time Update Flow
```
WorkflowExecutorService
  → WorkflowGateway
  → Socket.IO Server
  → Connected Clients (via WebSocket)
```

## Node Execution Logic

### Supported Node Types

1. **START**: Entry point (required, exactly one)
2. **END**: Exit point (required, at least one)
3. **AGENT**: Execute AI agent via agent-service
4. **TOOL**: Execute tool via tool-service
5. **CONDITIONAL**: Evaluate conditions for branching
6. **TRANSFORM**: Transform data between nodes

### Execution Flow

1. Start from START node
2. Execute node based on type
3. Determine next nodes based on edges and conditions
4. Execute next nodes recursively
5. Complete when reaching END node(s)

### Error Handling

- Failed nodes can be retried (configurable)
- Errors are captured and stored
- Execution status is updated
- WebSocket notifications sent

## Key Features

### 1. Async Execution
- Workflows execute asynchronously
- Non-blocking API responses
- Status available via polling or WebSocket

### 2. Retry Logic
- Configurable retry attempts per node
- Exponential backoff (optional)
- Per-node retry configuration

### 3. Real-time Updates
- WebSocket-based notifications
- Execution status updates
- Node-level progress tracking
- Error notifications

### 4. Workflow Validation
- Structure validation (START/END nodes)
- Edge validation (valid source/target)
- Pre-execution validation

### 5. Service Integration
- REST-based communication
- Timeout handling
- Error recovery
- Service health checks

## Configuration

### Environment Variables
- `PORT`: Service port (default: 3001)
- `DATABASE_URL`: PostgreSQL connection string
- `AGENT_SERVICE_URL`: Agent service endpoint
- `TOOL_SERVICE_URL`: Tool service endpoint
- `MAX_RETRY_ATTEMPTS`: Maximum retries per node (default: 3)
- `EXECUTION_TIMEOUT`: Execution timeout in ms (default: 300000)

## Security Considerations

- Input validation using class-validator
- Database query parameterization via Prisma
- CORS configuration
- Error message sanitization
- Authentication (ready for JWT integration)

## Scalability

- Stateless design (except WebSocket connections)
- Database-backed state persistence
- Horizontal scaling ready
- Connection pooling via Prisma

## Testing Strategy

- Unit tests for domain entities and services
- Integration tests for use cases
- E2E tests for API endpoints
- Mock external service dependencies

## Dependencies

- **Runtime**: NestJS, Prisma, Socket.IO, Axios
- **Development**: TypeScript, Jest, ESLint, Prettier
- **Shared**: @multi-agent/types, @multi-agent/common

## Future Enhancements

- Workflow versioning
- Parallel node execution
- Sub-workflow support
- Scheduled execution
- Workflow templates
- Advanced monitoring and metrics
- Workflow marketplace

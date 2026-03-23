# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development

```bash
# Start all infrastructure services (PostgreSQL, NATS, Qdrant, MinIO)
docker compose up -d

# Start all services with hot reload
pnpm dev

# Run a specific service in dev mode
pnpm --filter @multi-agent/gateway dev
pnpm --filter @multi-agent/agent-service dev

# Start frontend only
pnpm --filter frontend dev
```

### Build

```bash
pnpm build                          # Build all packages and services
pnpm --filter @multi-agent/gateway build  # Build a single service
```

### Testing

```bash
pnpm test                           # Run all tests
pnpm --filter @multi-agent/gateway test   # Test a single service
pnpm --filter @multi-agent/gateway test -- --testPathPattern=auth  # Single test file
pnpm --filter frontend test:cov     # Frontend with coverage
```

### Linting & Formatting

```bash
pnpm lint       # Lint all packages
pnpm format     # Prettier format everything
```

### Database

```bash
pnpm prisma:generate    # Regenerate Prisma client (run after schema changes)
pnpm prisma:migrate     # Run pending migrations
pnpm prisma:studio      # Open Prisma Studio GUI

# From the database package directly
pnpm --filter @multi-agent/database prisma:reset  # Reset database
pnpm --filter @multi-agent/database prisma:push   # Push schema without migration
```

### Kubernetes / Skaffold

```bash
make setup          # Initialize cluster
make dev            # Dev with hot reload via Skaffold
make deploy         # Deploy to Kubernetes
make status         # Show resource status
make logs           # Stream logs
make port-forward   # Forward ports locally
```

## Architecture

### Monorepo Structure

```
packages/       # Shared packages (compiled first, referenced by services)
  common/       # Utilities, helpers (@multi-agent/common)
  database/     # Prisma schema + generated client (@multi-agent/database)
  types/        # Shared TypeScript types (@multi-agent/types)
  events/       # NATS event schemas (@multi-agent/events)
  nats-client/  # NATS pub/sub abstraction (@multi-agent/nats-client)
services/       # NestJS microservices
frontend/       # Next.js application
```

### Service Ports

| Service | Port | Responsibility |
|---------|------|----------------|
| Gateway | 3000 | API gateway, JWT auth, routing |
| Frontend | 3001 | Next.js UI |
| Agent | 3002 | AI agent management + LangChain execution |
| Orchestration | 3003 | DAG workflow engine |
| Execution | 3004 | Execution tracking and audit logs |
| Model | 3005 | LLM provider management, API key encryption |
| Tool | 3006 | Tool registry, sandboxed code execution |
| Vector | 3007 | Qdrant vector storage, semantic search |
| File | 3008 | MinIO file storage, vector indexing |

### Communication Patterns

- **HTTP**: Frontend → Gateway → individual services (REST + WebSocket)
- **NATS JetStream**: Inter-service async messaging (event-driven)
- **WebSockets**: Real-time streaming (agent execution, workflow monitoring)

### Clean Architecture (all services)

Each service follows strict layering:

```
src/
  application/    # Use cases — orchestrate domain logic
  domain/         # Entities, interfaces, business rules (no framework deps)
  infrastructure/ # Prisma repos, NATS publishers, external API adapters
  presentation/   # NestJS controllers, WebSocket gateways
```

Business logic lives in `domain/` and `application/`. Controllers and repositories are adapters that implement domain interfaces.

### Authentication Flow

1. Auth requests hit Gateway (port 3000)
2. Gateway validates JWT, attaches user context
3. Downstream services receive `x-user-id` / `x-user-role` headers — they do **not** re-validate JWT
4. API keys for LLM providers are stored encrypted (AES-256) in the database, decrypted only in Model Service at runtime

### Shared Package Dependency Order

When making changes, build in this order:
1. `@multi-agent/types`
2. `@multi-agent/events`
3. `@multi-agent/common`
4. `@multi-agent/database` (run `prisma:generate` after schema changes)
5. `@multi-agent/nats-client`
6. Services (any order)

### Key Infrastructure

- **PostgreSQL** (Prisma): All relational data. Schema lives at `packages/database/prisma/schema.prisma`.
- **NATS JetStream**: Async events between services. Event contracts defined in `@multi-agent/events`.
- **Qdrant**: Vector embeddings, per-user collection isolation. Used by Vector Service.
- **MinIO**: S3-compatible file storage. Used by File Service with indexing pipeline into Qdrant.

### Frontend Architecture

- **App Router** (Next.js): Routes in `src/app/`
- **Feature modules**: `src/features/` — colocated components, hooks, and types per domain
- **State**: Zustand stores in `src/store/`
- **Server state**: TanStack React Query v5 for API calls
- **Real-time**: socket.io-client connects to Gateway WebSocket
- **Workflow diagrams**: `@xyflow/react` for drag-and-drop workflow editor

### Tool Execution Security

Tools in Tool Service run in `isolated-vm` (V8 isolate) — sandboxed JavaScript with no Node.js access. Custom tools submitted by users execute in this sandbox.

---
name: multi-agent-patterns
description: Coding patterns extracted from the multi-agent platform repository
version: 1.0.0
source: local-git-analysis
analyzed_commits: 50
---

# Multi-Agent Platform Patterns

## Commit Conventions

This project uses **conventional commits** (88% feat, 6% fix, 6% docs):

- `feat:` — New features or capabilities (dominant type)
- `fix:` — Bug fixes
- `docs:` — Documentation only
- `refactor:` — Code restructuring without behavior change
- `test:` — Test additions/changes
- `chore:` — Maintenance, deps, config

Keep messages imperative and descriptive of the *what* + *why*, e.g.:
```
feat: Implement automatic workspace file pruning from the vector store by deleting vector points based on file paths.
```

## Service Architecture (Clean Architecture — Mandatory)

Every NestJS microservice under `services/` follows this **exact** 4-layer structure:

```
services/<name>/src/
├── domain/
│   ├── entities/          # Core business entities (no framework deps)
│   ├── interfaces/        # Repository/service interfaces
│   └── services/          # Pure domain logic
├── application/
│   ├── dto/               # Input/output data transfer objects
│   ├── interfaces/        # Use-case interfaces
│   └── use-cases/         # One use-case per file (*.use-case.ts)
├── infrastructure/
│   ├── config/            # Configuration + env validation
│   ├── external/          # Third-party integrations (HTTP clients, LLMs)
│   └── persistence/       # Repository implementations (Prisma)
├── presentation/
│   ├── controllers/       # HTTP + NATS controllers
│   ├── gateways/          # WebSocket gateways
│   └── decorators/        # Custom NestJS decorators
├── app.module.ts
└── main.ts
```

**Rules:**
- Domain layer has zero framework imports
- Use-cases depend on interfaces, not concrete implementations
- Infrastructure implements domain interfaces

## Frontend Architecture (Feature-Based)

```
frontend/src/
├── features/
│   ├── <feature>/
│   │   ├── api/           # *.api.ts — HTTP calls via api-client
│   │   ├── components/    # Feature-specific React components
│   │   └── hooks/         # use*.ts — state + side effects
├── components/shared/     # Cross-feature components
├── types/index.ts         # Shared TypeScript types (hot file: 10 changes)
└── lib/api-client.ts      # Central Axios/fetch client
```

**Features present:** agents, api-keys, auth, dashboard, docs, executions, landing, models, tools, workflows, workspace

## Full-Stack Feature Co-Change Pattern

When adding a new feature, these files **always change together** (co-change cluster):

```
packages/database/prisma/schema.prisma           ← 1. Schema first
  ↓ pnpm prisma:generate
services/<name>/src/domain/entities/*.entity.ts  ← 2. Domain entity
services/<name>/src/application/use-cases/*.ts   ← 3. Use-case
services/<name>/src/infrastructure/persistence/  ← 4. Repository impl
services/<name>/src/presentation/controllers/    ← 5. Controller
  ↓ NATS or HTTP
frontend/src/features/<f>/api/*.api.ts           ← 6. Frontend API
frontend/src/features/<f>/hooks/use*.ts          ← 7. React hook
frontend/src/features/<f>/components/            ← 8. UI components
frontend/src/types/index.ts                      ← 9. Shared types
```

Always follow this sequence to avoid circular dependency and missing type errors.

## Most Volatile Files (High Review Priority)

| File | Changes | Why |
|------|---------|-----|
| `pnpm-lock.yaml` | 19 | Dep updates — never edit manually |
| `frontend/src/types/index.ts` | 10 | Shared types hub — breaking changes propagate |
| `services/orchestration-service/src/infrastructure/external/workflow-executor.service.ts` | 9 | Core execution logic |
| `packages/database/prisma/schema.prisma` | 8 | DB schema — requires migration |
| `frontend/src/features/workflows/components/WorkflowEditor.tsx` | 8 | Complex UI — test carefully |
| `services/gateway-service/src/presentation/controllers/proxy.controller.ts` | 7 | Auth/proxy — security-sensitive |

## Shared Packages

```
packages/
├── common/        # Shared utilities
├── database/      # Prisma client + schema (source of truth)
├── events/        # NATS event contracts
├── nats-client/   # NATS connection wrapper
└── types/         # Cross-service TypeScript types
```

**Rule:** Services must import DB through `@multi-agent/database`, never define their own Prisma client.

## Inter-Service Communication

- **NATS** for async events between services (use `packages/events` for type-safe subjects)
- **Gateway service** proxies all external HTTP traffic — services are not directly exposed
- WebSocket via NestJS Gateway (`*.gateway.ts`) for real-time workflow execution status

## Testing Conventions

- Unit tests: co-located as `*.spec.ts` (NestJS default)
- Integration tests: `src/__tests__/integration/*.integration.test.ts`
- Framework: Jest (NestJS) + Vitest (frontend)
- Mock external I/O; integration tests may use real Docker Compose DB

## Workflow: Adding a New Service

1. Copy structure from an existing service (e.g., `tool-service`)
2. Add `Dockerfile` + entry in `docker-compose.yml`
3. Register NATS subjects in `packages/events`
4. Add proxy route in `gateway-service`
5. Add Prisma models in `packages/database/prisma/schema.prisma`
6. Run `pnpm prisma:generate` and `pnpm prisma:migrate`

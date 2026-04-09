---
name: multi-agent-patterns
description: Coding patterns extracted from the multi-agent platform repository
version: 1.1.0
source: local-git-analysis
---

# Multi-Agent Platform Patterns

## Service Architecture (Clean Architecture — Mandatory)

Every NestJS microservice under `services/` follows this **exact** 4-layer structure:

```
services/<name>/src/
├── domain/
│   ├── entities/          # Core business entities (no framework deps)
│   ├── interfaces/        # Repository/service interfaces
│   └── services/          # Pure domain logic
├── application/
│   ├── dto/               # Input/output DTOs
│   └── use-cases/         # One use-case per file (*.use-case.ts)
├── infrastructure/
│   ├── config/            # Config + env validation
│   ├── external/          # Third-party integrations
│   └── persistence/       # Repository implementations (Prisma)
└── presentation/
    ├── controllers/        # HTTP + NATS controllers
    ├── gateways/           # WebSocket gateways
    └── decorators/         # Custom NestJS decorators
```

**Rules:**
- Domain layer: zero framework imports
- Use-cases depend on interfaces, not concrete implementations
- Infrastructure implements domain interfaces

## Frontend Architecture (Feature-Based)

```
frontend/src/
├── features/<feature>/
│   ├── api/           # *.api.ts — HTTP calls via api-client
│   ├── components/    # Feature-specific React components
│   └── hooks/         # use*.ts — state + side effects
├── components/shared/ # Cross-feature components
├── types/index.ts     # Shared types (hot file — breaking changes propagate)
└── lib/api-client.ts  # Central HTTP client
```

Features: agents, api-keys, auth, dashboard, docs, executions, landing, models, tools, workflows, workspace

## Full-Stack Co-Change Sequence

When adding a feature, **always** follow this order:

```
1. packages/database/prisma/schema.prisma     ← schema first
2. services/<name>/src/domain/entities/       ← domain entity
3. services/<name>/src/application/use-cases/ ← use-case
4. services/<name>/src/infrastructure/        ← repository impl
5. services/<name>/src/presentation/          ← controller
6. frontend/src/features/<f>/api/             ← frontend API
7. frontend/src/features/<f>/hooks/           ← React hook
8. frontend/src/features/<f>/components/      ← UI
9. frontend/src/types/index.ts                ← shared types
```

## Most Volatile Files (High Review Priority)

| File | Why |
|------|-----|
| `frontend/src/types/index.ts` | Shared types hub — breaking changes propagate |
| `services/orchestration-service/src/infrastructure/external/workflow-executor.service.ts` | Core execution logic |
| `packages/database/prisma/schema.prisma` | Requires migration |
| `frontend/src/features/workflows/components/WorkflowEditor.tsx` | Complex UI |
| `services/gateway-service/src/presentation/controllers/proxy.controller.ts` | Auth/proxy — security-sensitive |

## Shared Packages

```
packages/
├── common/        # Shared utilities
├── database/      # Prisma client + schema (source of truth)
├── events/        # NATS event contracts (type-safe subjects)
├── nats-client/   # NATS connection wrapper
└── types/         # Cross-service TypeScript types
```

**Rule:** Services import DB through `@multi-agent/database` — never define their own Prisma client.

## Inter-Service Communication
- **NATS** for async events (use `packages/events` for type-safe subjects)
- **Gateway service** proxies all external HTTP — services not directly exposed
- **WebSocket** via `*.gateway.ts` for real-time workflow execution status

## Testing Conventions
- Unit: co-located as `*.spec.ts` (NestJS) / `*.test.ts` (frontend)
- Integration: `src/__tests__/integration/*.integration.test.ts`
- Jest (NestJS services) + Vitest (frontend)

## Adding a New Service

1. Copy structure from `tool-service`
2. Add `Dockerfile` + entry in `docker-compose.yml`
3. Register NATS subjects in `packages/events`
4. Add proxy route in `gateway-service`
5. Add Prisma models in `packages/database/prisma/schema.prisma`
6. Run `pnpm prisma:generate && pnpm prisma:migrate`

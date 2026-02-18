# @multi-agent/database

Shared database package for the Multi-Agent Platform. This package centralizes all Prisma-related concerns — the schema, migrations, generated client, and the NestJS `PrismaService`.

## Overview

All microservices connect to the **same PostgreSQL database** (`multi_agent`) and use the **same Prisma schema**. This package provides:

- **Unified Prisma Schema** (`prisma/schema.prisma`) — all models in one place
- **Prisma Config** (`prisma.config.ts`) — Prisma 7 configuration (datasource URL, migration path)
- **PrismaService** — NestJS-injectable service extending `PrismaClient`
- **Type Re-exports** — all `@prisma/client` types re-exported for convenience

## Package Structure

```
packages/database/
├── prisma/
│   ├── schema.prisma           # Unified database schema
│   └── migrations/             # Migration files
│       └── 20260217070749_init/
├── src/
│   ├── index.ts                # Barrel exports (PrismaService + types)
│   └── prisma.service.ts       # NestJS PrismaService
├── prisma.config.ts            # Prisma 7 config (datasource, paths)
├── package.json
├── tsconfig.json
└── README.md
```

## Usage in Services

### 1. Add Dependency

Each service's `package.json` should include:

```json
{
  "dependencies": {
    "@multi-agent/database": "workspace:*"
  }
}
```

### 2. Re-export PrismaService

Each service keeps its own `prisma.service.ts` file for backward compatibility:

```typescript
// services/<service>/src/infrastructure/database/prisma.service.ts
export { PrismaService } from '@multi-agent/database';
```

### 3. Import Types

Import Prisma types from the shared package:

```typescript
import { PrismaService, User, Agent, Prisma } from '@multi-agent/database';
```

## Database Models

The unified schema includes the following models:

| Model              | Table                | Description                    |
| ------------------ | -------------------- | ------------------------------ |
| `User`             | `users`              | Platform users with roles      |
| `Workflow`         | `workflows`          | DAG-based workflow definitions |
| `Agent`            | `agents`             | AI agent configurations        |
| `Tool`             | `tools`              | Tool registry                  |
| `Model`            | `models`             | LLM provider configurations    |
| `ApiKey`           | `api_keys`           | Encrypted API keys             |
| `Execution`        | `executions`         | Workflow execution records     |
| `ExecutionLog`     | `execution_logs`     | Per-node execution logs        |
| `VectorCollection` | `vector_collections` | Vector storage collections     |

## Commands

Run from the **project root**:

```bash
# Generate Prisma client
pnpm prisma:generate

# Run migrations
pnpm prisma:migrate

# Open Prisma Studio
pnpm prisma:studio
```

Or from within `packages/database`:

```bash
pnpm prisma:generate
pnpm prisma:migrate
pnpm prisma:push
pnpm prisma:studio
pnpm prisma:reset
```

## Environment Variables

All services must have the following in their `.env`:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/multi_agent?schema=public
```

> **Note:** In Prisma 7, the `DATABASE_URL` is read at runtime via `prisma.config.ts` using `env('DATABASE_URL')`. It is **not** specified in `schema.prisma`.

## Architecture Decisions

### Why a Single Database?

The unified Prisma schema has foreign key relationships across models (e.g., `Agent → User`, `Execution → Workflow → User`). Splitting into separate databases would break referential integrity. A single PostgreSQL database with proper indexing is sufficient for the platform's needs.

### Why Prisma 7?

Prisma 7 introduces `prisma.config.ts` for centralized configuration, removing the need for `url` in `schema.prisma`. This improves environment handling and makes multi-environment deployment cleaner.

### Why a Shared Package?

- **No duplication** — one schema, one client, one place to add models
- **Type consistency** — all services use the same generated types
- **Simplified migrations** — run once, applies everywhere
- **Workspace efficiency** — `pnpm` links the package locally

---

**Version**: 1.0.0
**Prisma**: 7.4.0
**License**: MIT

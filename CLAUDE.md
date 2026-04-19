# CLAUDE.md — Multi-Agent Platform

> All rules, agents, and skills live in `.claude/`. Read them — they override defaults.

---

## Stack

TypeScript · pnpm monorepo · NestJS · Next.js · Prisma · NATS · Kubernetes

```
services/   # NestJS microservices
packages/   # Shared libs (@multi-agent/database, types, utils)
frontend/   # Next.js UI
k8s/        # Kubernetes manifests
```

**Package manager: `pnpm` only — never npm or yarn.**

---

## Critical Project Constraints

### Gateway (CRITICAL)

- ALL frontend → backend traffic through `gateway-service` (port 3000)
- Never call a microservice directly — CORS will block it
- Base URL for all frontend calls: `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_*` vars are browser-exposed — never put secrets in them

### i18n (MANDATORY on every UI feature)

- **Every** user-facing string — buttons, labels, titles, toasts, placeholders — must use `useTranslation()` + `t('feature.key')`. No hardcoded English strings, ever.
- Add the key to **both** `src/locales/en/<feature>.ts` **and** `src/locales/fr/<feature>.ts` in the same PR/commit.
- Do NOT use the fallback overload `t('key', 'Default text')` — add the key to the locale file instead.
- Register the locale file in `src/locales/{en,fr}/index.ts` if it is new.
- Before marking any UI task done: grep the diff for raw string literals inside JSX and confirm each one is translated.

### New Microservice Checklist

1. Add `<SERVICE>_URL` to `gateway-service/src/infrastructure/config/env.validation.ts`
2. Add proxy case to `proxy.controller.ts`
3. Frontend calls go to `NEXT_PUBLIC_API_URL/api/<route>/...`

---

## Rules → `.claude/rules/`

| File                    | Covers                                    |
| ----------------------- | ----------------------------------------- |
| `common.md`             | Code style, error handling, git, security |
| `planning.md`           | When/how to plan, plan format             |
| `testing.md`            | TDD, coverage targets, mock patterns      |
| `token-optimization.md` | Token budget — mandatory every session    |
| `typescript.md`         | Strict TS, Zod, async patterns            |

## Agents → `.claude/agents/`

| Agent             | Use when                       |
| ----------------- | ------------------------------ |
| `planner`         | Task needs 3+ file changes     |
| `tdd-guide`       | Writing any new business logic |
| `token-optimizer` | Session feels bloated          |

## Skills → `.claude/skills/`

- `multi-agent-patterns` — commit conventions, clean architecture layers, service patterns

---

## Quick Commands

```bash
pnpm dev                  # Start all services
pnpm build                # Build all packages
pnpm lint && pnpm test    # Must pass before commit
docker-compose up -d      # Start infrastructure
pnpm prisma:migrate       # Run DB migrations
```

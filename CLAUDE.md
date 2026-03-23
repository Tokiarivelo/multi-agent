# CLAUDE.md — Multi-Agent Platform

> Authoritative guide for Claude Code sessions on this project.
> Read fully before touching any file.

---

## Project Overview

**Stack:** TypeScript · pnpm monorepo · Node.js · Prisma · NATS · Kubernetes
**Purpose:** Production-ready AI workflow orchestration platform (multi-agent pipelines)
**Package manager:** `pnpm` — never use `npm` or `yarn`

```
services/          # Backend microservices
packages/          # Shared libraries (database, types, utils)
frontend/          # Next.js UI
k8s/               # Kubernetes manifests
```

---

## 1. TOKEN BUDGET — Minimize First

**Every session starts with a budget mindset.**

| Action | Rule |
|--------|------|
| Reading files | Read only what is needed — use `offset`+`limit` on large files |
| Searching | `Grep` before `Read`; use specific patterns, not broad globs |
| Agents | Delegate broad research to subagents; keep main context lean |
| Responses | Answer in < 5 sentences unless code is involved |
| Context | Prefer surgical edits (`Edit`) over full rewrites (`Write`) |
| Loops | Break early when enough information is found |

**Hard rules:**
- Do NOT read files you don't need to modify or reference.
- Do NOT explain what you are about to do — just do it.
- Do NOT repeat information already in context.
- Do NOT add comments, docstrings, or types to code you didn't change.
- Do NOT over-engineer: the minimum working solution wins.

---

## 2. PLANNING — Think Before Coding

Before any implementation of 3+ steps, produce a plan:

1. **Understand** — Read only the relevant files (use `Grep` first).
2. **Map** — Identify all files that need to change.
3. **Sequence** — Order changes to avoid circular dependencies.
4. **Validate** — Confirm the plan covers edge cases.
5. **Execute** — Work top-down; mark each step done with `TodoWrite`.

Use `/plan` slash command for complex tasks.

**Planning constraints:**
- Max 7 items in a plan; split into phases if larger.
- Each item must be independently verifiable.
- Flag blockers immediately rather than pushing through.

---

## 3. TESTING — TDD by Default

**Workflow:**
```
Write failing test → Implement → Green → Refactor → Commit
```

**Coverage targets:**
- Unit tests: ≥ 80% for new business logic
- Integration tests: required for all API endpoints
- E2E tests: required for critical user flows

**Commands:**
```bash
pnpm test              # Run all tests (workspace)
pnpm -r test           # Run per-package tests
pnpm --filter <pkg> test
```

**Rules:**
- Never skip tests with `--passWithNoTests` unless explicitly agreed.
- Tests live next to the source: `foo.ts` → `foo.test.ts`
- Mock external I/O (DB, NATS, HTTP) in unit tests.
- Integration tests may use the real DB (Docker Compose).
- Failing tests block any commit — fix or document why before proceeding.

---

## 4. GIT WORKFLOW

```bash
# Branch naming
claude/<task-slug>-<sessionId>

# Commit style (imperative, < 72 chars)
feat: add token-aware planner agent
fix: resolve NATS reconnect race condition
test: add coverage for workflow orchestrator
refactor: extract retry logic to shared util
```

**Before every commit:**
1. `pnpm lint` — must pass
2. `pnpm test` — must pass
3. Staged files only — never `git add -A` blindly

**Never:**
- Force-push to `main`/`master`
- Bypass hooks with `--no-verify`
- Amend published commits

---

## 5. CODE QUALITY RULES

### TypeScript
- Strict mode always (`"strict": true`)
- No `any` — use `unknown` + type guards
- Prefer `const` over `let`; never `var`
- Use `zod` for runtime validation at system boundaries
- Async: `async/await` over raw Promises; always handle rejections

### Architecture
- Services communicate via NATS (not direct HTTP between services)
- DB access only through `@multi-agent/database` package
- No circular imports between packages
- Each service owns its data — no cross-service DB queries

### Security
- Secrets via env vars only — no hardcoded credentials
- Validate all user input at API boundaries
- Use parameterized queries (Prisma handles this)
- No `eval`, no dynamic `require` with user input

---

## 6. PERFORMANCE

- Profile before optimizing — no premature optimization
- DB queries: always use indexes, avoid N+1 with `include`/`select`
- NATS: use subjects with wildcards carefully (fan-out cost)
- Cache computed results when inputs are stable (> 100ms recompute)

---

## 7. AGENT DELEGATION

When a task requires broad exploration, delegate to a subagent:
- Use `subagent_type: "Explore"` for codebase research
- Use `subagent_type: "Plan"` for architecture decisions
- Keep the main context for implementation only

Available custom agents (see `.claude/agents/`):
- `planner` — breaks tasks into ordered steps
- `tdd-guide` — TDD workflow enforcer
- `token-optimizer` — audits context usage and suggests cuts

---

## 8. QUICK REFERENCE

```bash
# Dev
pnpm dev                    # Start all services in parallel
pnpm build                  # Build all packages
pnpm --filter @multi-agent/api dev

# Database
pnpm prisma:generate        # Regenerate Prisma client
pnpm prisma:migrate         # Run migrations
pnpm prisma:studio          # Open Prisma Studio

# Quality
pnpm lint                   # ESLint across workspace
pnpm format                 # Prettier format

# Docker
docker-compose up -d        # Start infrastructure (DB, NATS, etc.)
```

---

## 9. WHAT NOT TO DO

- Do NOT create new files unless strictly necessary.
- Do NOT install packages without checking if a workspace package already provides it.
- Do NOT modify `pnpm-lock.yaml` manually.
- Do NOT add `.env` files to git.
- Do NOT add `console.log` in production paths — use the logger service.
- Do NOT use `setTimeout` as a retry mechanism — use exponential backoff util.

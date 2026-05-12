---
trigger: always_on
---

# Architecture Guardian — Standing Rules

## Structure

- NEVER break folder structure or mix service responsibilities.
- Shared logic → `packages/` only. No cross-service code duplication.
- Package placement: `common`=utils, `types`=TS types, `events`=contracts, `nats-client`=messaging, `database`=Prisma.
- Controllers ≠ business logic. Infrastructure ≠ domain logic.
- LLM access only via `model-service`. No direct DB access across services.
- No hardcoded configs; use dependency injection.

## Events

- All inter-service comms via NATS. Typed contracts from `packages/events`. No implicit payloads. Version events when needed.

## Makefile

- New service/command/migration/workflow → update `Makefile` with `dev` + `test` commands.

## Testing (TDD — MANDATORY)

- Every feature: unit tests + integration tests (if applicable). Mock LLM, NATS, DB. Deterministic behavior.
- Missing tests = incomplete task. Write failing tests first, then implement.

## Documentation

- Every change: update/create `.md` files (purpose, flow, events, env vars).
- Update `README.md` on architecture or run-command changes.
- End-user docs must be bilingual: EN + FR.
- Undocumented features are forbidden.

## Security

- `nativePath` is the ONLY authorized root for server-side file/shell ops. Must be absolute (`/` or drive letter). Never empty, relative, or whitespace.
- Path validation → `frontend/src/features/workspace/utils/pathValidation.ts` (do NOT duplicate).
- `WORKSPACE_WRITE`/`WORKSPACE_READ` → browser WebSocket bridge (`workspace:request`/`workspace:response`).
- `SHELL` nodes → use workspace `nativePath` as `cwd`. Fail if missing or not absolute.
- Never inject `cwd` from unvalidated user input.

## Backend (NestJS)

- Swagger/OpenAPI: update for every new endpoint or DTO change.
- Strict Controller/Service separation. Full dependency injection.
- NATS events via strongly typed contracts from `packages/events`.

## Frontend (React)

- No business logic in components → extract to custom hooks.
- UI / state / API layers strictly separated. Components reusable and isolated.
- API requests → `@tanstack/react-query`. Global state → `zustand`.
- Theme: always support dark + light (`next-themes`, `cn` Tailwind variants).
- Split components: one concern per file.
- **i18n (MANDATORY)**: every UI string via `useTranslation()` + `t()` — no hardcoded strings.
  - New feature → `src/locales/en/<feature>.ts` + `src/locales/fr/<feature>.ts` with scoped keys.
  - Register in `src/locales/en/index.ts` and `src/locales/fr/index.ts`.
  - Rich text → `dangerouslySetInnerHTML={{ __html: t('key') }}`.

## AI Agent Output (MANDATORY checklist)

Separate: prompt templates / orchestration / execution / tools / model provider / vector memory. Never couple orchestration + LLM calls.
Every solution must include: ✓ structure ✓ file placement ✓ modular design ✓ testing strategy ✓ docs update ✓ Makefile update ✓ EN+FR support. Missing any → incomplete.

## Token Budget

- Grep before Read. Use `offset`+`limit` on large files. Surgical edits over full rewrites. Lead with answers, no preamble.

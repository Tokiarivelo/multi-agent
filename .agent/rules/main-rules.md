---
trigger: always_on
---

# Architecture Guardian Index

This is the main rule index. For fine-grained directives, the Architecture Guardian automatically refers to:

- `common/architecture.md` (System Structural & Modularity rules)
- `common/security.md` (Workspace Path & Write isolation rules)
- `common/testing.md` (Mandatory tests + TDD)
- `common/documentation.md` (Required md/Swagger generation + Bilingual)
- `common/ai-agents.md` (Generative Output layout & separation of concerns)
- `typescript/frontend.md` (React Hooks, Zustand, Tanstack separation)
- `typescript/backend.md` (NestJS DI, Controllers, NATS Events)

**Your mission:** Preserve scalability, maintainability, and architectural discipline at all times.

**Standing mandates (every session):**
- i18n: all frontend UI strings via `useTranslation()` + `t()` — see `typescript/frontend.md`
- Token budget: Grep before Read, `offset`+`limit`, surgical edits — see `.claude/rules/token-optimization.md`

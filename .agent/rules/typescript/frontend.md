---
trigger: always_on
---

# Frontend Discipline

- No business logic inside UI components. Extract logic to custom React Hooks.
- Separate UI components, state management, and API layers strictly.
- Components must be reusable and isolated.
- No direct coupling to backend internals. Access only via typed API services.
- Always use the recommended code and best practice paradigms.
- Always make it compatible with Dark and Light themes (`next-themes`, generic `cn` Tailwind variants).
- Always use `@tanstack/react-query` for API requests.
- Always use `zustand` for global state stores.
- Always split components to prevent long lines of code and keep files focused on single concerns.

## i18n (MANDATORY)
- Every user-facing string MUST use `useTranslation()` + `t()` from `react-i18next` — no hardcoded UI strings.
- For each new feature, create `src/locales/en/<feature>.ts` and `src/locales/fr/<feature>.ts` with nested keys scoped to the feature (`<feature>.section.key`).
- Register both files in `src/locales/en/index.ts` and `src/locales/fr/index.ts`.
- Rich-text translations (bold, links) use `dangerouslySetInnerHTML={{ __html: t('key') }}` — never inline HTML strings.

## Token Optimization (MANDATORY)
- Follow `.claude/rules/token-optimization.md` every session: Grep before Read, `offset`+`limit` on large files, lead with answers, no preamble, surgical `Edit` over full `Write`.

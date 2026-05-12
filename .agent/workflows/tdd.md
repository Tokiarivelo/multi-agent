---
description: Test-Driven Development flow
---
# TDD Workflow

1. **Write failing tests first** in `.spec.ts` — define behavior from the feature request.
2. **Implement minimal code** to pass tests.
3. **Run tests** — add/update mocks for DB, LLM, NATS as needed.
4. **Refactor**: enforce TS rules, remove duplication, optimize for clarity.

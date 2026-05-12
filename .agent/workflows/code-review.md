---
description: Deep code review across all recently modified components
---
# Code Review Workflow

1. **Identify modified files** via git diff.
2. **Rule check**: UI → React Query + hook separation. Backend → Swagger + DI. i18n strings via `t()`.
3. **Coverage**: verify deterministic test coverage exists.
4. **Run `code-reviewer` skill** to surface logic flaws or structural deviations.

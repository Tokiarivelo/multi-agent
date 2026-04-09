---
model: claude-sonnet-4-6
---
Review the following code or diff for quality issues:

$ARGUMENTS

Check (bullet list, be concise):
- **Correctness** — logic errors, unhandled async, missing null checks
- **Security** — injection, hardcoded secrets, missing input validation
- **Performance** — N+1 queries, unnecessary blocking, missing indexes
- **Complexity** — over-abstraction, files > 300 lines, deep nesting
- **Testing** — missing tests for new logic, tests that don't assert behavior

Output: numbered list with severity (critical/major/minor) + one-line fix. If no issues: one sentence.

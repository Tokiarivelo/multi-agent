# Common Rules

## Mindset
- Minimum working solution — complexity only when the requirement demands it
- Read before writing — never modify code you haven't understood
- One concern per file — split when logic exceeds 300 lines

## Component / File Size (CRITICAL)
- **Hard limit: 300 lines per file.** Refactor before adding new code to a file that already exceeds this.
- React components: max **150 lines** per component function. Extract sub-components as soon as a function grows past this.
- A component that does layout AND data-fetching AND complex UI logic must be split: orchestrator (data + wiring) + presentational children.
- Prefer many small focused files over one large file. Co-locate extracted components in the same feature folder.

## Code Style
- Descriptive names: `processWorkflowStep` not `doThing`
- Functions: max 30 lines; extract if longer
- Nesting: max 3 levels; use early returns
- No magic numbers — use named constants

## Error Handling
- Validate at system boundaries only (HTTP input, NATS messages, env vars)
- Throw typed errors: `class WorkflowError extends Error`
- Never swallow silently: `catch (e) {}`
- Log error + context before re-throwing

## Dependencies
- Check workspace packages before adding any new dependency
- Prefer stdlib for simple operations

## Git
- Commit per logical unit — not at session end
- Format: `<type>: <what changed>` (imperative, < 72 chars)
- Never commit: secrets · `console.log` · failing tests

## Security
- No `eval`, no `Function()` with dynamic strings
- Rate-limit all public endpoints
- Log auth failures — never log credentials
- Rotate secrets on exposure

## Token Budget
→ See `token-optimization.md` (mandatory every session)

# Common Rules (All Languages)

## Mindset
- Minimum working solution first — add complexity only when the requirement demands it
- Read before writing — never modify code you haven't understood
- One concern per file — split when a file exceeds 300 lines of logic

## Code Style
- Descriptive names: `processWorkflowStep` not `doThing`
- Functions: max 30 lines; extract if longer
- Nesting: max 3 levels; flatten with early returns
- No magic numbers — use named constants
- Error messages must include enough context to debug without reading source

## Error Handling
- Validate at system boundaries only (HTTP input, NATS messages, env vars)
- Throw typed errors (`class WorkflowError extends Error`)
- Never swallow errors silently (`catch (e) {}`)
- Log error + context before re-throwing

## Dependencies
- Check if a workspace package already provides the functionality before adding a dependency
- Prefer stdlib/built-in solutions for simple operations

## Git
- Commit after each logical unit of work — not at end of session
- Message format: `<type>: <what changed>` (imperative, < 72 chars)
- Never commit secrets, never commit `console.log`, never commit failing tests

## Security
- No `eval`, no `Function()` constructor with dynamic strings
- Rate-limit all public endpoints
- Log authentication failures (not credentials)
- Rotate secrets on exposure

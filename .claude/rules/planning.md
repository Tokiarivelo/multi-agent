# Planning Rules

## When to Plan
Plan before coding when the task requires **3 or more distinct file changes** or involves **architectural decisions**.

Skip planning for: single-file bug fixes, typo corrections, obvious one-liners.

## Planning Protocol

### Step 1 — Understand (read minimal)
```
1. Grep for the relevant symbol/pattern
2. Read only the files that contain it
3. Map the dependency graph (who calls what)
```

### Step 2 — Define the goal
State in one sentence what "done" looks like.

### Step 3 — List changes (max 7 items)
```
1. [file] [what changes] → [why]
2. ...
```
If > 7 items, split into Phase 1 / Phase 2.

### Step 4 — Identify risks
- Breaking changes to shared interfaces?
- Migration needed?
- External service dependency?

### Step 5 — Sequence execution
Order changes so each step is independently testable.
Prefer: types/interfaces → business logic → tests → integration.

## Plan Format

```markdown
## Goal
<one sentence>

## Changes
1. `packages/types/src/queue.ts` — add `RetryMessage` interface
2. `services/nats/src/publisher.ts` — wrap publish with retry logic
3. `services/nats/src/publisher.test.ts` — test retry on failure

## Risks
- Redis dependency must be available in Docker Compose

## Out of Scope
- <things explicitly NOT included>
```

## Anti-Patterns
- Do NOT plan while reading — understand first, plan after
- Do NOT include steps you'll figure out while coding
- Do NOT create plans longer than context requires

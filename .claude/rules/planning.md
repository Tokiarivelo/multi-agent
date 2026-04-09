# Planning Rules

## When to Plan
3+ file changes or architectural decisions → plan first.
Single-file fixes, typos, one-liners → skip.

## Protocol
1. **Grep** key symbols → read only those files
2. **State done** in one sentence
3. **List changes** (max 7 items): `[file] — [what] → [why]`
   - If > 7, split into Phase 1 / Phase 2
4. **Flag risks**: interface changes, migrations, external deps
5. **Sequence**: types/interfaces → business logic → tests → integration

## Plan Format
```markdown
## Goal
<one sentence>

## Changes
1. `path/to/file.ts` — <what> (<why now>)

## Risks
- <risk>: <mitigation>

## Out of Scope
- <excluded>
```

## Anti-Patterns
- Do NOT plan while reading — understand first
- Do NOT include steps you'll figure out mid-coding
- Do NOT write prose plans — numbered lists only

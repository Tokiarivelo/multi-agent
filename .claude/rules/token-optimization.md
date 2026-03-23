# Token Optimization Rules

## Core Principle
Every token costs money and latency. Minimize aggressively without losing correctness.

## File Reading
- Use `Grep` to locate relevant sections before `Read`
- Use `offset` + `limit` on Read — never read a 500-line file to find 10 lines
- Stop reading as soon as you have the information you need
- Prefer `Grep output_mode: "content"` with context lines over reading the whole file

## Searching
- Be specific: `pattern: "class TokenOptimizer"` beats `pattern: "Token"`
- Use `type` filter on Grep (e.g., `type: "ts"`) to skip irrelevant files
- Use `head_limit` to cap results — you rarely need more than 10 matches
- Search → find the exact file → read only that file

## Responses
- Lead with the answer, not the reasoning
- Skip preamble: "I will now..." / "Let me..." / "Sure!" → delete
- No summaries at the end of tool calls
- Code blocks only when showing actual code to write/edit
- One sentence per concept — no filler

## Agent Delegation
- Delegate broad exploration to subagents to protect main context
- Pass only the minimal context the subagent needs
- Request structured output (bullet list, JSON) — not prose
- Do NOT re-read files the subagent already read

## Edits
- Use `Edit` (diff) over `Write` (full rewrite) whenever possible
- Batch related edits in one `Edit` call when in the same region
- Do not reformat code you didn't change

## Planning
- Write plans as numbered bullet lists — not paragraphs
- Max 7 items; split into phases otherwise
- Each item: one action + one outcome

## What Wastes Tokens
| Waste | Fix |
|-------|-----|
| Reading full files for one value | Grep first |
| Re-explaining context that exists | Reference it, don't repeat |
| Long preambles before answers | Delete them |
| Adding comments to unchanged code | Don't |
| Multiple search passes for same thing | Design the query right first |
| Printing large diffs in chat | Use Edit tool silently |

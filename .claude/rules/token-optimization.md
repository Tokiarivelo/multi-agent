# Token Optimization

## Reading
- Grep before Read — never read a full file to find one value
- Use `offset`+`limit` on Read for large files
- `Grep output_mode:"content"` with context lines beats reading the whole file

## Searching
- Specific patterns: `"class TokenOptimizer"` not `"Token"`
- Use `type` filter and `head_limit` — rarely need > 10 matches

## Responses
- Lead with the answer; skip preamble ("I will now...", "Let me...")
- No trailing summaries after tool calls
- Code blocks only for actual code to write/edit

## Edits
- `Edit` (diff) over `Write` (full rewrite) whenever possible
- Don't reformat code you didn't change

## Plans
- Numbered bullet lists, max 7 items; split into phases beyond that

## Waste Table
| Waste | Fix |
|-------|-----|
| Full file read for one value | Grep first |
| Repeated context | Reference it, don't repeat |
| Long preambles | Delete |
| Multiple search passes | Design query right first |
| Large diffs printed in chat | Use Edit silently |

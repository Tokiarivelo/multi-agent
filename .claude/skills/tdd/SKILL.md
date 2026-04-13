---
name: tdd
description: Activate the tdd-guide agent to implement a feature or fix using strict test-driven development
model: claude-sonnet-4-6
version: 1.0.0
context: fork
---

Activate the `tdd-guide` agent for the following feature or bug:

$ARGUMENTS

Strict sequence: read interface → write failing tests → run (confirm FAIL) → implement minimum → run (confirm PASS) → refactor if needed. Do NOT skip any phase. Report each test run result.

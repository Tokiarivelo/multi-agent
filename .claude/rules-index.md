# Rules Index

Load rules on demand — grep this file first, then read only the file you need.

## Project Rules (`.claude/rules/`)

| File | Load when... |
|------|-------------|
| `common.md` | general code style, error handling, naming, git format, security basics |
| `planning.md` | task needs 3+ file changes, architectural decision, plan format |
| `testing.md` | writing tests, TDD workflow, coverage targets, mock patterns, vitest setup |
| `typescript.md` | strict TS config, Zod validation, discriminated unions, async patterns |
| `token-optimization.md` | session feels bloated, before complex multi-file operation |

## Global Rules (`~/.claude/rules/`)

### common/
| File | Load when... |
|------|-------------|
| `common/coding-style.md` | immutability questions, file size limits, nesting depth |
| `common/git-workflow.md` | commit format, PR workflow, branch strategy |
| `common/testing.md` | test types, TDD mandate, coverage minimums |
| `common/development-workflow.md` | full feature pipeline: research → plan → TDD → review → commit |
| `common/agents.md` | which agent to use, parallel task execution, multi-perspective analysis |
| `common/performance.md` | model selection (Haiku/Sonnet/Opus), context window management |
| `common/security.md` | pre-commit security checklist, secret management, OWASP |
| `common/hooks.md` | PreToolUse/PostToolUse hooks, auto-accept permissions, TodoWrite |
| `common/patterns.md` | repository pattern, API response format, skeleton project approach |

### Language-specific (load only for that language)
| File | Load when... |
|------|-------------|
| `typescript/coding-style.md` | TS formatting, idioms, type patterns |
| `typescript/testing.md` | TS-specific test setup and patterns |
| `typescript/patterns.md` | TS design patterns |
| `typescript/security.md` | TS/Node.js security specifics |
| `typescript/hooks.md` | TS formatter/linter hooks |
| `golang/` | any Go code |
| `python/` | any Python code |
| `kotlin/` | any Kotlin/Android code |
| `swift/` | any Swift/iOS code |
| `php/` | any PHP/Laravel code |
| `cpp/` | any C++ code |
| `perl/` | any Perl code |

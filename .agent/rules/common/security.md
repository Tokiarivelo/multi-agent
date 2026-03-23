---
trigger: always_on
---
# Security & Workspace Rules

## 1️⃣ Server-Side Path (`nativePath`) Rules
The `nativePath` on a workspace entry is the **only** authorized root for server-side file and shell operations.

**Validation rules:**
- `nativePath` MUST be an absolute path:
  - Unix: starts with `/`
  - Windows: starts with a drive letter
- `nativePath` MUST NOT be empty, whitespace, or a relative path (`.`, `..`, `./`).
- DO NOT duplicate path validation logic. Use `frontend/src/features/workspace/utils/pathValidation.ts`.

## 2️⃣ Write Permission Rules
- `WORKSPACE_WRITE` / `WORKSPACE_READ` nodes MUST use the browser WebSocket bridge (`workspace:request` / `workspace:response`). No server-side path needed.
- `SHELL` nodes MUST use the workspace `nativePath` as `cwd`. Fail if missing or not absolute.
- Server-side file writes outside of a workspace with a valid `nativePath` are **forbidden**.
- Never inject `cwd` from untrusted user input without absolute-path validation.

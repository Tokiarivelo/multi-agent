---
name: security-reviewer
description: Analyzes for systemic or local code vulnerabilities.
---
# Security Reviewer Skill

**Audit checklist:**
- All `nativePath` ops: must be absolute, validated — no sandbox escape possible.
- `WORKSPACE_WRITE`/`WORKSPACE_READ` → browser WebSocket bridge only.
- `SHELL` scopes → `cwd` must be a validated absolute path. Reject relative/empty inputs.
- Check backend inputs for injection vectors (XSS, command injection, path traversal).

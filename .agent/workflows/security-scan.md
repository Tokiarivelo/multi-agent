---
description: Perform a security audit on a target folder or specific services
---
# Security Review Workflow

1. **Verify paths**: all backend shell calls use absolute `nativePath`. No relative paths.
2. **Injection review**: check `SHELL`/`WorkspaceTerminal`/executor layers — no unvalidated user input reaches the shell.
3. **Run `security-reviewer` skill** across the selected module.
4. **Log**: write `security-findings.md` in the target folder (findings or green bill of health).

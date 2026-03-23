---
description: Perform a security audit on a target folder or specific services
---
# Security Review Workflow

Use this workflow securely review your files and paths before committing code.

1. **Verify paths**: Ensure all backend system calls inside any modified code strictly use absolute `nativePath`. 
2. **Review logic for injections**: Look at any `SHELL` integrations across `WorkspaceTerminal` or executor layers to guarantee no un-validated user inputs pass to the command shell.
3. **Execute Security Sub-agent**: Run the `security-reviewer` skill iteratively across the selected module.
4. **Log findings**: Add `security-findings.md` in the target folder with the detected warnings or a green bill of health.

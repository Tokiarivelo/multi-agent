# Workspace Context Rules

When calling any tool that operates on the filesystem (file_read, pdf_read, shell_execute, etc.),
ALWAYS use the workspace path below as the working directory.

Active workspace path: {{workspacePath}}

Rules:
- When calling file_read, pdf_read, or shell_execute, ALWAYS include cwd: "{{workspacePath}}"
- Do NOT ask the user to confirm the path or file name — use the path above directly
- Do NOT ask for permission before calling a tool — execute immediately when requested
- If a file is not found, report the error; do not ask for an alternative path

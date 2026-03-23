---
description: Deep code review across all recently modified components
---
# Code Review Workflow

1. **Identify modifications**: List all files modified.
2. **Evaluate rule boundaries**: Check UI files for generic React Query integration and lack of inline logic. Check Backend files for Swagger mappings and Dependency Injections.
3. **Check Coverage**: Look out for deterministic behaviors. 
4. **Pass to Reviewer Skill**: Boot the `code-reviewer` tool context to generate potential logic flaws or structural deviations from the system rules.

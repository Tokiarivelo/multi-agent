---
description: Test-Driven Development flow
---
# TDD Workflow

Use this workflow whenever generating any feature code.

1. **Write failing tests**: Navigate to `.spec.ts` files or create them first. Define behavior based on the feature request.
2. **Implement minimal logic**: Create the simplest code structure to pass the test cases.
3. **Run testing tools**: Check testing outcomes. Add or update Mock files for DB, llm layers, or NATS interactions.
4. **Refactor**: Clean up the files, enforce typescript rules, and optimize token/loop efficiency. 

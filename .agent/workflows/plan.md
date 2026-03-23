---
description: Architecture system design and planning step
---
# Planning Workflow

Use this workflow to structure a new service, package, or component before executing any scripts.

1. **Blueprint generation**: Using the `architect` skill, output a markdown file stating exactly where each item will go.
2. **Validate rules**: Ensure the blueprint adheres strictly to the modularity constraints (e.g., UI separated from business logic, DB separated from routing).
3. **Map NATS events**: Define specific typing events for any inter-service communication inside `packages/events`.
4. **Update Documentations**: Generate multi-language support (EN & FR) readmes for the proposed feature.

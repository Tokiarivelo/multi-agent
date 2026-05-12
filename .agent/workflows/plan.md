---
description: Architecture system design and planning step
---
# Planning Workflow

1. **Blueprint** (`architect` skill): output a markdown file with exact file placement per service.
2. **Validate**: modularity constraints met (UI/logic/DB separation, no coupling).
3. **NATS events**: define typed contracts in `packages/events` for all inter-service comms.
4. **Docs**: generate EN + FR readmes for the proposed feature.

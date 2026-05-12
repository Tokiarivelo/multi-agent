---
name: architect
description: Generates clean, scalable multi-service structural designs.
---
# Architect Skill

**Checklist for every design:**
- `model-service` handles all LLM orchestration — never direct LLM calls in other services.
- Inter-service comms → `nats-client` with typed events from `packages/events`.
- No direct DB polling across services.
- Strict `.ts` boundaries. Add `Makefile` entries (`dev` + `test`). Deterministic behaviors.
- Output blueprints in EN + FR.

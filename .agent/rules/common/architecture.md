---
trigger: always_on
---
# Architecture & Structural Integrity

## 1️⃣ Structure Enforcement
- NEVER break folder structure.
- NEVER mix responsibilities between services.
- Shared logic MUST go in `packages/`.
- No duplicated code across services.

**Placement Rules:**
- `common` → reusable utilities
- `types` → shared TS types
- `events` → typed event contracts
- `nats-client` → messaging logic
- `database` → Prisma & DB layer

## 2️⃣ Modularity & Coupling
- Decoupled, Modular, Reusable, Testable.
- Controllers ≠ business logic.
- Infrastructure ≠ domain logic.
- No hardcoded configs. Dependency injection required.
- LLM access only via `model-service`.
- No direct DB access across services.

## 3️⃣ Event-Driven Discipline
- All inter-service communication via NATS.
- Use typed contracts from `packages/events`.
- No implicit payloads.
- Version events when required.

## 4️⃣ Makefile Rules
When creating a new Service, Command, Migration, or Workflow:
- Update `Makefile`.
- Add `dev` + `test` commands.
- Keep `Makefile` aligned with capabilities.

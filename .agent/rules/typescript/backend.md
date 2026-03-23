---
trigger: always_on
---
# Backend Discipline

- Always update the Swagger documentation (OpenAPI schema) for any new endpoints or DTO changes.
- Ensure strict separation of NestJS Controllers and Services.
- Dependency injection must be comprehensive.
- Event messages via NATS must rely on strongly typed event definitions from `packages/events`.

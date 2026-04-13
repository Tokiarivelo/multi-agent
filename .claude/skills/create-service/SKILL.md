---
name: create-service
description: Scaffold a full NestJS microservice with clean architecture, tests, gateway registration, and all boilerplate
model: claude-sonnet-4-6
version: 1.1.0
context: fork
---

You are scaffolding a new NestJS microservice for the **multi-agent** pnpm monorepo.
Code templates are in `.claude/skills/create-service/TEMPLATES.md` — read it before generating files.

## Input

`$ARGUMENTS` — one of:
- `<name>` — e.g. `notification`
- `<name> <port>` — e.g. `notification 3012`
- `<name> <port> <description>` — e.g. `notification 3012 "sends emails and push alerts"`

If port is omitted, read `services/gateway-service/src/infrastructure/config/env.validation.ts` and pick the next free port.
If description is omitted, infer from the name.

---

## Pre-Generation Steps

1. **Read** `TEMPLATES.md` — load all code templates.
2. **Read** `services/gateway-service/src/infrastructure/config/env.validation.ts` — determine next free port if needed.
3. **Read** `services/gateway-service/src/presentation/controllers/proxy.controller.ts` — find the router switch insertion point.
4. **Read** `packages/database/prisma/schema.prisma` — verify no model name collision.

---

## Files to Generate

Replace placeholders per `TEMPLATES.md`. Generate every file:

```
services/{{NAME}}-service/
├── src/
│   ├── main.ts
│   ├── app.module.ts
│   ├── domain/
│   │   ├── {{NAME}}.entity.ts
│   │   └── {{NAME}}.repository.interface.ts
│   ├── application/
│   │   ├── dto/
│   │   │   ├── create-{{NAME}}.dto.ts
│   │   │   ├── update-{{NAME}}.dto.ts
│   │   │   └── list-{{NAME}}.dto.ts
│   │   └── use-cases/
│   │       ├── create-{{NAME}}.use-case.ts
│   │       ├── get-{{NAME}}.use-case.ts
│   │       ├── list-{{NAME}}s.use-case.ts
│   │       ├── update-{{NAME}}.use-case.ts
│   │       └── delete-{{NAME}}.use-case.ts
│   ├── infrastructure/
│   │   ├── config/
│   │   │   ├── config.module.ts
│   │   │   └── env.validation.ts
│   │   ├── messaging/
│   │   │   └── nats.module.ts
│   │   └── persistence/
│   │       └── prisma-{{NAME}}.repository.ts
│   └── presentation/
│       ├── controllers/
│       │   ├── {{NAME}}.controller.ts
│       │   └── health.controller.ts
│       └── filters/
│           └── http-exception.filter.ts
├── test/
│   ├── {{NAME}}.e2e-spec.ts
│   └── jest-e2e.json
├── Dockerfile
├── nest-cli.json
├── tsconfig.json
├── tsconfig.build.json
└── package.json
```

---

## Gateway Integration (do immediately after file generation)

1. **`services/gateway-service/src/infrastructure/config/env.validation.ts`** — add `{{UPPER_NAME}}_SERVICE_URL` (template in `TEMPLATES.md`).
2. **`services/gateway-service/src/presentation/controllers/proxy.controller.ts`** — add `case '{{SLUG}}'` to the router switch (template in `TEMPLATES.md`).

---

## Post-Generation Checklist

- [ ] All placeholders substituted (`{{NAME}}`, `{{PascalName}}`, `{{UPPER_NAME}}`, `{{SLUG}}`, `{{PORT}}`)
- [ ] Gateway `env.validation.ts` updated
- [ ] Gateway `proxy.controller.ts` updated
- [ ] No symbol collision with existing Prisma models

---

## Output Summary

```
## {{PascalName}} Service Created

**Port:** {{PORT}}
**Route:** /api/{{SLUG}}/...
**Package:** @multi-agent/{{NAME}}-service

### Files Generated
- services/{{NAME}}-service/  (N files)

### Gateway Integration Done
- env.validation.ts: {{UPPER_NAME}}_SERVICE_URL added
- proxy.controller.ts: case '{{SLUG}}' added

### Manual Steps Required
1. Add Prisma model — template in TEMPLATES.md
2. pnpm prisma:migrate && pnpm prisma:generate
3. Add docker-compose.yml entry — template in TEMPLATES.md
4. Register NATS subjects if needed — template in TEMPLATES.md
```

# Plan — Multi-tenant Organizations & Teams

## Goal

Introduce multi-tenant Organizations and Teams so that users can create/join organizations, share resources (agents, workflows, API keys, files, vector collections) at the org level, manage team-based roles and permissions, and provide org-scoped data isolation across all existing microservices — replacing the current single-user ownership model with an optional org context.

---

## Changes

### Phase 1 — Data Model & Shared Types

1. **`packages/database/prisma/schema.prisma`** — Add `Organization`, `OrganizationMember`, `Team`, `TeamMember` models with enums (`OrgMemberRole`, `TeamRole`). Add optional `organizationId` FK to `User`, `Workflow`, `Agent`, `ApiKey`, `File`, `VectorCollection`, `ChatSession`, `Execution`. Add `orgSlug` unique index on `Organization` for URL-friendly identifiers.
   - Migration: `add_organizations_and_teams`

2. **`packages/types/` + `packages/common/`** — Define shared TypeScript types:
   - `OrganizationContext { orgId: string; orgRole: OrgMemberRole; teamIds: string[] }`
   - Permission constants: `ORG_PERMISSIONS`
   - Utility: `resolveOwnerId(user, orgContext)` → returns `userId` or `organizationId` based on active context

### Phase 2 — Gateway & Auth

3. **`services/gateway-service/`**
   - Extend `JwtPayload` with optional `organizationId`, `orgRole`, `teamIds[]`
   - Extend `jwt.strategy.ts` `validate()` to look up active org membership and inject org context
   - Add `org-context.middleware.ts`: reads `X-Organization-Id` header, validates user membership, enriches request
   - Forward `X-Organization-Id` header in `proxy.controller.ts` to downstream services
   - Add proxy cases for `/api/organizations/*` and `/api/teams/*`

### Phase 3 — Org/Team Business Logic (orchestration-service)

4. **`services/orchestration-service/`**
   - Refactor `workflow.repository.ts` queries: `{ OR: [{ userId }, { organizationId }] }` when org context is present
   - Add `OrgMemberGuard`: enforces role (`OWNER`/`ADMIN` for destructive ops, `MEMBER` for read/execute)
   - Organization CRUD: create org, invite member (email), accept/decline invite, remove member, transfer ownership
   - Team CRUD: create team within org, add/remove members, assign team to workflow

### Phase 4 — Org-Scoped Queries in All Services

5. **`services/agent-service/` + `services/file-service/` + `services/vector-service/` + `services/model-service/`**
   - Extract org-context parsing into a shared NestJS interceptor in `packages/common/`
   - Each service reads `organizationId` from request (injected by gateway)
   - Repositories use org-scoped `where` clauses alongside `userId`
   - Resources created in org context get `organizationId` set → visible to all org members

### Phase 5 — Frontend

6. **`frontend/src/features/organizations/`**
   - Org switcher component in sidebar/header (stores active `organizationId` in Zustand, sends as `X-Organization-Id` header)
   - Org settings page: create org, manage members (invite, roles, remove)
   - Team management UI within org settings
   - i18n: `locales/en/organizations.ts` + `locales/fr/organizations.ts`, registered in `locales/{en,fr}/index.ts`

### Phase 6 — Tests

7. **Tests**
   - Unit: `OrgMemberGuard` enforces role hierarchy, `resolveOwnerId` returns correct id
   - Integration: workflow created in org context is visible to all org members, not to non-members
   - Unit: org switcher correctly sets `X-Organization-Id` header
   - Guard tests per service: org-scoped queries return correctly isolated data

---

## Risks

| Risk | Mitigation |
|------|------------|
| **Breaking existing single-user queries** | `organizationId` is nullable (default `null`). Existing data stays user-scoped. `OR` clause added only when org context is present. |
| **JWT payload bloat** | Keep JWT lean: only `organizationId` + `orgRole`. Fetch `teamIds` lazily and cache in gateway middleware. |
| **Migration on live data** | Nullable columns with no default are non-blocking in PostgreSQL. Create indexes with `CREATE INDEX CONCURRENTLY` in a separate migration step. |
| **Subscription plan overlap** | `plan-subscriptions.md` already defines `Organization` and `OrganizationMember` for billing. Use same models; billing adds Stripe-specific fields on top. Coordinate schemas. |
| **Permission model complexity** | Precedence: per-resource collaborator > team role > org role > platform role. Document in `PERMISSIONS.md`. In v1, team roles are read-only grouping — not fine-grained ACL. |
| **Cross-service consistency** | Shared NestJS interceptor in `packages/common/` parses org context once, imported by all services. No duplicated logic. |

---

## Out of Scope

- **Billing / Stripe integration** — `plan-subscriptions.md`
- **SSO / SAML / OIDC** — `plan-sso-enterprise.md`
- **Org-level audit logging** — `plan-audit-rgpd.md`
- **Cross-org workflow sharing / marketplace** — `marketplace-beta-plan.md`
- **Nested teams / team hierarchy** — flat teams only in v1
- **Per-team resource quotas** — org-level quotas only in v1
- **Org-level API key pooling** — each member brings their own LLM API keys in v1

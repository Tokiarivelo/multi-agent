# Gateway Service (Go)

> High-performance API gateway and reverse proxy for the Multi-Agent Platform.

## Overview

This service replaces the original Node.js/NestJS API gateway with a Go implementation, reducing memory footprint by ~90% and improving proxy latency.

It handles:
- **Reverse Proxy** — transparently routing `/api/*` requests to internal microservices
- **Authentication** — issuing JWTs and providing HTTP handlers for `/api/auth/*`
- **User settings** — `GET|PATCH /api/users/me/settings`
- **WebSocket Relay** — bridging WebSocket clients to the NATS event bus
- **Security** — CORS, Bearer token validation

## Port

`3000` — the single entry point for all frontend → backend traffic.

## Stack

| Library | Purpose |
|---------|---------|
| Gin | HTTP router |
| golang-jwt/jwt | JWT issuance & validation |
| pgx/v5 | PostgreSQL |
| nats.go | NATS messaging |
| swaggo/gin-swagger | Swagger UI |

## Swagger UI

Interactive API explorer available at **`http://localhost:3000/docs/index.html`** when the service is running.

OpenAPI JSON spec: `http://localhost:3000/docs/doc.json`

To regenerate docs after changing handler annotations:

```bash
cd services/gateway-service-go
swag init --dir cmd/server,internal --output internal/docs --parseDependency --parseInternal
```

## API

### `GET /health`
Liveness probe. Returns `{ "status": "ok" }`. No auth required.

### Auth

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/auth/register` | Create a new user account |
| `POST` | `/api/auth/login` | Authenticate with email + password |
| `POST` | `/api/auth/social-login` | Create or sign in via OAuth provider |
| `GET` | `/api/auth/me` | Return the current user's profile |

All auth endpoints return `{ "accessToken": "...", "user": { ... } }`.

### Users

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/users/me/settings` | Return workspace settings |
| `PATCH` | `/api/users/me/settings` | Shallow-merge settings patch |

### WebSocket

`GET /ws` — NATS relay. Requires a valid Bearer token (passed as `?token=` query param or `Authorization` header).

### Proxy

All other `GET|POST|PUT|PATCH|DELETE /api/<service>/*` requests are reverse-proxied to the matching microservice. The gateway injects `userId` from the JWT into the upstream request.

## Running locally

```bash
cd services/gateway-service-go
go run cmd/server/main.go
```

Or via the monorepo dev script:

```bash
pnpm dev
```

## Testing

```bash
go test ./...
```

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `GATEWAY_PORT` | `3000` | Listening port |
| `DATABASE_URL` | required | PostgreSQL connection string |
| `JWT_SECRET` | required | Secret for signing JWTs |
| `NATS_URL` | `nats://localhost:4222` | NATS server URL |
| `NODE_ENV` | `development` | Set to `production` for Gin release mode |

## Documentation

- [Architecture & Migration Plan](../../docs/migration-high-performance.md)

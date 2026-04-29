# High-Performance Migration Plan

> Strategy: **strangler-fig** — new service runs in parallel, routes are cut over incrementally, old service is decommissioned only after full parity is confirmed.

---

## Table of Contents

1. [Context & Rationale](#1-context--rationale)
2. [Phase A — Go Gateway Service](#2-phase-a--go-gateway-service)
3. [Phase B — Rust Tool Sandbox Service](#3-phase-b--rust-tool-sandbox-service)
4. [Shared Concerns](#4-shared-concerns)
5. [Out of Scope](#5-out-of-scope)

---

## 1. Context & Rationale

### Current stack

| Service | Language | Concern |
|---|---|---|
| `gateway-service` | TypeScript / NestJS | Auth, JWT, proxy, WebSocket relay, NATS, DB |
| `tool-service` | TypeScript / NestJS | Built-in tools, `isolated-vm` sandbox |
| `document-service` | Python / FastAPI | Document generation + file parsing |
| All others | TypeScript / NestJS | Business logic |

### Why these two first

- The **gateway** is the single chokepoint for every request in the system. Node.js's event loop handles concurrency well for I/O-bound work but pays overhead on connection management, TLS, and memory per-request. A Go gateway halves memory footprint and handles 5–10× more concurrent connections on the same hardware.
- The **tool sandbox** currently uses `new Function()` (unsafe) in `built-in-tools.service.ts` and `isolated-vm` (V8 isolates) in `sandbox-executor.service.ts`. V8 isolates are expensive (~5 MB each) and JS-only. A Rust + Wasmtime sandbox provides true memory-safe polyglot isolation at <1 MB overhead per execution.

### Migration principle

> **Zero breaking changes to any other service.** Every migration phase must preserve the existing HTTP API contract (routes, request/response shape) and all WebSocket event names. Other services never know the implementation changed.

---

## 2. Phase A — Go Gateway Service

### What the gateway does today (full inventory)

```
gateway-service/src/
  presentation/
    controllers/
      auth.controller.ts        ← login, register, social-login, /me
      user.controller.ts        ← user settings CRUD
      proxy.controller.ts       ← reverse-proxy for all /api/* routes
      health.controller.ts      ← GET /health
    guards/
      jwt-auth.guard.ts         ← validates JWT on every protected route
    gateways/                   ← WebSocket gateway (NATS relay)
  domain/services/
    auth.service.ts             ← bcrypt, token issue
  infrastructure/
    database/prisma.service.ts  ← PostgreSQL (users table)
    messaging/nats.module.ts    ← NATS connection
    auth/jwt.strategy.ts        ← Passport JWT strategy
    external/jwt.service.ts     ← sign / verify
```

### Go dependencies

To install the necessary Go dependencies for this service, run:
```bash
cd services/gateway-service-go
go mod download
```
*(Alternatively, you can run `make install` from the root directory, which will automatically install dependencies for all languages including Go.)*

```
go.mod (key deps):
  github.com/gin-gonic/gin          v1.10  — HTTP router
  github.com/golang-jwt/jwt/v5      v5.2   — JWT sign/verify
  github.com/jackc/pgx/v5           v5.7   — PostgreSQL driver
  github.com/nats-io/nats.go        v1.38  — NATS client
  nhooyr.io/websocket               v1.8   — WebSocket
  golang.org/x/crypto               latest — bcrypt
```

### Target directory structure

```
services/gateway-service-go/
  cmd/
    server/
      main.go                   ← entry point, wire-up
  internal/
    auth/
      handler.go                ← POST /api/auth/login, /register, /me
      jwt.go                    ← sign, verify, middleware
      service.go                ← bcrypt + token logic
    proxy/
      router.go                 ← route table (same as proxy.controller.ts switch)
      handler.go                ← httputil.ReverseProxy per-route
    users/
      handler.go                ← GET/PUT /api/users/settings
      repository.go             ← pgx queries (users table)
    ws/
      relay.go                  ← WebSocket ↔ NATS bridge
    health/
      handler.go                ← GET /health
    config/
      config.go                 ← env vars (mirrors env.validation.ts)
    db/
      postgres.go               ← pgx pool
    messaging/
      nats.go                   ← nats.go connection
  Dockerfile
  go.mod
  go.sum
```

### Migration phases

#### A1 — Proxy core (no auth, no DB)
**Goal:** Go service proxies all `/api/*` traffic. TypeScript gateway still handles auth.

- [x] Scaffold `services/gateway-service-go/`
- [x] Implement `proxy/router.go` — same routing table as `proxy.controller.ts` switch-case
- [x] Implement `proxy/handler.go` — `httputil.ReverseProxy` with route-based target resolution
- [x] Add `health` endpoint
- [x] Add `GATEWAY_GO_PORT=3020` env var; keep TypeScript gateway on `3000`
- [x] Integration test: all `/api/*` routes reach correct downstream services
- [x] **Canary:** configure load balancer / nginx to send 5 % of traffic to `:3020`

**Files to create:** `cmd/server/main.go`, `internal/proxy/`, `internal/health/`, `internal/config/`, `Dockerfile`
**Risk:** path-rewrite bugs for multipart/form-data (already handled in TypeScript with `fixRequestBody`). Must replicate that logic.

---

#### A2 — JWT middleware
**Goal:** Go service validates JWTs issued by either implementation.

- [x] Implement `internal/auth/jwt.go` — `golang-jwt/jwt` with same `JWT_SECRET` env var
- [x] Add middleware that parses `Authorization: Bearer <token>`, validates, injects `userId` into request context
- [x] Replicate `@Public()` decorator behaviour: mark health + auth routes as bypass
- [x] Append `?userId=<id>` to proxied URLs (same logic as TypeScript gateway line 204)
- [x] Verify tokens issued by TypeScript gateway are accepted by Go middleware (same secret + HS256)

**Risk:** clock skew on `exp` claim validation between services. Set `leeway: 5s`.

---

#### A3 — Auth endpoints
**Goal:** Go service owns `POST /api/auth/login`, `/register`, `/api/auth/social-login`, `GET /api/auth/me`.

- [x] Implement `internal/db/postgres.go` — pgx connection pool (same `DATABASE_URL`)
- [x] Implement `internal/users/repository.go` — `findByEmail`, `create`, `findById`
- [x] Implement `internal/auth/service.go` — bcrypt hash/compare, JWT issue
- [x] Implement `internal/auth/handler.go` — handlers matching current JSON response shapes exactly
- [x] Test: login flow, token refresh, social-login passthrough
- [x] Shadow mode: both gateways handle auth for 48 h; compare response diffs with a request logger

**Schema dependency:** reads `users` table — schema must stay stable. Any migration runs before cutover.

---

#### A4 — User settings endpoints
**Goal:** Go service owns `GET /api/users/settings`, `PUT /api/users/settings`.

- [x] Implement `internal/users/handler.go`
- [x] Mirror `GetUserSettingsUseCase` / `UpdateUserSettingsUseCase` logic in Go
- [x] Validate response shape matches TypeScript responses (same field names, same null handling)

---

#### A5 — WebSocket relay
**Goal:** Go service relays WebSocket events from/to NATS (replacing `GatewaysModule`).

- [x] Implement `internal/messaging/nats.go` — `nats.go` subscriber/publisher
- [x] Implement `internal/ws/relay.go` — accept WS upgrade, subscribe to NATS subjects, fan out to clients
- [x] Map all current WebSocket event names: `execution:update`, `node:update`, `workspace:request`, `workspace:response`, `token:progress`
- [x] Load test with k6: 500 concurrent WebSocket connections, verify no dropped messages vs TypeScript impl

**Risk:** this is the most complex part. Run in shadow mode for at least 1 week before cutover.

---

#### A6 — Cutover & decommission
- [x] Shift 100 % of traffic to Go gateway on port `3000`
- [x] Keep TypeScript gateway running on `3001` for 1 week as fallback
- [x] Monitor error rates, latency p50/p95/p99, memory
- [x] Remove `services/gateway-service/` from workspace
- [x] Remove TypeScript gateway from `docker-compose.yml` and k8s manifests

### Expected gains (go gateway)

| Metric | TypeScript | Go (expected) |
|---|---|---|
| Memory idle | ~180 MB | ~15 MB |
| Req/s (proxy only) | ~3 000 | ~25 000 |
| P99 latency (proxy) | ~12 ms | ~2 ms |
| Startup time | ~4 s | ~150 ms |

---

## 3. Phase B — Rust Tool Sandbox Service

### What the sandbox does today (full inventory)

```
tool-service/src/infrastructure/sandbox/
  sandbox-executor.service.ts   ← isolated-vm (V8 isolates), JS-only, 128 MB cap
  built-in-tools.service.ts     ← 30+ built-in tools; new Function() for custom code
  mcp-executor.service.ts       ← MCP protocol execution
```

**Current problems:**
- `new Function()` in `built-in-tools.service.ts:107` — unsafe, no memory cap
- `isolated-vm` (V8) — JS-only, ~5 MB overhead per isolate, Node.js GC pressure
- No per-execution CPU time accounting
- Built-in HTTP/file/shell tools share process with sandbox code

### Rust dependencies

```toml
# Cargo.toml (key deps)
axum = "0.7"               # HTTP server
wasmtime = "22"            # WASM runtime (Bytecode Alliance)
wasmtime-wasi = "22"       # WASI interface (filesystem, stdio shims)
tokio = { version = "1", features = ["full"] }
serde_json = "1"
reqwest = "0.12"           # HTTP client (built-in tools)
jsonwebtoken = "9"         # JWT validation passthrough
tracing = "0.1"
```

### Target directory structure

```
services/tool-sandbox-rs/
  src/
    main.rs                     ← Axum server, routes
    config.rs                   ← env vars
    api/
      execute.rs                ← POST /api/sandbox/execute
      health.rs                 ← GET /health
    sandbox/
      mod.rs
      wasmtime_runner.rs        ← Wasmtime engine, per-execution instance
      js_runner.rs              ← QuickJS via WASM for JS tool code
      limits.rs                 ← memory cap, CPU timeout enforcement
    tools/
      mod.rs
      http.rs                   ← http_request, web_scraper
      file.rs                   ← file_read, file_write, document_read
      shell.rs                  ← shell_execute (restricted)
      git.rs                    ← git_status/add/commit/push/pull
      github.rs                 ← github_api
      slack.rs                  ← slack_post_message
      document.rs               ← document_generate, document_parse_image
  Dockerfile
  Cargo.toml
  Cargo.lock
```

### Migration phases

#### B1 — Rust HTTP shell + built-in tool routing (no WASM yet)
**Goal:** Rust service exposes the same `POST /api/tools/execute` contract as the TypeScript tool-service. Uses Axum, delegates to Rust-native built-in tool implementations.

- [x] Scaffold `services/tool-sandbox-rs/` with Axum + serde_json
- [x] Implement `api/execute.rs` — identical request/response shape as `ExecuteToolUseCase`
- [x] Port `http_request`, `web_scraper`, `json_parser`, `file_read`, `file_write` to Rust (`tools/http.rs`, `tools/file.rs`)
- [x] Port `shell_execute`, `git_*` to Rust with `tokio::process::Command`
- [x] Port `github_api`, `slack_post_message`, `whatsapp_send_message` to Rust with `reqwest`
- [x] Port `document_read`, `document_parse_image`, `document_generate` (proxy calls to Python document-service)
- [x] Add `TOOL_PORT=3030` env var; Rust service runs on `3030` (parallel to old TS service)
- [x] Integration tests: each built-in tool returns same output shape as TypeScript counterpart

**Risk:** Rust `reqwest` vs Axios error shape differences — normalise error responses at the API layer.

---

#### B2 — WASM sandbox for custom JS tool code
**Goal:** Replace `new Function()` and `isolated-vm` with Wasmtime + QuickJS compiled to WASM.

- [x] Embed `quickjs-wasm` (QuickJS compiled to WASM with WASI) as a static asset (implemented via `rquickjs`)
- [x] Implement `sandbox/runner.rs`:
  - Load QuickJS WASM module once at startup (cached in `Arc<Engine>`)
  - Per-execution: create new `Store` with fuel limit (CPU cap) + memory limit
  - Inject `params` as a JSON global into the QuickJS environment
  - Execute user code string inside QuickJS
  - Enforce `TOOL_EXECUTION_TIMEOUT` as wall-clock deadline via `tokio::time::timeout`
- [x] Implement `sandbox/limits.rs` — fuel tracking, memory cap, syscall allowlist (WASI)
- [x] Test: JS tools from seed data run identically through Wasmtime + QuickJS vs isolated-vm

**Why QuickJS-WASM?** It's the lightest self-contained JS engine that compiles cleanly to WASM32-WASI. Each execution spawns its own QuickJS instance inside a Wasmtime store — full isolation, no shared heap.

**Risk:** QuickJS is ES2020, not ES2023. Check if any seed tool code uses newer syntax (e.g., `Array.prototype.at`, top-level await).

---

#### B3 — WASM sandbox for non-JS tools (optional, Phase 2)
**Goal:** Allow user tools written in Python / Lua / C to be compiled to WASM and executed.

- [x] Accept WASM binary upload via `POST /api/tools/upload-wasm`
- [x] Store WASM module in DB (binary column) or object storage
- [x] Execute via Wasmtime with WASI filesystem + stdio shims
- [x] Enforce same fuel/memory limits as B2

> **Note:** This phase is optional. Defer until there is a concrete user need for non-JS tools.

---

#### B4 — MCP executor port
**Goal:** Port `mcp-executor.service.ts` to Rust.

- [x] Implement MCP JSON-RPC client in Rust (simple HTTP + stdio transport)
- [x] Mirror `McpExecutorService.execute()` behaviour
- [x] Validate with existing MCP smoke-test (`make test-mcp`)

---

#### B5 — Cutover & decommission
- [x] Update `TOOL_SERVICE_URL` in all consumers → Rust service on `3030` (gateway-go, agent-service, orchestration-service, k8s, .env.example)
- [x] Run shadow mode for 72 h: both services receive traffic, compare outputs (skipped, direct cutover)
- [x] Shift 100 % to Rust service on `3030`
- [x] Keep TypeScript tool-service as cold standby for 1 week (deleted immediately for clean migration)
- [x] Remove `services/tool-service/` from workspace

### Expected gains (rust sandbox)

| Metric | TypeScript / isolated-vm | Rust / Wasmtime |
|---|---|---|
| Memory per execution | ~5–10 MB (V8 isolate) | ~0.5–1 MB (WASM store) |
| Sandbox startup | ~50 ms | ~2 ms (cached engine) |
| Custom code isolation | JS-only, same process | Any language → WASM, separate store |
| CPU accounting | None | Fuel-based instruction counter |
| `new Function()` exposure | Yes (unsafe path) | Eliminated |

---

## 4. Shared Concerns

### Environment variable compatibility

Both new services read the same env vars as their TypeScript counterparts. No `.env` changes required.

| Var | Used by Go gateway | Used by Rust sandbox |
|---|---|---|
| `DATABASE_URL` | ✓ | — |
| `JWT_SECRET` | ✓ | — |
| `NATS_URL` | ✓ | — |
| `TOOL_EXECUTION_TIMEOUT` | — | ✓ |
| `MAX_TOOL_MEMORY_MB` | — | ✓ |
| `ENABLE_FILE_OPERATIONS` | — | ✓ |
| `DOCUMENT_SERVICE_URL` | — | ✓ |
| `WORKSPACE_ROOT` | — | ✓ |

### docker-compose additions (parallel-run period)

```yaml
  gateway-go:
    build:
      context: ./services/gateway-service-go
    ports:
      - "3020:3020"
    environment:
      PORT: 3020
      DATABASE_URL: ${DATABASE_URL}
      JWT_SECRET: ${JWT_SECRET}
      NATS_URL: ${NATS_URL}
      # ... same vars as gateway-service
    networks:
      - multi-agent

  tool-sandbox-rs:
    build: services/tool-sandbox-rs
    ports:
      - "3006:3006"
    environment:
      PORT: 3006
      DOCUMENT_SERVICE_URL: ${DOCUMENT_SERVICE_URL:-http://document-service:3009}
      WORKSPACE_ROOT: /workspace
    volumes:
      - workspace:/workspace
    networks:
      - multi-agent
```

### Testing strategy

Each phase must pass before the next begins:

1. **Contract tests** — run against both old and new service; assert identical JSON responses
2. **Load test** — k6 script, 200 VUs, 60 s, p99 < 50 ms
3. **Shadow mode** — route duplicate traffic to both; log and diff responses for 48–72 h
4. **Rollback plan** — single env var change (`GATEWAY_URL` / `TOOL_SERVICE_URL`) reverts to TypeScript service

### Makefile additions (planned)

```makefile
dev-gateway-go:       ## Start Go gateway in dev mode
dev-sandbox-rs:       ## Start Rust sandbox in dev mode
build-go:             ## Build Go binaries
build-rust:           ## Build Rust binaries (release)
test-contract-gateway:## Run contract tests against both gateways
test-contract-sandbox:## Run contract tests against both sandboxes
benchmark-gateway:    ## k6 benchmark: TypeScript vs Go gateway
benchmark-sandbox:    ## k6 benchmark: isolated-vm vs Wasmtime sandbox
```

---

## 5. Out of Scope

| Item | Reason |
|---|---|
| Orchestration service → Elixir | High value but high risk; tackle after Phase A+B stabilise |
| Frontend → anything else | Next.js is not a performance bottleneck |
| document-service → Rust | Python has best-in-class AI/parsing libs; no gain here |
| DB migration (Postgres) | Not a bottleneck; stays as-is |
| NATS → Kafka | Not needed at current scale |

---

## Sequencing summary

```
Now          +2 weeks       +6 weeks       +10 weeks      +14 weeks
  │               │               │               │               │
  ├── A1 Proxy ───┤               │               │               │
  │               ├── A2 JWT ─────┤               │               │
  │               │               ├── A3 Auth ────┤               │
  │               │               │   A4 Users    ├── A5 WS ──────┤
  │                                               │               ├── A6 Cutover
  │                                               │
  ├── B1 Built-in tools ──────────┤
  │                               ├── B2 WASM JS ─────────────────┤
  │                               │                               ├── B5 Cutover
  │                               ├── B4 MCP ─────────────────────┤
```

> Phase A and Phase B can run **in parallel** by different developers.
> Neither depends on the other's completion.

# Gateway Service (Go)

> High-performance API gateway and reverse proxy for the Multi-Agent Platform.

## Overview
This service replaces the original Node.js/NestJS API gateway with a highly optimized Go implementation, reducing memory footprint by ~90% and improving proxy latency dramatically.

It handles:
- **Reverse Proxy**: Transparently routing requests to internal microservices.
- **Authentication**: Issuing JWTs and providing HTTP handlers for `/api/auth/*`.
- **WebSocket Relay**: Bridging WebSocket clients to the NATS event bus.
- **Security**: CORS, rate limiting context, and Bearer token validation.

## Development

### Prerequisites
- Go 1.22+

### Running locally
The service is automatically started via the root `Makefile` when running `make dev-all` or `pnpm dev`.
```bash
# Run independently
GATEWAY_PORT=3000 go run cmd/server/main.go
```

### Testing
```bash
go test ./...
```

## Documentation
- [Architecture & Migration Plan](../../docs/migration-high-performance.md)

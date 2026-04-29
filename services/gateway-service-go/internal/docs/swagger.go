// Package docs defines the root OpenAPI metadata for the gateway service.
//
// This file is intentionally separate from the swag-generated docs/ package so
// that hand-written annotations (title, version, base-path, security) live in
// a controlled location that is never overwritten by `swag init`.
//
// Usage:
//
//	cd services/gateway-service-go && swag init --dir cmd/server,internal/... --output internal/docs
package docs

// Package proxy implements the reverse-proxy routing table that mirrors the
// TypeScript proxy.controller.ts switch-case logic.
package proxy

import (
	"github.com/multi-agent/gateway-service-go/internal/config"
)

// resolveTarget maps the first URL segment after /api/ to a downstream service
// base URL. Returns an empty string when the segment is unknown (404 case).
func resolveTarget(segment string, cfg *config.Config) string {
	switch segment {
	case "workflows", "orchestration", "workspace":
		return cfg.OrchestrationServiceURL
	case "agents", "chat":
		return cfg.AgentServiceURL
	case "executions":
		return cfg.ExecutionServiceURL
	case "models", "api-keys":
		return cfg.ModelServiceURL
	case "tools":
		return cfg.ToolServiceURL
	case "vectors", "collections":
		return cfg.VectorServiceURL
	case "files":
		return cfg.FileServiceURL
	case "documents":
		return cfg.DocumentServiceURL
	case "github", "mcp":
		return cfg.GitHubMCPServiceURL
	case "trello":
		return cfg.TrelloMCPServiceURL
	default:
		return ""
	}
}

// publicSegments lists URL first-segments that bypass JWT validation.
// These correspond to @Public() decorated routes in the TypeScript gateway.
var publicSegments = map[string]bool{
	"health": true,
	"docs":   true,
}

// publicAuthPaths lists the specific auth sub-routes that are public.
var publicAuthPaths = map[string]bool{
	"login":        true,
	"register":     true,
	"social-login": true,
}

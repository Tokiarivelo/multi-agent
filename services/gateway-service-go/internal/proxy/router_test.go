package proxy

import (
	"testing"

	"github.com/multi-agent/gateway-service-go/internal/config"
)

func testConfig() *config.Config {
	return &config.Config{
		OrchestrationServiceURL: "http://orchestration:3003",
		AgentServiceURL:         "http://agent:3002",
		ExecutionServiceURL:     "http://execution:3004",
		ModelServiceURL:         "http://model:3005",
		ToolServiceURL:          "http://tool:3030",
		VectorServiceURL:        "http://vector:3007",
		FileServiceURL:          "http://file:3008",
		DocumentServiceURL:      "http://document:3009",
		GitHubMCPServiceURL:     "http://github:3010",
		TrelloMCPServiceURL:     "http://trello:3011",
	}
}

func TestResolveTarget(t *testing.T) {
	cfg := testConfig()

	tests := []struct {
		segment string
		want    string
	}{
		{"workflows", cfg.OrchestrationServiceURL},
		{"orchestration", cfg.OrchestrationServiceURL},
		{"workspace", cfg.OrchestrationServiceURL},
		{"agents", cfg.AgentServiceURL},
		{"executions", cfg.ExecutionServiceURL},
		{"models", cfg.ModelServiceURL},
		{"api-keys", cfg.ModelServiceURL},
		{"tools", cfg.ToolServiceURL},
		{"vectors", cfg.VectorServiceURL},
		{"collections", cfg.VectorServiceURL},
		{"files", cfg.FileServiceURL},
		{"documents", cfg.DocumentServiceURL},
		{"github", cfg.GitHubMCPServiceURL},
		{"mcp", cfg.GitHubMCPServiceURL},
		{"trello", cfg.TrelloMCPServiceURL},
		{"unknown", ""},
		{"", ""},
	}

	for _, tt := range tests {
		t.Run(tt.segment, func(t *testing.T) {
			got := resolveTarget(tt.segment, cfg)
			if got != tt.want {
				t.Errorf("resolveTarget(%q) = %q, want %q", tt.segment, got, tt.want)
			}
		})
	}
}

func TestPublicSegments(t *testing.T) {
	tests := []struct {
		segment string
		want    bool
	}{
		{"health", true},
		{"docs", true},
		{"workflows", false},
		{"agents", false},
	}

	for _, tt := range tests {
		t.Run(tt.segment, func(t *testing.T) {
			got := publicSegments[tt.segment]
			if got != tt.want {
				t.Errorf("publicSegments[%q] = %v, want %v", tt.segment, got, tt.want)
			}
		})
	}
}

package config

import (
	"os"
	"testing"
)

func TestCleanDatabaseURL_RemovesSchema(t *testing.T) {
	input := "postgresql://user:pass@localhost:5432/mydb?schema=public"
	out := CleanDatabaseURL(input)
	for _, fragment := range []string{"schema=public", "schema="} {
		if contains(out, fragment) {
			t.Errorf("CleanDatabaseURL did not remove %q from %q, got %q", fragment, input, out)
		}
	}
}

func TestCleanDatabaseURL_AddsSslmodeForLocalhost(t *testing.T) {
	cases := []struct {
		in   string
		want string
	}{
		{"postgresql://user:pass@localhost:5432/mydb", "sslmode=disable"},
		{"postgresql://user:pass@127.0.0.1:5432/mydb", "sslmode=disable"},
	}
	for _, tc := range cases {
		out := CleanDatabaseURL(tc.in)
		if !contains(out, tc.want) {
			t.Errorf("expected %q in %q", tc.want, out)
		}
	}
}

func TestCleanDatabaseURL_NoSslmodeForRemote(t *testing.T) {
	input := "postgresql://user:pass@prod.example.com:5432/mydb"
	out := CleanDatabaseURL(input)
	if contains(out, "sslmode=disable") {
		t.Errorf("should not add sslmode=disable for remote host, got %q", out)
	}
}

func TestCleanDatabaseURL_InvalidURL(t *testing.T) {
	// An unparseable URL should be returned as-is.
	bad := "not-a-url"
	out := CleanDatabaseURL(bad)
	if out != bad {
		t.Errorf("expected %q back for invalid URL, got %q", bad, out)
	}
}

func TestLoad_DefaultPort(t *testing.T) {
	// Clear relevant env vars so defaults are used.
	os.Unsetenv("GATEWAY_PORT")
	os.Unsetenv("PORT")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load() error: %v", err)
	}
	if cfg.Port != 3000 {
		t.Errorf("default port = %d, want 3000", cfg.Port)
	}
}

func TestLoad_CustomGatewayPort(t *testing.T) {
	t.Setenv("GATEWAY_PORT", "3020")
	defer os.Unsetenv("GATEWAY_PORT")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load() error: %v", err)
	}
	if cfg.Port != 3020 {
		t.Errorf("port = %d, want 3020", cfg.Port)
	}
}

func TestLoad_FallsBackToPort(t *testing.T) {
	os.Unsetenv("GATEWAY_PORT")
	t.Setenv("PORT", "8080")
	defer os.Unsetenv("PORT")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load() error: %v", err)
	}
	if cfg.Port != 8080 {
		t.Errorf("port = %d, want 8080", cfg.Port)
	}
}

func TestLoad_DefaultServiceURLs(t *testing.T) {
	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load() error: %v", err)
	}

	defaults := map[string]string{
		"OrchestrationServiceURL": cfg.OrchestrationServiceURL,
		"AgentServiceURL":         cfg.AgentServiceURL,
		"ToolServiceURL":          cfg.ToolServiceURL,
	}
	for name, val := range defaults {
		if val == "" {
			t.Errorf("%s should have a non-empty default", name)
		}
	}
}

func TestLoad_OverrideServiceURL(t *testing.T) {
	t.Setenv("TOOL_SERVICE_URL", "http://custom-tool:9999")
	defer os.Unsetenv("TOOL_SERVICE_URL")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load() error: %v", err)
	}
	if cfg.ToolServiceURL != "http://custom-tool:9999" {
		t.Errorf("ToolServiceURL = %q, want http://custom-tool:9999", cfg.ToolServiceURL)
	}
}

// ─── helpers ─────────────────────────────────────────────────────────────────

func contains(s, sub string) bool {
	return len(s) >= len(sub) && (s == sub || len(sub) == 0 ||
		func() bool {
			for i := 0; i <= len(s)-len(sub); i++ {
				if s[i:i+len(sub)] == sub {
					return true
				}
			}
			return false
		}())
}

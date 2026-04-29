package config

import (
	"fmt"
	"net/url"
	"os"
	"strconv"
)

type Config struct {
	Port     int
	NodeEnv  string
	JWTSecret string

	DatabaseURL string

	NATSURL string

	FrontendServiceURL       string
	OrchestrationServiceURL  string
	AgentServiceURL          string
	ExecutionServiceURL      string
	ModelServiceURL          string
	ToolServiceURL           string
	VectorServiceURL         string
	FileServiceURL           string
	DocumentServiceURL       string
	GitHubMCPServiceURL      string
	TrelloMCPServiceURL      string
}

func CleanDatabaseURL(dbURL string) string {
	u, err := url.Parse(dbURL)
	if err != nil {
		return dbURL
	}
	q := u.Query()
	
	// pgx does not support Prisma's schema parameter
	q.Del("schema")
	
	// For local development without TLS
	if (u.Hostname() == "localhost" || u.Hostname() == "127.0.0.1") && q.Get("sslmode") == "" {
		q.Set("sslmode", "disable")
	}
	
	u.RawQuery = q.Encode()
	return u.String()
}

func Load() (*Config, error) {
	port := 3000
	if v := os.Getenv("GATEWAY_PORT"); v != "" {
		p, err := strconv.Atoi(v)
		if err != nil {
			return nil, fmt.Errorf("invalid GATEWAY_PORT: %w", err)
		}
		port = p
	} else if v := os.Getenv("PORT"); v != "" {
		p, err := strconv.Atoi(v)
		if err != nil {
			return nil, fmt.Errorf("invalid PORT: %w", err)
		}
		port = p
	}

	return &Config{
		Port:    port,
		NodeEnv: getEnv("NODE_ENV", "development"),

		JWTSecret:   os.Getenv("JWT_SECRET"),
		DatabaseURL: CleanDatabaseURL(os.Getenv("DATABASE_URL")),
		NATSURL:     getEnv("NATS_URL", "nats://localhost:4222"),

		FrontendServiceURL:      getEnv("FRONTEND_SERVICE_URL", "http://localhost:3001"),
		OrchestrationServiceURL: getEnv("ORCHESTRATION_SERVICE_URL", "http://localhost:3003"),
		AgentServiceURL:         getEnv("AGENT_SERVICE_URL", "http://localhost:3002"),
		ExecutionServiceURL:     getEnv("EXECUTION_SERVICE_URL", "http://localhost:3004"),
		ModelServiceURL:         getEnv("MODEL_SERVICE_URL", "http://localhost:3005"),
		ToolServiceURL:          getEnv("TOOL_SERVICE_URL", "http://localhost:3030"),
		VectorServiceURL:        getEnv("VECTOR_SERVICE_URL", "http://localhost:3007"),
		FileServiceURL:          getEnv("FILE_SERVICE_URL", "http://localhost:3008"),
		DocumentServiceURL:      getEnv("DOCUMENT_SERVICE_URL", "http://localhost:3009"),
		GitHubMCPServiceURL:     getEnv("GITHUB_MCP_SERVICE_URL", "http://localhost:3010"),
		TrelloMCPServiceURL:     getEnv("TRELLO_MCP_SERVICE_URL", "http://localhost:3011"),
	}, nil
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

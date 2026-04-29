// @title           Multi-Agent Gateway API
// @version         1.0
// @description     Go-based API gateway for the multi-agent platform. Handles auth, user settings, WebSocket relay, and reverse-proxying to downstream microservices.
// @termsOfService  http://swagger.io/terms/
//
// @contact.name   Multi-Agent Platform Team
// @contact.url    https://github.com/multi-agent
//
// @license.name  MIT
//
// @host      localhost:3000
// @BasePath  /
//
// @securityDefinitions.apikey BearerAuth
// @in header
// @name Authorization
// @description Enter: Bearer <token>
//
// @schemes http https

// Command server is the entry point for the Go gateway.
// It wires all internal packages together and starts the Gin HTTP server.
package main

import (
	"fmt"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	"github.com/multi-agent/gateway-service-go/internal/auth"
	"github.com/multi-agent/gateway-service-go/internal/config"
	"github.com/multi-agent/gateway-service-go/internal/db"
	"github.com/multi-agent/gateway-service-go/internal/health"
	"github.com/multi-agent/gateway-service-go/internal/logger"
	"github.com/multi-agent/gateway-service-go/internal/messaging"
	"github.com/multi-agent/gateway-service-go/internal/proxy"
	"github.com/multi-agent/gateway-service-go/internal/users"
	"github.com/multi-agent/gateway-service-go/internal/ws"

	// Swagger UI — registered only when swaggo docs have been generated.
	// Run: swag init --dir cmd/server,internal --output docs
	// to create the docs/ package, then import it here:
	//   _ "github.com/multi-agent/gateway-service-go/docs"
	//   swaggerFiles "github.com/swaggo/files"
	//   ginSwagger "github.com/swaggo/gin-swagger"
)

func main() {
	// Try to load .env from the root directory
	_ = godotenv.Load("../../.env")

	appLogger := logger.New("Bootstrap")

	// ── 1. Configuration ───────────────────────────────────────────────────────
	cfg, err := config.Load()
	if err != nil {
		appLogger.Fatal("config: %v", err)
	}

	// ── 2. Database ────────────────────────────────────────────────────────────
	database, err := db.Connect(cfg.DatabaseURL)
	if err != nil {
		appLogger.Fatal("database: %v", err)
	}
	defer database.Close()

	// ── 3. NATS ────────────────────────────────────────────────────────────────
	natsClient, err := messaging.Connect(cfg.NATSURL)
	if err != nil {
		appLogger.Fatal("nats: %v", err)
	}
	defer natsClient.Close()

	// ── 4. Repositories & handlers ────────────────────────────────────────────
	userRepo := users.NewRepository(database.Pool)

	authHandler := auth.NewHandler(userRepo, cfg.JWTSecret)
	userHandler := users.NewHandler(userRepo)
	wsRelay := ws.NewRelay(natsClient)

	// ── 5. Router ──────────────────────────────────────────────────────────────
	if cfg.NodeEnv == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	r := gin.New()
	r.Use(logger.GinLogger("HTTP"))
	r.Use(gin.Recovery())

	// CORS middleware — allow the same origins as the TypeScript gateway.
	r.Use(corsMiddleware())

	// JWT validation applied globally; public routes are skipped inside the middleware.
	r.Use(auth.JWTMiddleware(cfg.JWTSecret))

	// ── 6. Route registration (order matters) ─────────────────────────────────
	health.RegisterRoutes(r)             // GET /health
	auth.RegisterRoutes(r, authHandler)  // POST /api/auth/*
	users.RegisterRoutes(r, userHandler) // GET|PATCH /api/users/me/settings
	ws.RegisterRoutes(r, wsRelay)        // GET /ws
	proxy.RegisterRoutes(r, cfg)         // ANY /api/* (catch-all)

	// ── 7. Swagger UI (development only) ──────────────────────────────────────
	// To enable: run `swag init` then uncomment the import block above and the
	// line below.
	//
	//   r.GET("/docs/*any", ginSwagger.WrapHandler(swaggerFiles.Handler))

	// ── 8. Start ───────────────────────────────────────────────────────────────
	addr := fmt.Sprintf(":%d", cfg.Port)
	appLogger.Log("🚀 gateway-go listening on %s (env=%s)", addr, cfg.NodeEnv)
	if err := r.Run(addr); err != nil {
		appLogger.Fatal("server: %v", err)
	}
}

// corsMiddleware adds permissive CORS headers matching the TypeScript gateway
// during the parallel-run period. Tighten in production via env vars.
func corsMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		origin := c.GetHeader("Origin")
		if origin != "" {
			c.Header("Access-Control-Allow-Origin", origin)
		} else {
			c.Header("Access-Control-Allow-Origin", "*")
		}

		c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Origin, Content-Type, Accept, Authorization")
		c.Header("Access-Control-Allow-Credentials", "true")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}

		c.Next()
	}
}

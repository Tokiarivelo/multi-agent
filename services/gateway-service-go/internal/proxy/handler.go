// Package proxy implements httputil.ReverseProxy-based forwarding for all
// /api/* routes that are not handled natively by the gateway.
package proxy

import (
	"fmt"
	"net/http"
	"net/http/httputil"
	"net/url"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/multi-agent/gateway-service-go/internal/config"
)

// Handler holds the configuration needed to resolve and proxy requests.
type Handler struct {
	cfg *config.Config
}

// NewHandler returns a Handler backed by the given config.
func NewHandler(cfg *config.Config) *Handler {
	return &Handler{cfg: cfg}
}

// RegisterRoutes attaches the catch-all proxy route to r.
func RegisterRoutes(r *gin.Engine, cfg *config.Config) {
	h := NewHandler(cfg)
	// Catch-all: every request that was not matched by an earlier route.
	r.NoRoute(func(c *gin.Context) {
		if strings.HasPrefix(c.Request.URL.Path, "/api/") {
			h.Proxy(c)
			return
		}
		c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
	})
}

// Proxy resolves the downstream target from the first URL segment and
// delegates to httputil.ReverseProxy. It appends ?userId=<id> to the
// upstream URL when the JWT middleware has injected a userId into the context.
func (h *Handler) Proxy(c *gin.Context) {
	rawPath := c.Request.URL.Path // e.g. /api/workflows/123
	segments := strings.Split(strings.TrimPrefix(rawPath, "/"), "/")
	// segments[0] == "api", segments[1] == service name
	var segment string
	if len(segments) > 1 {
		segment = segments[1]
	}

	// Segments handled natively by gateway routers — let Gin pass to them.
	if segment == "health" || segment == "docs" || segment == "users" || segment == "auth" {
		c.Next()
		return
	}

	targetBase := resolveTarget(segment, h.cfg)
	if targetBase == "" {
		c.JSON(http.StatusNotFound, gin.H{
			"error": fmt.Sprintf("API route /api/%s not found or no proxy configured", segment),
		})
		return
	}

	// Append userId from JWT context if not already present.
	if userID, exists := c.Get("userId"); exists && userID != "" {
		if !strings.Contains(c.Request.URL.RawQuery, "userId=") {
			if c.Request.URL.RawQuery != "" {
				c.Request.URL.RawQuery += "&userId=" + userID.(string)
			} else {
				c.Request.URL.RawQuery = "userId=" + userID.(string)
			}
		}
	}

	targetURL, err := url.Parse(targetBase)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "invalid upstream URL"})
		return
	}

	proxy := buildReverseProxy(targetURL)
	proxy.ServeHTTP(c.Writer, c.Request)
}

// buildReverseProxy constructs a single-host reverse proxy that rewrites the
// Host header and strips the /api prefix before forwarding.
func buildReverseProxy(target *url.URL) *httputil.ReverseProxy {
	proxy := httputil.NewSingleHostReverseProxy(target)

	originalDirector := proxy.Director
	proxy.Director = func(req *http.Request) {
		originalDirector(req)
		// Ensure the Host header matches the upstream, not the client's Host.
		req.Host = target.Host
	}

	// Strip CORS headers from the upstream response — the gateway's
	// corsMiddleware is the sole authority on CORS for all clients.
	proxy.ModifyResponse = func(resp *http.Response) error {
		resp.Header.Del("Access-Control-Allow-Origin")
		resp.Header.Del("Access-Control-Allow-Methods")
		resp.Header.Del("Access-Control-Allow-Headers")
		resp.Header.Del("Access-Control-Allow-Credentials")
		resp.Header.Del("Access-Control-Max-Age")
		return nil
	}

	proxy.ErrorHandler = func(w http.ResponseWriter, _ *http.Request, err error) {
		http.Error(w, fmt.Sprintf(`{"error":"upstream error: %s"}`, err.Error()),
			http.StatusBadGateway)
	}

	return proxy
}

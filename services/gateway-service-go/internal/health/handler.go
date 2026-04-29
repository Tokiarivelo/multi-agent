// Package health provides the GET /health liveness endpoint.
package health

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// RegisterRoutes attaches the health route to r.
func RegisterRoutes(r *gin.Engine) {
	r.GET("/health", handler)
}

// Health godoc
//
// @Summary     Health check
// @Description Returns {"status":"ok"} when the service is alive.
// @Tags        health
// @Produce     json
// @Success     200  {object} map[string]string
// @Router      /health [get]
func handler(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}

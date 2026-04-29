// Package users provides HTTP handlers for user settings endpoints:
//
//	GET   /api/users/me/settings
//	PATCH /api/users/me/settings
//
// Response shapes match the TypeScript UserController exactly.
package users

import (
	"encoding/json"
	"net/http"

	"github.com/gin-gonic/gin"
)

// Handler holds the dependencies for user HTTP handlers.
type Handler struct {
	repo *Repository
}

// NewHandler constructs a users Handler.
func NewHandler(repo *Repository) *Handler {
	return &Handler{repo: repo}
}

// RegisterRoutes attaches user settings routes to r.
func RegisterRoutes(r *gin.Engine, h *Handler) {
	g := r.Group("/api/users")
	g.GET("/me/settings", h.GetSettings)
	g.PATCH("/me/settings", h.UpdateSettings)
}

// GetSettings godoc
//
// @Summary     Get user settings
// @Description Returns the authenticated user's workspace settings.
// @Tags        users
// @Produce     json
// @Security    BearerAuth
// @Success     200  {object} map[string]interface{}
// @Failure     401  {object} map[string]string
// @Failure     404  {object} map[string]string
// @Router      /api/users/me/settings [get]
func (h *Handler) GetSettings(c *gin.Context) {
	userID, ok := c.Get("userId")
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	user, err := h.repo.FindByID(c.Request.Context(), userID.(string))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}
	if user == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	settings := resolveSettings(user.Settings)
	c.JSON(http.StatusOK, gin.H{"settings": settings})
}

// UpdateSettings godoc
//
// @Summary     Update user settings
// @Description Shallow-merges the provided settings into the stored ones.
// @Tags        users
// @Accept      json
// @Produce     json
// @Security    BearerAuth
// @Param       body body object true "Settings patch"
// @Success     200  {object} map[string]interface{}
// @Failure     400  {object} map[string]string
// @Failure     401  {object} map[string]string
// @Failure     404  {object} map[string]string
// @Router      /api/users/me/settings [patch]
func (h *Handler) UpdateSettings(c *gin.Context) {
	userID, ok := c.Get("userId")
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	var body struct {
		Settings json.RawMessage `json:"settings" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	user, err := h.repo.FindByID(c.Request.Context(), userID.(string))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}
	if user == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	// Merge: existing settings + incoming patch (shallow merge).
	merged, err := mergeSettings(user.Settings, body.Settings)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid settings payload"})
		return
	}

	mergedBytes, _ := json.Marshal(merged)
	updated, err := h.repo.Update(c.Request.Context(), userID.(string), UpdateInput{
		Settings: json.RawMessage(mergedBytes),
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"settings": resolveSettings(updated.Settings)})
}

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

// defaultSettings mirrors the TS GetUserSettingsUseCase defaultSettings object.
var defaultSettings = map[string]interface{}{
	"indexableExtensions": []string{
		"txt", "md", "ts", "tsx", "js", "jsx", "json",
		"yaml", "yml", "py", "go", "rs", "java", "css",
		"html", "xml", "sh", "env", "toml", "ini", "sql",
		"graphql", "prisma", "proto",
	},
}

// resolveSettings returns the stored settings or the defaults when empty.
func resolveSettings(raw json.RawMessage) interface{} {
	if len(raw) == 0 || string(raw) == "{}" || string(raw) == "null" {
		return defaultSettings
	}

	var m map[string]interface{}
	if err := json.Unmarshal(raw, &m); err != nil || len(m) == 0 {
		return defaultSettings
	}

	return m
}

// mergeSettings performs a shallow merge of two JSON objects (existing ← patch).
func mergeSettings(existing, patch json.RawMessage) (map[string]interface{}, error) {
	base := make(map[string]interface{})
	if len(existing) > 0 && string(existing) != "null" {
		if err := json.Unmarshal(existing, &base); err != nil {
			return nil, err
		}
	}

	var overlay map[string]interface{}
	if err := json.Unmarshal(patch, &overlay); err != nil {
		return nil, err
	}

	for k, v := range overlay {
		base[k] = v
	}

	return base, nil
}

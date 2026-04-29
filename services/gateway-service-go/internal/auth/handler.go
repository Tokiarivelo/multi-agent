// Package auth provides HTTP handlers for the auth routes:
//
//	POST /api/auth/register
//	POST /api/auth/login
//	POST /api/auth/social-login
//	GET  /api/auth/me
//
// All response shapes are identical to those produced by the TypeScript gateway
// to preserve zero-breaking-change parity during the parallel-run period.
package auth

import (
	"context"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/multi-agent/gateway-service-go/internal/users"
)

// userRepository is the subset of users.Repository methods used by auth
// handlers. Declaring this interface here keeps the auth package testable
// without a real database.
type userRepository interface {
	FindByEmail(ctx context.Context, email string) (*users.User, error)
	FindByID(ctx context.Context, id string) (*users.User, error)
	Create(ctx context.Context, in users.CreateInput) (*users.User, error)
	Update(ctx context.Context, id string, in users.UpdateInput) (*users.User, error)
}

// Handler holds the dependencies for auth HTTP handlers.
type Handler struct {
	repo      userRepository
	jwtSecret string
}

// NewHandler constructs an auth Handler.
func NewHandler(repo *users.Repository, jwtSecret string) *Handler {
	return &Handler{repo: repo, jwtSecret: jwtSecret}
}

// RegisterRoutes attaches the auth routes to the given router group.
func RegisterRoutes(r *gin.Engine, h *Handler) {
	g := r.Group("/api/auth")
	g.POST("/register", h.Register)
	g.POST("/login", h.Login)
	g.POST("/social-login", h.SocialLogin)
	g.GET("/me", h.Me)
}

// ──────────────────────────────────────────────────────────────────────────────
// Request / response types
// ──────────────────────────────────────────────────────────────────────────────

type registerRequest struct {
	Email     string `json:"email"     binding:"required,email"`
	Password  string `json:"password"  binding:"required,min=6"`
	FirstName string `json:"firstName" binding:"required"`
	LastName  string `json:"lastName"  binding:"required"`
	Role      string `json:"role"`
}

type loginRequest struct {
	Email    string `json:"email"    binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

type socialLoginRequest struct {
	Email     string  `json:"email"     binding:"required,email"`
	FirstName string  `json:"firstName" binding:"required"`
	LastName  string  `json:"lastName"  binding:"required"`
	Provider  string  `json:"provider"  binding:"required"`
	Image     *string `json:"image"`
}

// authResponse is the shared login / register response shape.
type authResponse struct {
	AccessToken string      `json:"accessToken"`
	User        interface{} `json:"user"`
}

// ──────────────────────────────────────────────────────────────────────────────
// Handlers
// ──────────────────────────────────────────────────────────────────────────────

// Register godoc
//
// @Summary     Register a new user
// @Description Creates a user account and returns an access token.
// @Tags        auth
// @Accept      json
// @Produce     json
// @Param       body body registerRequest true "Registration payload"
// @Success     201  {object} authResponse
// @Failure     400  {object} map[string]string
// @Failure     409  {object} map[string]string
// @Failure     500  {object} map[string]string
// @Router      /api/auth/register [post]
func (h *Handler) Register(c *gin.Context) {
	var req registerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Check for existing user.
	existing, err := h.repo.FindByEmail(c.Request.Context(), req.Email)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}
	if existing != nil {
		c.JSON(http.StatusConflict, gin.H{"error": "User with this email already exists"})
		return
	}

	hashed, err := HashPassword(req.Password)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	role := req.Role
	if role == "" {
		role = "USER"
	}

	provider := "credentials"
	user, err := h.repo.Create(c.Request.Context(), users.CreateInput{
		Email:     req.Email,
		Password:  &hashed,
		FirstName: req.FirstName,
		LastName:  req.LastName,
		Role:      role,
		IsActive:  true,
		Provider:  &provider,
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	token, err := SignToken(user.ID, user.Email, user.Role, h.jwtSecret)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	c.JSON(http.StatusCreated, authResponse{
		AccessToken: token,
		User:        userView(user),
	})
}

// Login godoc
//
// @Summary     Login
// @Description Authenticates a user with email and password.
// @Tags        auth
// @Accept      json
// @Produce     json
// @Param       body body loginRequest true "Login payload"
// @Success     200  {object} authResponse
// @Failure     400  {object} map[string]string
// @Failure     401  {object} map[string]string
// @Failure     500  {object} map[string]string
// @Router      /api/auth/login [post]
func (h *Handler) Login(c *gin.Context) {
	var req loginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	user, err := h.repo.FindByEmail(c.Request.Context(), req.Email)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid credentials"})
		return
	}
	if !user.IsActive {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Account is not active"})
		return
	}
	if user.Password == nil || !ComparePasswords(req.Password, *user.Password) {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid credentials"})
		return
	}

	token, err := SignToken(user.ID, user.Email, user.Role, h.jwtSecret)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	c.JSON(http.StatusOK, authResponse{
		AccessToken: token,
		User:        userView(user),
	})
}

// SocialLogin godoc
//
// @Summary     Social login
// @Description Creates or updates a user from OAuth provider data (Google, GitHub, …).
// @Tags        auth
// @Accept      json
// @Produce     json
// @Param       body body socialLoginRequest true "Social login payload"
// @Success     200  {object} authResponse
// @Failure     400  {object} map[string]string
// @Failure     401  {object} map[string]string
// @Failure     500  {object} map[string]string
// @Router      /api/auth/social-login [post]
func (h *Handler) SocialLogin(c *gin.Context) {
	var req socialLoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	user, err := h.repo.FindByEmail(c.Request.Context(), req.Email)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	if user == nil {
		// Create new social user.
		user, err = h.repo.Create(c.Request.Context(), users.CreateInput{
			Email:     req.Email,
			FirstName: req.FirstName,
			LastName:  req.LastName,
			Role:      "USER",
			IsActive:  true,
			Provider:  &req.Provider,
			Image:     req.Image,
		})
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
			return
		}
	} else {
		// Update provider / image if changed — mirrors TypeScript social-login logic.
		providerChanged := user.Provider == nil || *user.Provider != req.Provider
		imageChanged := req.Image != nil && (user.Image == nil || *user.Image != *req.Image)

		if providerChanged || imageChanged {
			user, err = h.repo.Update(c.Request.Context(), user.ID, users.UpdateInput{
				Provider: &req.Provider,
				Image:    req.Image,
			})
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
				return
			}
		}
	}

	if !user.IsActive {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Account is not active"})
		return
	}

	token, err := SignToken(user.ID, user.Email, user.Role, h.jwtSecret)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	c.JSON(http.StatusOK, authResponse{
		AccessToken: token,
		User:        userView(user),
	})
}

// Me godoc
//
// @Summary     Get current user
// @Description Returns the authenticated user's profile.
// @Tags        auth
// @Produce     json
// @Security    BearerAuth
// @Success     200  {object} map[string]interface{}
// @Failure     401  {object} map[string]string
// @Failure     404  {object} map[string]string
// @Router      /api/auth/me [get]
func (h *Handler) Me(c *gin.Context) {
	userID, exists := c.Get("userId")
	if !exists {
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

	c.JSON(http.StatusOK, userView(user))
}

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

// userView converts a User into the JSON-serialisable map that is returned to
// clients. The password field is intentionally omitted.
func userView(u *users.User) map[string]interface{} {
	return map[string]interface{}{
		"id":        u.ID,
		"email":     u.Email,
		"firstName": u.FirstName,
		"lastName":  u.LastName,
		"role":      u.Role,
		"isActive":  u.IsActive,
		"provider":  u.Provider,
		"image":     u.Image,
		"createdAt": u.CreatedAt,
		"updatedAt": u.UpdatedAt,
	}
}

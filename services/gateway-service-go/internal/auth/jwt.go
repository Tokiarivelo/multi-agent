// Package auth provides JWT validation middleware and signing utilities for the
// Go gateway. It is compatible with tokens issued by the TypeScript gateway
// (same JWT_SECRET, HS256 algorithm).
package auth

import (
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

// Claims mirrors the payload shape used by the TypeScript gateway:
//
//	{ sub: userId, email, role }
type Claims struct {
	Email string `json:"email"`
	Role  string `json:"role"`
	jwt.RegisteredClaims
}

// JWTMiddleware returns a Gin middleware that validates Bearer tokens.
// Public routes (listed in publicRoutes) are passed through without validation.
// On success the userId (Claims.Subject) is stored in the Gin context under
// the key "userId".
func JWTMiddleware(secret string) gin.HandlerFunc {
	return func(c *gin.Context) {
		if isPublicRoute(c.Request.Method, c.Request.URL.Path) {
			c.Next()
			return
		}

		header := c.GetHeader("Authorization")
		if header == "" || !strings.HasPrefix(header, "Bearer ") {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
			return
		}

		tokenStr := strings.TrimPrefix(header, "Bearer ")
		claims, err := parseToken(tokenStr, secret)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
			return
		}

		c.Set("userId", claims.Subject)
		c.Set("email", claims.Email)
		c.Set("role", claims.Role)
		c.Next()
	}
}

// SignToken creates a new HS256 JWT with the given payload fields.
func SignToken(userId, email, role, secret string) (string, error) {
	claims := Claims{
		Email: email,
		Role:  role,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:  userId,
			IssuedAt: jwt.NewNumericDate(time.Now()),
			// No expiry set here — mirrors the TypeScript gateway behaviour which
			// uses NestJS JwtModule defaults (no explicit expiry unless configured).
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, err := token.SignedString([]byte(secret))
	if err != nil {
		return "", fmt.Errorf("auth: sign token: %w", err)
	}

	return signed, nil
}

// parseToken validates the JWT string and returns its claims.
// A 5-second clock leeway is applied to tolerate minor skew between services.
func parseToken(tokenStr, secret string) (*Claims, error) {
	token, err := jwt.ParseWithClaims(
		tokenStr,
		&Claims{},
		func(t *jwt.Token) (interface{}, error) {
			if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
			}
			return []byte(secret), nil
		},
		jwt.WithLeeway(5*time.Second),
	)
	if err != nil {
		return nil, err
	}

	claims, ok := token.Claims.(*Claims)
	if !ok || !token.Valid {
		return nil, fmt.Errorf("invalid token claims")
	}

	return claims, nil
}

// isPublicRoute returns true for paths that bypass JWT validation.
// Mirrors @Public() decorator logic in the TypeScript gateway.
func isPublicRoute(method, path string) bool {
	// Strip query string if present
	if idx := strings.Index(path, "?"); idx != -1 {
		path = path[:idx]
	}

	publicPaths := []string{
		"/health",
		"/api/auth/login",
		"/api/auth/register",
		"/api/auth/social-login",
		"/api/github/",
		"/api/mcp",
	}

	for _, pub := range publicPaths {
		if path == pub || strings.HasPrefix(path, pub) {
			return true
		}
	}

	return false
}

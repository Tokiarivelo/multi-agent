package auth

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/multi-agent/gateway-service-go/internal/users"
)

// ─── stub repository ──────────────────────────────────────────────────────────

type stubRepo struct {
	findByEmailFn func(ctx context.Context, email string) (*users.User, error)
	findByIDFn    func(ctx context.Context, id string) (*users.User, error)
	createFn      func(ctx context.Context, in users.CreateInput) (*users.User, error)
	updateFn      func(ctx context.Context, id string, in users.UpdateInput) (*users.User, error)
}

func (s *stubRepo) FindByEmail(ctx context.Context, email string) (*users.User, error) {
	return s.findByEmailFn(ctx, email)
}
func (s *stubRepo) FindByID(ctx context.Context, id string) (*users.User, error) {
	return s.findByIDFn(ctx, id)
}
func (s *stubRepo) Create(ctx context.Context, in users.CreateInput) (*users.User, error) {
	return s.createFn(ctx, in)
}
func (s *stubRepo) Update(ctx context.Context, id string, in users.UpdateInput) (*users.User, error) {
	return s.updateFn(ctx, id, in)
}

// ─── helpers ─────────────────────────────────────────────────────────────────

func init() {
	gin.SetMode(gin.TestMode)
}

func newTestRouter(repo userRepository, secret string) *gin.Engine {
	r := gin.New()
	h := &Handler{repo: repo, jwtSecret: secret}
	RegisterRoutes(r, h)
	return r
}

func post(r *gin.Engine, path string, body interface{}) *httptest.ResponseRecorder {
	b, _ := json.Marshal(body)
	req := httptest.NewRequest(http.MethodPost, path, bytes.NewReader(b))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	return w
}

func makeUser() *users.User {
	hashed, _ := HashPassword("password123")
	provider := "credentials"
	return &users.User{
		ID:        "usr-1",
		Email:     "alice@example.com",
		FirstName: "Alice",
		LastName:  "Smith",
		Role:      "USER",
		IsActive:  true,
		Provider:  &provider,
		Password:  &hashed,
	}
}

// ─── tests ───────────────────────────────────────────────────────────────────

func TestRegister_Success(t *testing.T) {
	repo := &stubRepo{
		findByEmailFn: func(_ context.Context, _ string) (*users.User, error) { return nil, nil },
		createFn: func(_ context.Context, in users.CreateInput) (*users.User, error) {
			provider := "credentials"
			return &users.User{
				ID:        "usr-new",
				Email:     in.Email,
				FirstName: in.FirstName,
				LastName:  in.LastName,
				Role:      in.Role,
				IsActive:  true,
				Provider:  &provider,
			}, nil
		},
	}

	r := newTestRouter(repo, testSecret)
	w := post(r, "/api/auth/register", map[string]string{
		"email":     "new@example.com",
		"password":  "secret123",
		"firstName": "Bob",
		"lastName":  "Jones",
	})

	if w.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d: %s", w.Code, w.Body.String())
	}
	var resp map[string]interface{}
	if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
		t.Fatalf("decode error: %v", err)
	}
	if resp["accessToken"] == "" {
		t.Error("expected accessToken in response")
	}
}

func TestRegister_Conflict(t *testing.T) {
	existing := makeUser()
	repo := &stubRepo{
		findByEmailFn: func(_ context.Context, _ string) (*users.User, error) { return existing, nil },
	}

	r := newTestRouter(repo, testSecret)
	w := post(r, "/api/auth/register", map[string]string{
		"email":     "alice@example.com",
		"password":  "secret123",
		"firstName": "Alice",
		"lastName":  "Smith",
	})

	if w.Code != http.StatusConflict {
		t.Fatalf("expected 409, got %d", w.Code)
	}
}

func TestRegister_BadRequest(t *testing.T) {
	repo := &stubRepo{}
	r := newTestRouter(repo, testSecret)
	// Missing required fields
	w := post(r, "/api/auth/register", map[string]string{"email": "not-an-email"})
	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", w.Code)
	}
}

func TestLogin_Success(t *testing.T) {
	user := makeUser()
	repo := &stubRepo{
		findByEmailFn: func(_ context.Context, _ string) (*users.User, error) { return user, nil },
	}

	r := newTestRouter(repo, testSecret)
	w := post(r, "/api/auth/login", map[string]string{
		"email":    "alice@example.com",
		"password": "password123",
	})

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
	var resp map[string]interface{}
	json.NewDecoder(w.Body).Decode(&resp)
	if resp["accessToken"] == "" || resp["accessToken"] == nil {
		t.Error("expected accessToken in login response")
	}
}

func TestLogin_WrongPassword(t *testing.T) {
	user := makeUser()
	repo := &stubRepo{
		findByEmailFn: func(_ context.Context, _ string) (*users.User, error) { return user, nil },
	}

	r := newTestRouter(repo, testSecret)
	w := post(r, "/api/auth/login", map[string]string{
		"email":    "alice@example.com",
		"password": "wrong-password",
	})

	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", w.Code)
	}
}

func TestLogin_UserNotFound(t *testing.T) {
	repo := &stubRepo{
		findByEmailFn: func(_ context.Context, _ string) (*users.User, error) { return nil, nil },
	}

	r := newTestRouter(repo, testSecret)
	w := post(r, "/api/auth/login", map[string]string{
		"email":    "ghost@example.com",
		"password": "password123",
	})

	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", w.Code)
	}
}

func TestLogin_InactiveUser(t *testing.T) {
	user := makeUser()
	user.IsActive = false
	repo := &stubRepo{
		findByEmailFn: func(_ context.Context, _ string) (*users.User, error) { return user, nil },
	}

	r := newTestRouter(repo, testSecret)
	w := post(r, "/api/auth/login", map[string]string{
		"email":    "alice@example.com",
		"password": "password123",
	})

	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 for inactive user, got %d", w.Code)
	}
}

func TestMe_Unauthorized(t *testing.T) {
	repo := &stubRepo{}
	r := gin.New()
	h := &Handler{repo: repo, jwtSecret: testSecret}
	RegisterRoutes(r, h)

	req := httptest.NewRequest(http.MethodGet, "/api/auth/me", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	// Without JWT middleware the userId is not in context → 401
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", w.Code)
	}
}

func TestMe_WithUserID(t *testing.T) {
	user := makeUser()
	repo := &stubRepo{
		findByIDFn: func(_ context.Context, _ string) (*users.User, error) { return user, nil },
	}

	r := gin.New()
	// Inject userId manually (simulates what JWTMiddleware does).
	r.Use(func(c *gin.Context) {
		c.Set("userId", "usr-1")
		c.Next()
	})
	h := &Handler{repo: repo, jwtSecret: testSecret}
	RegisterRoutes(r, h)

	req := httptest.NewRequest(http.MethodGet, "/api/auth/me", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
	var resp map[string]interface{}
	json.NewDecoder(w.Body).Decode(&resp)
	if resp["email"] != "alice@example.com" {
		t.Errorf("email = %v, want alice@example.com", resp["email"])
	}
}

func TestSocialLogin_CreatesUser(t *testing.T) {
	repo := &stubRepo{
		findByEmailFn: func(_ context.Context, _ string) (*users.User, error) { return nil, nil },
		createFn: func(_ context.Context, in users.CreateInput) (*users.User, error) {
			return &users.User{
				ID:        "usr-social",
				Email:     in.Email,
				FirstName: in.FirstName,
				LastName:  in.LastName,
				Role:      "USER",
				IsActive:  true,
				Provider:  in.Provider,
			}, nil
		},
	}

	r := newTestRouter(repo, testSecret)
	w := post(r, "/api/auth/social-login", map[string]string{
		"email":     "social@example.com",
		"firstName": "Social",
		"lastName":  "User",
		"provider":  "google",
	})

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
}

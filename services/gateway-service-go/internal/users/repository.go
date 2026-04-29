// Package users provides pgx-based repository access to the users table.
// Column names match the Prisma schema (camelCase, stored as quoted identifiers
// in PostgreSQL): "firstName", "lastName", "isActive", "createdAt", "updatedAt".
package users

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// User mirrors the domain entity used by the TypeScript gateway.
type User struct {
	ID        string
	Email     string
	Password  *string
	FirstName string
	LastName  string
	Role      string
	IsActive  bool
	Provider  *string
	Image     *string
	Settings  json.RawMessage
	CreatedAt time.Time
	UpdatedAt time.Time
}

// Repository provides data access for the users table.
type Repository struct {
	pool *pgxpool.Pool
}

// NewRepository constructs a Repository backed by the given pool.
func NewRepository(pool *pgxpool.Pool) *Repository {
	return &Repository{pool: pool}
}

// FindByEmail retrieves a user by email address. Returns nil, nil when not found.
func (r *Repository) FindByEmail(ctx context.Context, email string) (*User, error) {
	const q = `
		SELECT id, email, password, "firstName", "lastName", role, "isActive",
		       provider, image, settings, "createdAt", "updatedAt"
		FROM users WHERE email = $1`

	row := r.pool.QueryRow(ctx, q, email)
	return scanUser(row)
}

// FindByID retrieves a user by UUID. Returns nil, nil when not found.
func (r *Repository) FindByID(ctx context.Context, id string) (*User, error) {
	const q = `
		SELECT id, email, password, "firstName", "lastName", role, "isActive",
		       provider, image, settings, "createdAt", "updatedAt"
		FROM users WHERE id = $1`

	row := r.pool.QueryRow(ctx, q, id)
	return scanUser(row)
}

// CreateInput holds the fields required to create a new user.
type CreateInput struct {
	Email     string
	Password  *string
	FirstName string
	LastName  string
	Role      string
	IsActive  bool
	Provider  *string
	Image     *string
}

// Create inserts a new user and returns the created record.
func (r *Repository) Create(ctx context.Context, in CreateInput) (*User, error) {
	provider := "credentials"
	if in.Provider != nil && *in.Provider != "" {
		provider = *in.Provider
	}

	role := "USER"
	if in.Role != "" {
		role = in.Role
	}

	const q = `
		INSERT INTO users (id, email, password, "firstName", "lastName", role, "isActive",
		                   provider, image, settings, "createdAt", "updatedAt")
		VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, '{}', NOW(), NOW())
		RETURNING id, email, password, "firstName", "lastName", role, "isActive",
		          provider, image, settings, "createdAt", "updatedAt"`

	row := r.pool.QueryRow(ctx, q,
		in.Email, in.Password, in.FirstName, in.LastName,
		role, in.IsActive, provider, in.Image,
	)

	user, err := scanUser(row)
	if err != nil {
		return nil, fmt.Errorf("users: create: %w", err)
	}

	return user, nil
}

// UpdateInput holds optional fields for a partial update.
type UpdateInput struct {
	Provider *string
	Image    *string
	Settings json.RawMessage
}

// Update performs a partial update of the user record and returns the updated row.
func (r *Repository) Update(ctx context.Context, id string, in UpdateInput) (*User, error) {
	const q = `
		UPDATE users
		SET
			provider  = COALESCE($2, provider),
			image     = COALESCE($3, image),
			settings  = CASE WHEN $4::jsonb IS NOT NULL THEN $4::jsonb ELSE settings END,
			"updatedAt" = NOW()
		WHERE id = $1
		RETURNING id, email, password, "firstName", "lastName", role, "isActive",
		          provider, image, settings, "createdAt", "updatedAt"`

	var settingsArg *string
	if len(in.Settings) > 0 {
		s := string(in.Settings)
		settingsArg = &s
	}

	row := r.pool.QueryRow(ctx, q, id, in.Provider, in.Image, settingsArg)
	user, err := scanUser(row)
	if err != nil {
		return nil, fmt.Errorf("users: update: %w", err)
	}

	return user, nil
}

// pgxRow is the common interface for pgx.Row and pgx.Rows.
type pgxRow interface {
	Scan(dest ...any) error
}

// scanUser reads a single user row from a pgx query result.
// Returns nil, nil when the row is not found (pgx.ErrNoRows).
func scanUser(row pgxRow) (*User, error) {
	var u User
	var settingsRaw []byte

	err := row.Scan(
		&u.ID, &u.Email, &u.Password,
		&u.FirstName, &u.LastName, &u.Role, &u.IsActive,
		&u.Provider, &u.Image, &settingsRaw,
		&u.CreatedAt, &u.UpdatedAt,
	)
	if err != nil {
		// pgx v5 returns pgx.ErrNoRows — map to nil, nil to match TS behaviour.
		if err.Error() == "no rows in result set" {
			return nil, nil
		}
		return nil, err
	}

	if len(settingsRaw) > 0 {
		u.Settings = json.RawMessage(settingsRaw)
	}

	return &u, nil
}

// Package db provides the PostgreSQL connection pool used by the Go gateway.
package db

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
)

// DB wraps a pgx connection pool.
type DB struct {
	Pool *pgxpool.Pool
}

// Connect opens a pgx pool against the given DATABASE_URL and pings once to
// verify connectivity. The caller is responsible for calling Close when done.
func Connect(databaseURL string) (*DB, error) {
	pool, err := pgxpool.New(context.Background(), databaseURL)
	if err != nil {
		return nil, fmt.Errorf("db: failed to create pool: %w", err)
	}

	if err := pool.Ping(context.Background()); err != nil {
		pool.Close()
		return nil, fmt.Errorf("db: failed to ping database: %w", err)
	}

	return &DB{Pool: pool}, nil
}

// Close releases all connections in the pool.
func (d *DB) Close() {
	d.Pool.Close()
}

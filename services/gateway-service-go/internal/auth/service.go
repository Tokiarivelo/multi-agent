// Package auth implements the bcrypt + JWT token signing logic used by auth
// handlers. This is the Go equivalent of the TypeScript AuthService +
// JwtService combination.
package auth

import (
	"fmt"

	"golang.org/x/crypto/bcrypt"
)

const bcryptCost = 10

// HashPassword hashes a plaintext password using bcrypt with cost=10,
// matching the TypeScript AuthService.hashPassword behaviour.
func HashPassword(plain string) (string, error) {
	hash, err := bcrypt.GenerateFromPassword([]byte(plain), bcryptCost)
	if err != nil {
		return "", fmt.Errorf("auth: hash password: %w", err)
	}

	return string(hash), nil
}

// ComparePasswords returns true when plain matches the bcrypt hash.
func ComparePasswords(plain, hashed string) bool {
	return bcrypt.CompareHashAndPassword([]byte(hashed), []byte(plain)) == nil
}

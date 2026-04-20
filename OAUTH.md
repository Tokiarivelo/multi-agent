# OAuth Implementation Documentation

This document describes the OAuth (Google/GitHub) implementation using NextAuth and NestJS.

## Overview

The system uses **NextAuth** on the frontend (Next.js) as an orchestration layer for OAuth flows. Once NextAuth successfully authenticates a user via a provider (Google or GitHub), it calls a dedicated backend endpoint in the **Gateway Service** to synchronize the user and obtain a backend-issued JWT.

## Architecture

1.  **Frontend (Next.js):**
    - Uses `next-auth` for provider configuration.
    - `authOptions` handles the `jwt` callback, which splits names and sends profile data to the backend.
    - Surfaces user profile, role, and image from the backend JWT into the session.
2.  **Backend (Gateway Service):**
    - **Endpoint:** `POST /auth/social-login`
    - **UseCase:** `SocialLoginUseCase`
    - Handles:
      - User creation (if first-time login).
      - Profile refresh (updates provider info and avatar image on subsequent logins).
      - Account status verification (`isActive`).
      - JWT generation (signed with backend secret).

## Environment Variables

### Frontend (`.env`)

```env
NEXTAUTH_URL=http://localhost:3001
NEXTAUTH_SECRET=your_nextauth_secret
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GITHUB_ID=...
GITHUB_SECRET=...
NEXT_PUBLIC_API_URL=http://localhost:3000
```

### Gateway Service (`.env`)

```env
JWT_SECRET=your_backend_jwt_secret
```

## Security

- **No Password for OAuth users**: Users created via OAuth have no password in the database.
- **JWT Strategy**: We use the JWT strategy for both NextAuth and our backend, avoiding database sessions and maximizing performance.
- **Account Locking**: The `isActive` flag is checked on every social login.

## Development

Run tests for the social login logic:

```bash
make test-gateway
```

or specifically:

```bash
cd services/gateway-service && pnpm test src/application/use-cases/social-login.use-case.spec.ts
---
```

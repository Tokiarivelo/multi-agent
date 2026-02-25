# API Keys Feature — Frontend

## Overview

The API Keys feature provides a dedicated dashboard page for users to manage their LLM provider API keys. It supports full CRUD operations: create, read, update (toggle active/inactive), and delete.

## Architecture

```
frontend/src/features/api-keys/
├── api/
│   └── api-keys.api.ts       # Axios API client layer
├── hooks/
│   └── useApiKeys.ts          # React Query hooks
├── components/
│   ├── ApiKeysPage.tsx         # Main page component
│   └── CreateApiKeyModal.tsx   # Create key modal
└── __tests__/
    ├── api-keys.api.test.ts         # API layer unit tests
    ├── useApiKeys.test.tsx          # Hooks unit tests
    ├── CreateApiKeyModal.test.tsx   # Modal component tests
    └── ApiKeysPage.test.tsx         # Page component tests
```

## Route

- **URL**: `/api-keys`
- **File**: `app/(dashboard)/api-keys/page.tsx`
- **Layout**: Uses the shared dashboard layout (sidebar + header + footer)

## Components

### `ApiKeysPage`

The main page component. Features:

- **Stats bar**: Displays total keys, active & valid count, and number of providers
- **Provider-grouped grid**: Keys are grouped by provider (OpenAI, Anthropic, Google, Azure, Ollama, Custom)
- **Provider color coding**: Each provider has a distinct color scheme for easy identification
- **Empty state**: Shows a helpful message and CTA when no keys exist
- **Error state**: Shows an error message with icon when the API fails
- **Loading state**: Shows a spinner during data fetching

### `ApiKeyCard`

Displays a single API key with:

- Provider icon and name with color coding
- Key name
- Valid/Invalid badge
- Active/Inactive badge
- Created date and last used date
- **Deactivate/Activate** toggle button
- **Delete** button with confirmation dialog

### `CreateApiKeyModal`

A premium modal for creating new API keys:

- Provider-aware gradient header
- Provider selection via button grid (6 providers)
- Key name input
- API key input with **show/hide toggle**
- Security note explaining encryption
- Placeholder changes based on selected provider

## Hooks

| Hook                                     | Purpose                                 |
| ---------------------------------------- | --------------------------------------- |
| `useApiKeys(userId)`                     | Fetch all API keys for a user           |
| `useApiKeysByProvider(userId, provider)` | Fetch keys filtered by provider         |
| `useCreateApiKey(userId)`                | Create mutation with cache invalidation |
| `useUpdateApiKey(userId)`                | Update mutation (toggle active, rename) |
| `useDeleteApiKey(userId)`                | Delete mutation with cache invalidation |

### Query Keys

Structured query keys for granular cache invalidation:

```ts
apiKeyQueryKeys.all; // ['apiKeys']
apiKeyQueryKeys.byUser(id); // ['apiKeys', userId]
apiKeyQueryKeys.byProvider(); // ['apiKeys', userId, provider]
apiKeyQueryKeys.detail(id); // ['apiKeys', 'detail', keyId]
```

## API Layer

| Method                            | Endpoint                                       | Description          |
| --------------------------------- | ---------------------------------------------- | -------------------- |
| `getAll(userId)`                  | `GET /api/api-keys?userId=`                    | List all keys        |
| `getById(id)`                     | `GET /api/api-keys/:id`                        | Get a single key     |
| `getByProvider(userId, provider)` | `GET /api/api-keys/provider/:provider?userId=` | Get keys by provider |
| `create(input)`                   | `POST /api/api-keys`                           | Create a new key     |
| `update(id, input)`               | `PUT /api/api-keys/:id`                        | Update a key         |
| `delete(id)`                      | `DELETE /api/api-keys/:id`                     | Delete a key         |

## i18n

All user-facing strings use `react-i18next`. Translation keys are prefixed with `apiKeys.` and are defined in both:

- **English** (`en`)
- **French** (`fr`)

See `src/lib/i18n.ts` for the full key list.

## Theme Compatibility

All components use design tokens (`text-foreground`, `bg-card`, `border-border`, etc.) and are fully compatible with both dark and light themes.

## Testing

**31 tests across 4 test suites:**

1. **`api-keys.api.test.ts`** — 6 tests validating API layer CRUD
2. **`useApiKeys.test.tsx`** — 6 tests validating React Query hooks (queries + mutations)
3. **`CreateApiKeyModal.test.tsx`** — 7 tests (rendering, submission, toggle, provider change)
4. **`ApiKeysPage.test.tsx`** — 12 tests (all states, CRUD interactions, confirm/cancel)

Run tests:

```bash
make test-frontend
# or
cd frontend && pnpm test
```

## Environment Variables

No new environment variables required. The API keys feature uses the existing gateway proxy configuration.

## Dependencies on Backend

This feature depends on the `model-service` API key endpoints:

- `ApiKeyController` in `services/model-service/src/presentation/controllers/api-key.controller.ts`
- Routes are proxied through the gateway service

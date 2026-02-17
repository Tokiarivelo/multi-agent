# Model Service API Documentation

## Overview

The Model Service provides LLM provider abstraction, model configuration management, and secure API key storage with AES-256-GCM encryption.

**Base URL**: `http://localhost:3004/api`

**Authentication**: All endpoints require authentication (except health check)

## Table of Contents

- [Models API](#models-api)
- [API Keys API](#api-keys-api)
- [Security Best Practices](#security-best-practices)
- [Error Handling](#error-handling)

---

## Models API

### Create Model

Create a new model configuration.

**Endpoint**: `POST /api/models`

**Request Body**:
```json
{
  "name": "gpt-4-turbo",
  "provider": "OPENAI",
  "modelId": "gpt-4-turbo-preview",
  "description": "GPT-4 Turbo model with 128k context window",
  "maxTokens": 128000,
  "supportsStreaming": true,
  "defaultTemperature": 0.7,
  "rateLimitPerMinute": 500,
  "rateLimitPerHour": 10000,
  "rateLimitPerDay": 50000,
  "inputCostPer1kTokens": 0.01,
  "outputCostPer1kTokens": 0.03,
  "providerSettings": {
    "organization": "org-123"
  },
  "isActive": true,
  "isDefault": false,
  "metadata": {
    "category": "general",
    "capabilities": ["text", "code", "analysis"]
  }
}
```

**Response**: `201 Created`
```json
{
  "id": "uuid",
  "name": "gpt-4-turbo",
  "provider": "OPENAI",
  "modelId": "gpt-4-turbo-preview",
  "description": "GPT-4 Turbo model with 128k context window",
  "maxTokens": 128000,
  "supportsStreaming": true,
  "defaultTemperature": 0.7,
  "rateLimitPerMinute": 500,
  "rateLimitPerHour": 10000,
  "rateLimitPerDay": 50000,
  "inputCostPer1kTokens": 0.01,
  "outputCostPer1kTokens": 0.03,
  "providerSettings": {
    "organization": "org-123"
  },
  "isActive": true,
  "isDefault": false,
  "metadata": {
    "category": "general",
    "capabilities": ["text", "code", "analysis"]
  },
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

### List Models

Get all models with optional filters.

**Endpoint**: `GET /api/models`

**Query Parameters**:
- `provider` (optional): Filter by provider (OPENAI, ANTHROPIC, GOOGLE, AZURE, OLLAMA)
- `isActive` (optional): Filter by active status (true/false)
- `supportsStreaming` (optional): Filter by streaming support (true/false)

**Example**: `GET /api/models?provider=OPENAI&isActive=true`

**Response**: `200 OK`
```json
[
  {
    "id": "uuid",
    "name": "gpt-4-turbo",
    "provider": "OPENAI",
    "modelId": "gpt-4-turbo-preview",
    ...
  }
]
```

### Get Model by ID

Get a specific model by its ID.

**Endpoint**: `GET /api/models/:id`

**Response**: `200 OK`
```json
{
  "id": "uuid",
  "name": "gpt-4-turbo",
  ...
}
```

### Get Default Model

Get the default model configuration.

**Endpoint**: `GET /api/models/default`

**Response**: `200 OK`
```json
{
  "id": "uuid",
  "name": "gpt-4-turbo",
  "isDefault": true,
  ...
}
```

### Get Models by Provider

Get all models for a specific provider.

**Endpoint**: `GET /api/models/provider/:provider`

**Example**: `GET /api/models/provider/OPENAI`

**Response**: `200 OK`
```json
[
  {
    "id": "uuid",
    "name": "gpt-4-turbo",
    "provider": "OPENAI",
    ...
  }
]
```

### Update Model

Update an existing model.

**Endpoint**: `PUT /api/models/:id`

**Request Body** (all fields optional):
```json
{
  "name": "gpt-4-turbo-updated",
  "description": "Updated description",
  "maxTokens": 150000,
  "defaultTemperature": 0.8,
  "isActive": false,
  "isDefault": true
}
```

**Response**: `200 OK`
```json
{
  "id": "uuid",
  "name": "gpt-4-turbo-updated",
  ...
}
```

### Delete Model

Delete a model.

**Endpoint**: `DELETE /api/models/:id`

**Response**: `204 No Content`

---

## API Keys API

### Add API Key

Add a new API key for a provider. The key is validated and encrypted before storage.

**Endpoint**: `POST /api/api-keys`

**Request Body**:
```json
{
  "userId": "user-123",
  "provider": "OPENAI",
  "keyName": "My OpenAI Key",
  "apiKey": "sk-proj-abc123...",
  "metadata": {
    "environment": "production"
  }
}
```

**Response**: `201 Created`
```json
{
  "id": "uuid",
  "userId": "user-123",
  "provider": "OPENAI",
  "keyName": "My OpenAI Key",
  "keyPrefix": "sk-proj-...abc",
  "lastUsedAt": null,
  "usageCount": 0,
  "isActive": true,
  "isValid": true,
  "metadata": {
    "environment": "production"
  },
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

**Note**: The actual API key is encrypted and never returned in responses.

### List API Keys

Get all API keys for a user.

**Endpoint**: `GET /api/api-keys`

**Query Parameters**:
- `userId` (required): User ID
- `provider` (optional): Filter by provider
- `isActive` (optional): Filter by active status (true/false)
- `isValid` (optional): Filter by validity (true/false)

**Example**: `GET /api/api-keys?userId=user-123&provider=OPENAI`

**Response**: `200 OK`
```json
[
  {
    "id": "uuid",
    "userId": "user-123",
    "provider": "OPENAI",
    "keyName": "My OpenAI Key",
    "keyPrefix": "sk-proj-...abc",
    "lastUsedAt": "2024-01-01T12:00:00.000Z",
    "usageCount": 150,
    "isActive": true,
    "isValid": true,
    "metadata": {},
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
]
```

### Get API Key by ID

Get a specific API key (without decryption).

**Endpoint**: `GET /api/api-keys/:id`

**Response**: `200 OK`
```json
{
  "id": "uuid",
  "userId": "user-123",
  "provider": "OPENAI",
  "keyName": "My OpenAI Key",
  "keyPrefix": "sk-proj-...abc",
  ...
}
```

### Get Decrypted API Key (Internal Only)

Retrieve the decrypted API key. This endpoint should only be called by internal services.

**Endpoint**: `GET /api/api-keys/:id/decrypt`

**Headers**:
- `x-internal-secret`: Internal secret for authentication

**Response**: `200 OK`
```json
{
  "key": "sk-proj-abc123..."
}
```

**Security**: This endpoint updates the `lastUsedAt` and `usageCount` fields.

### Get API Keys by Provider

Get all API keys for a user and provider.

**Endpoint**: `GET /api/api-keys/provider/:provider`

**Query Parameters**:
- `userId` (required): User ID

**Example**: `GET /api/api-keys/provider/OPENAI?userId=user-123`

**Response**: `200 OK`
```json
[
  {
    "id": "uuid",
    "userId": "user-123",
    "provider": "OPENAI",
    ...
  }
]
```

### Update API Key

Update an API key's metadata.

**Endpoint**: `PUT /api/api-keys/:id`

**Request Body** (all fields optional):
```json
{
  "keyName": "Updated Key Name",
  "isActive": false,
  "metadata": {
    "environment": "staging"
  }
}
```

**Response**: `200 OK`
```json
{
  "id": "uuid",
  "keyName": "Updated Key Name",
  "isActive": false,
  ...
}
```

**Note**: You cannot update the actual API key value. Create a new key instead.

### Delete API Key

Delete an API key.

**Endpoint**: `DELETE /api/api-keys/:id`

**Response**: `204 No Content`

---

## Health Check

Check service health status.

**Endpoint**: `GET /api/health`

**Response**: `200 OK`
```json
{
  "status": "ok",
  "service": "model-service",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

---

## Security Best Practices

### API Key Storage

1. **Encryption**: All API keys are encrypted using AES-256-GCM before storage
2. **Never Log Keys**: API keys should never be logged in plain text
3. **Access Control**: Only authorized services should access decrypted keys
4. **Key Rotation**: Regularly rotate API keys and delete old ones
5. **Audit Trail**: Track key usage with `lastUsedAt` and `usageCount`

### Environment Variables

Required environment variables:

```bash
# Encryption secret (minimum 32 characters)
ENCRYPTION_SECRET=your-strong-secret-minimum-32-characters

# Internal secret for decryption endpoint
INTERNAL_SECRET=your-internal-service-secret

# Database connection
DATABASE_URL=postgresql://user:password@localhost:5432/model_service
```

### API Key Validation

Before storing an API key, the service validates it against the provider's API:

- **OpenAI**: Calls `/v1/models` endpoint
- **Anthropic**: Calls `/v1/messages` endpoint  
- **Google**: Calls Gemini API models endpoint
- **Azure**: Basic format validation
- **Ollama**: No validation (local deployment)

Invalid keys are rejected before storage.

### Rate Limiting

Configure rate limits per model to prevent abuse:

```json
{
  "rateLimitPerMinute": 500,
  "rateLimitPerHour": 10000,
  "rateLimitPerDay": 50000
}
```

### Cost Tracking

Track API costs by configuring token costs:

```json
{
  "inputCostPer1kTokens": 0.01,
  "outputCostPer1kTokens": 0.03
}
```

### Provider-Specific Settings

Store provider-specific configuration in `providerSettings`:

```json
{
  "providerSettings": {
    "organization": "org-123",
    "apiVersion": "2024-01-01",
    "endpoint": "https://custom.openai.azure.com/"
  }
}
```

---

## Error Handling

All errors follow a consistent format:

```json
{
  "statusCode": 400,
  "timestamp": "2024-01-01T00:00:00.000Z",
  "path": "/api/models",
  "message": "Validation failed",
  "errors": [
    {
      "field": "name",
      "message": "name should not be empty"
    }
  ]
}
```

### Common Error Codes

- `400 Bad Request`: Invalid input or validation error
- `401 Unauthorized`: Missing or invalid authentication
- `404 Not Found`: Resource not found
- `409 Conflict`: Resource already exists
- `500 Internal Server Error`: Unexpected server error

### Validation Errors

The service validates all inputs:

- Model names must be unique
- API keys must be valid for the provider
- Temperature must be between 0 and 2
- Max tokens must be positive
- Provider must be a valid enum value

---

## Supported Providers

| Provider | Value | Validation | Notes |
|----------|-------|------------|-------|
| OpenAI | `OPENAI` | ✅ Live API check | GPT-4, GPT-3.5, etc. |
| Anthropic | `ANTHROPIC` | ✅ Live API check | Claude 3 models |
| Google | `GOOGLE` | ✅ Live API check | Gemini models |
| Azure | `AZURE` | ⚠️ Format check | Azure OpenAI Service |
| Ollama | `OLLAMA` | ❌ No validation | Local deployment |

---

## Examples

### Complete Model Setup

```bash
# 1. Create a model
curl -X POST http://localhost:3004/api/models \
  -H "Content-Type: application/json" \
  -d '{
    "name": "gpt-4-turbo",
    "provider": "OPENAI",
    "modelId": "gpt-4-turbo-preview",
    "maxTokens": 128000,
    "defaultTemperature": 0.7,
    "isDefault": true
  }'

# 2. Add an API key
curl -X POST http://localhost:3004/api/api-keys \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user-123",
    "provider": "OPENAI",
    "keyName": "Production Key",
    "apiKey": "sk-proj-abc123..."
  }'

# 3. List models
curl http://localhost:3004/api/models?provider=OPENAI

# 4. Get decrypted key (internal service only)
curl http://localhost:3004/api/api-keys/{id}/decrypt \
  -H "x-internal-secret: your-internal-secret"
```

### Multi-Provider Setup

```bash
# OpenAI
curl -X POST http://localhost:3004/api/api-keys \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user-123",
    "provider": "OPENAI",
    "keyName": "OpenAI Production",
    "apiKey": "sk-..."
  }'

# Anthropic
curl -X POST http://localhost:3004/api/api-keys \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user-123",
    "provider": "ANTHROPIC",
    "keyName": "Claude Production",
    "apiKey": "sk-ant-..."
  }'

# Google
curl -X POST http://localhost:3004/api/api-keys \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user-123",
    "provider": "GOOGLE",
    "keyName": "Gemini Production",
    "apiKey": "AIza..."
  }'
```

---

## Future Features

- [ ] Audit logging for key access
- [ ] Key expiration and auto-rotation
- [ ] Cost tracking and billing
- [ ] Usage analytics and reporting
- [ ] Key sharing between users
- [ ] Provider health monitoring
- [ ] Automatic failover between providers
- [ ] Token usage quotas per user

---

## Support

For issues or questions, please contact the development team or file an issue in the repository.

# Model Service

LLM provider abstraction, model configuration management, and secure API key storage for the multi-agent system.

## Features

- 🔐 **Secure API Key Storage**: AES-256-GCM encryption for all API keys
- 🔑 **Multi-Provider Support**: OpenAI, Anthropic, Google, Azure, Ollama
- ✅ **API Key Validation**: Validate keys against provider APIs before storage
- 📊 **Model Configuration**: Centralized model settings and capabilities
- 💰 **Cost Tracking**: Track token costs per model
- 🚦 **Rate Limiting**: Configure rate limits per model
- 🔄 **Provider-Specific Settings**: Store custom provider configurations

## Architecture

The service follows Clean Architecture principles:

```
src/
├── domain/              # Business entities and repository interfaces
│   ├── entities/        # Model and ApiKey entities
│   └── repositories/    # Repository interfaces
├── application/         # Use cases and DTOs
│   ├── use-cases/      # Business logic
│   └── dto/            # Data transfer objects
├── infrastructure/      # External dependencies
│   ├── database/       # Prisma repositories
│   └── services/       # Encryption and validation services
└── presentation/        # API layer
    ├── controllers/    # REST endpoints
    └── filters/        # Exception handling
```

## Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL 14+
- pnpm

### Installation

```bash
# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration

# Generate Prisma client
pnpm prisma:generate

# Run database migrations
pnpm prisma:migrate

# Start the service
pnpm start:dev
```

### Environment Variables

```bash
PORT=3004
NODE_ENV=development
DATABASE_URL="postgresql://user:password@localhost:5432/model_service"
ENCRYPTION_SECRET=your-strong-encryption-secret-minimum-32-characters
INTERNAL_SECRET=your-internal-service-secret
LOG_LEVEL=info
```

⚠️ **Security**: The `ENCRYPTION_SECRET` must be at least 32 characters long and kept secure.

## Usage

### Create a Model

```bash
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
```

### Add an API Key

```bash
curl -X POST http://localhost:3004/api/api-keys \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user-123",
    "provider": "OPENAI",
    "keyName": "Production Key",
    "apiKey": "sk-proj-abc123..."
  }'
```

### List Models

```bash
curl http://localhost:3004/api/models
```

### Get API Keys for User

```bash
curl "http://localhost:3004/api/api-keys?userId=user-123"
```

## API Documentation

See [API.md](./API.md) for complete API documentation.

## Security

### API Key Encryption

All API keys are encrypted using AES-256-GCM with the following features:

- Unique salt per encryption
- Random initialization vector (IV)
- Authentication tag for integrity
- Secure key derivation with scrypt

### API Key Validation

Before storing an API key, the service validates it against the provider's API:

- **OpenAI**: Tests with `/v1/models` endpoint
- **Anthropic**: Tests with minimal message request
- **Google**: Tests with Gemini models endpoint
- **Azure**: Format validation
- **Ollama**: No validation (local deployment)

Invalid keys are rejected before storage.

### Access Control

The decryption endpoint (`/api/api-keys/:id/decrypt`) requires an internal secret header:

```bash
curl http://localhost:3004/api/api-keys/{id}/decrypt \
  -H "x-internal-secret: your-internal-secret"
```

This endpoint should only be called by internal services, never from client applications.

### Best Practices

1. ✅ Use strong, unique encryption secrets
2. ✅ Rotate API keys regularly
3. ✅ Monitor key usage with `lastUsedAt` and `usageCount`
4. ✅ Deactivate unused keys with `isActive: false`
5. ✅ Use separate keys for different environments
6. ❌ Never log API keys in plain text
7. ❌ Never expose the decryption endpoint publicly
8. ❌ Never commit secrets to version control

## Supported Providers

| Provider | Status | Validation | Models |
|----------|--------|------------|--------|
| OpenAI | ✅ | Live | GPT-4, GPT-3.5 |
| Anthropic | ✅ | Live | Claude 3 (Opus, Sonnet, Haiku) |
| Google | ✅ | Live | Gemini Pro, Gemini Ultra |
| Azure | ✅ | Format | Azure OpenAI Service |
| Ollama | ✅ | None | Local models |

## Database Schema

### Models Table

```sql
CREATE TABLE models (
  id UUID PRIMARY KEY,
  name VARCHAR UNIQUE,
  provider VARCHAR,
  model_id VARCHAR,
  description TEXT,
  max_tokens INTEGER,
  supports_streaming BOOLEAN,
  default_temperature FLOAT,
  rate_limit_per_minute INTEGER,
  rate_limit_per_hour INTEGER,
  rate_limit_per_day INTEGER,
  input_cost_per_1k_tokens FLOAT,
  output_cost_per_1k_tokens FLOAT,
  provider_settings JSONB,
  is_active BOOLEAN,
  is_default BOOLEAN,
  metadata JSONB,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

### API Keys Table

```sql
CREATE TABLE api_keys (
  id UUID PRIMARY KEY,
  user_id VARCHAR,
  provider VARCHAR,
  key_name VARCHAR,
  encrypted_key TEXT,
  key_prefix VARCHAR,
  last_used_at TIMESTAMP,
  usage_count INTEGER,
  is_active BOOLEAN,
  is_valid BOOLEAN,
  metadata JSONB,
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  UNIQUE(user_id, provider, key_name)
);
```

## Development

### Running Tests

```bash
pnpm test
pnpm test:watch
pnpm test:cov
```

### Linting

```bash
pnpm lint
```

### Build

```bash
pnpm build
```

### Database Management

```bash
# Generate Prisma client
pnpm prisma:generate

# Run migrations
pnpm prisma:migrate

# Open Prisma Studio
pnpm prisma:studio
```

## Deployment

### Docker

```bash
# Build image
docker build -t model-service .

# Run container
docker run -p 3004:3004 \
  -e DATABASE_URL=postgresql://... \
  -e ENCRYPTION_SECRET=... \
  model-service
```

### Production Checklist

- [ ] Set strong `ENCRYPTION_SECRET` (32+ characters)
- [ ] Set unique `INTERNAL_SECRET`
- [ ] Configure production database
- [ ] Enable HTTPS/TLS
- [ ] Set up monitoring and logging
- [ ] Configure rate limiting
- [ ] Set up backup strategy
- [ ] Review security settings
- [ ] Test key encryption/decryption
- [ ] Verify provider API validation

## Monitoring

The service provides several monitoring endpoints:

- **Health Check**: `GET /api/health`
- **Model Stats**: Check active models and defaults
- **Key Usage**: Monitor `lastUsedAt` and `usageCount`

## Troubleshooting

### Common Issues

**Encryption Error**
```
Error: ENCRYPTION_SECRET must be at least 32 characters long
```
Solution: Set a longer encryption secret in `.env`

**Database Connection Error**
```
Error: Can't reach database server
```
Solution: Verify `DATABASE_URL` and ensure PostgreSQL is running

**API Key Validation Failed**
```
Error: Invalid API key for provider 'OPENAI'
```
Solution: Verify the API key is correct and has proper permissions

## Future Roadmap

- [ ] Audit logging for all key access
- [ ] Automatic key rotation
- [ ] Cost analytics and reporting
- [ ] Usage quotas per user
- [ ] Key sharing between users
- [ ] Provider health monitoring
- [ ] Automatic failover
- [ ] Token usage tracking
- [ ] Billing integration

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## License

MIT

## Support

For questions or issues, please file an issue in the repository or contact the development team.

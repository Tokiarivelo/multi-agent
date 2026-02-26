# Model Service - Quick Reference

## Service Info
- **Port**: 3004
- **Base URL**: `http://localhost:3004/api`
- **Health Check**: `http://localhost:3004/api/health`

## Quick Start

```bash
# Install dependencies
pnpm install

# Set up environment
cp .env.example .env
# Edit .env with your configuration

# Generate Prisma client
pnpm prisma:generate

# Run migrations
pnpm prisma:migrate

# Start development server
pnpm start:dev
```

## Environment Variables

```bash
PORT=3004
DATABASE_URL=postgresql://user:password@localhost:5432/model_service
ENCRYPTION_SECRET=minimum-32-character-secret-required
INTERNAL_SECRET=your-internal-service-secret
```

## Common Commands

```bash
# Development
pnpm start:dev          # Start with hot-reload
pnpm build              # Build for production
pnpm start:prod         # Start production server

# Database
pnpm prisma:generate    # Generate Prisma client
pnpm prisma:migrate     # Run migrations
pnpm prisma:studio      # Open Prisma Studio

# Testing
pnpm test               # Run tests
pnpm test:watch         # Run tests in watch mode
pnpm test:cov           # Run tests with coverage

# Quality
pnpm lint               # Run linter

# Docker
docker-compose up -d    # Start with Docker
docker-compose down     # Stop Docker containers
```

## Quick API Examples

### Create a Model
```bash
curl -X POST http://localhost:3004/api/models \
  -H "Content-Type: application/json" \
  -d '{
    "name": "gpt-4-turbo",
    "provider": "OPENAI",
    "modelId": "gpt-4-turbo-preview",
    "maxTokens": 128000,
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
    "apiKey": "sk-proj-your-key-here"
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

### Health Check
```bash
curl http://localhost:3004/api/health
```

## Supported Providers

| Provider | Code | Validation |
|----------|------|------------|
| OpenAI | `OPENAI` | ✅ Live |
| Anthropic | `ANTHROPIC` | ✅ Live |
| Google | `GOOGLE` | ✅ Live |
| Azure | `AZURE` | ⚠️ Format |
| Ollama | `OLLAMA` | ❌ None |

## Key Features

✅ Model CRUD operations
✅ Multi-provider support
✅ Secure API key storage (AES-256-GCM)
✅ API key validation
✅ Usage tracking
✅ Rate limit configuration
✅ Cost tracking preparation
✅ Health monitoring

## Security Notes

⚠️ **CRITICAL**: Set strong encryption secret (32+ chars)
⚠️ **CRITICAL**: Protect internal secret for decryption endpoint
⚠️ **IMPORTANT**: Never commit secrets to version control
⚠️ **IMPORTANT**: Use HTTPS in production

## Documentation

- **API.md**: Complete API reference
- **README.md**: Full service documentation
- **SECURITY.md**: Security details and best practices
- **PROJECT_SUMMARY.md**: Complete project overview
- **COMPLETION_REPORT.md**: Delivery report

## Troubleshooting

**Can't connect to database**
→ Check DATABASE_URL in .env

**Encryption error**
→ Ensure ENCRYPTION_SECRET is 32+ characters

**API key validation failed**
→ Verify the API key is correct and valid

**Build fails**
→ Run `pnpm install` and `pnpm prisma:generate`

## Support

For help:
1. Check documentation in *.md files
2. Review inline code comments
3. File an issue in repository

---

**Status**: ✅ Production Ready
**Version**: 1.0.0

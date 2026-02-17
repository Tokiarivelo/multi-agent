# Vector Service

Vector storage and similarity search microservice built with NestJS and Qdrant.

## Features

- Create and manage vector collections with namespace isolation per user
- Upsert documents with embeddings (auto-generate or provide custom)
- Similarity search with configurable filters
- Prisma for metadata storage
- Qdrant for vector operations
- Clean architecture with domain-driven design
- Full TypeScript with strict mode
- Health check endpoints

## Architecture

```
src/
├── domain/              # Business logic and entities
├── application/         # Use cases and DTOs
├── infrastructure/      # External integrations
└── presentation/        # Controllers and filters
```

## Setup

1. Install dependencies:
```bash
pnpm install
```

2. Set up environment variables:
```bash
cp .env.example .env
```

3. Start Qdrant:
```bash
docker-compose up -d qdrant
```

4. Generate Prisma client:
```bash
pnpm prisma:generate
```

5. Run migrations:
```bash
pnpm prisma migrate dev
```

## Development

```bash
pnpm start:dev
```

## Docker

Run with Docker Compose:
```bash
docker-compose up
```

## API Endpoints

### Collections
- `POST /api/vectors/collections` - Create collection
- `GET /api/vectors/collections?userId={userId}` - List collections
- `GET /api/vectors/collections/:id` - Get collection
- `DELETE /api/vectors/collections/:id` - Delete collection

### Documents
- `POST /api/vectors/documents` - Upsert single document
- `POST /api/vectors/documents/batch` - Batch upsert documents

### Search
- `POST /api/vectors/search` - Search similar documents

### Health
- `GET /api/health` - Health check
- `GET /api/health/ready` - Readiness check
- `GET /api/health/live` - Liveness check

## Environment Variables

- `NODE_ENV` - Environment (development/production)
- `PORT` - Service port (default: 3003)
- `DATABASE_URL` - PostgreSQL connection string
- `QDRANT_URL` - Qdrant URL (default: http://qdrant:6333)

# Gateway Service

Gateway Service built with NestJS following Clean Architecture principles.

## Architecture

This service follows Clean Architecture with the following layers:

- **Domain Layer**: Business entities, repository interfaces, and domain services
- **Application Layer**: Use cases, DTOs, and application interfaces
- **Infrastructure Layer**: Database, external services, and configuration
- **Presentation Layer**: Controllers, guards, decorators, and filters

## Features

- JWT Authentication
- User Registration & Login
- Role-Based Access Control (RBAC)
- Password Hashing with bcrypt
- Prisma ORM for database access
- Swagger API Documentation
- Global Exception Handling
- Request Validation
- Health Check Endpoint
- CORS Support
- Graceful Shutdown

## Prerequisites

- Node.js 20+
- pnpm
- PostgreSQL

## Installation

```bash
# Install dependencies (from root of monorepo)
pnpm install

# Generate Prisma client
pnpm prisma:generate
```

## Configuration

Create a `.env` file based on `.env.example`:

```bash
cp .env.example .env
```

Required environment variables:

- `PORT`: Server port (default: 3000)
- `NODE_ENV`: Environment (development/production)
- `DATABASE_URL`: PostgreSQL connection string
- `JWT_SECRET`: Secret key for JWT tokens
- `JWT_EXPIRATION`: Token expiration time (default: 1d)
- `CORS_ORIGIN`: CORS allowed origins (default: \*)

Proxy Environment variables:

- `ORCHESTRATION_SERVICE_URL`: URL to proxy orchestration service routes (default: http://localhost:3003)
- `AGENT_SERVICE_URL`: URL to proxy agent service routes (default: http://localhost:3002)
- `EXECUTION_SERVICE_URL`: URL to proxy execution routes (default: http://localhost:3004)
- `MODEL_SERVICE_URL`: URL to proxy model service routes (default: http://localhost:3005)
- `TOOL_SERVICE_URL`: URL to proxy tool service routes (default: http://localhost:3006)
- `VECTOR_SERVICE_URL`: URL to proxy vector service routes (default: http://localhost:3007)

## Running the Service

```bash
# Development mode
pnpm start:dev

# Production mode
pnpm build
pnpm start:prod
```

## API Documentation

Once the service is running, access the Swagger documentation at:

```
http://localhost:3000/api
```

## API Endpoints

### Authentication

- `POST /auth/register` - Register a new user
- `POST /auth/login` - Login and get JWT token

### Health

- `GET /health` - Service health check

### API Request Routing (ProxyController)

The gateway routes internal API requests to the exact service domain. Requests to `GET /api/workflows` will automatically forward to the Orchestration Service at `HTTP://ORCHESTRATION_SERVICE_URL/api/workflows` after performing JWT validation and authorization mappings. User context is automatically passed downstream.

## Testing Protected Routes

To access protected routes, include the JWT token in the Authorization header:

```bash
curl -H "Authorization: Bearer <your-jwt-token>" http://localhost:3000/protected-route
```

## Docker

Build and run with Docker:

```bash
# Build image
docker build -t gateway-service .

# Run container
docker run -p 3000:3000 --env-file .env gateway-service
```

## Development

```bash
# Run in watch mode
pnpm start:dev

# Run tests
pnpm test

# Run tests with coverage
pnpm test:cov

# Lint code
pnpm lint
```

## Project Structure

```
src/
├── domain/              # Business logic layer
│   ├── entities/       # Domain entities
│   ├── repositories/   # Repository interfaces
│   └── services/       # Domain services
├── application/        # Application layer
│   ├── use-cases/     # Business use cases
│   ├── dto/           # Data transfer objects
│   └── interfaces/    # Application interfaces
├── infrastructure/     # Infrastructure layer
│   ├── database/      # Database connection
│   ├── persistence/   # Repository implementations
│   ├── external/      # External service implementations
│   ├── auth/          # Authentication strategies
│   └── config/        # Configuration
├── presentation/       # Presentation layer
│   ├── controllers/   # HTTP controllers (Auth, Health, ProxyController)
│   ├── guards/        # Route guards
│   ├── decorators/    # Custom decorators
│   └── filters/       # Exception filters
├── app.module.ts      # Root module
└── main.ts           # Application entry point
```

## License

MIT

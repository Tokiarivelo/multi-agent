# Development Guide

## Table of Contents

- [Getting Started](#getting-started)
- [Project Structure](#project-structure)
- [Development Workflow](#development-workflow)
- [Code Organization](#code-organization)
- [Testing](#testing)
- [Debugging](#debugging)
- [Best Practices](#best-practices)
- [Common Tasks](#common-tasks)
- [Troubleshooting](#troubleshooting)

## Getting Started

### Prerequisites

Ensure you have the following installed:
- **Node.js**: >= 20.0.0
- **pnpm**: >= 8.0.0
- **Docker**: >= 24.0.0
- **Docker Compose**: >= 2.0.0
- **Git**: Latest version

### Initial Setup

1. **Clone the repository**:
```bash
git clone https://github.com/yourusername/multi-agent.git
cd multi-agent
```

2. **Install dependencies**:
```bash
pnpm install
```

3. **Setup environment variables**:
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. **Start infrastructure services**:
```bash
docker-compose up -d
```

5. **Run database migrations**:
```bash
cd prisma
npx prisma migrate dev
npx prisma generate
cd ..
```

6. **Start all services**:
```bash
pnpm dev
```

### Verify Installation

Check that all services are running:

```bash
# Check infrastructure
docker-compose ps

# Check service health
curl http://localhost:3000/health  # Gateway
curl http://localhost:3002/health  # Agent
curl http://localhost:3003/health  # Orchestration
```

## Project Structure

```
multi-agent/
├── services/                      # Microservices
│   ├── gateway-service/
│   │   ├── src/
│   │   │   ├── auth/             # Authentication module
│   │   │   ├── users/            # Users module
│   │   │   ├── main.ts           # Application entry
│   │   │   └── app.module.ts     # Root module
│   │   ├── test/                 # Tests
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── agent-service/
│   │   ├── src/
│   │   │   ├── domain/           # Domain layer
│   │   │   │   ├── entities/
│   │   │   │   └── repositories/
│   │   │   ├── application/      # Application layer
│   │   │   │   └── use-cases/
│   │   │   ├── infrastructure/   # Infrastructure layer
│   │   │   │   ├── repositories/
│   │   │   │   └── services/
│   │   │   └── presentation/     # Presentation layer
│   │   │       ├── controllers/
│   │   │       ├── gateways/
│   │   │       └── dto/
│   │   └── ...
│   │
│   └── [other services follow similar structure]
│
├── packages/                      # Shared packages
│   ├── common/                   # Common utilities
│   ├── types/                    # TypeScript types
│   ├── events/                   # Event schemas
│   └── nats-client/              # NATS client wrapper
│
├── frontend/                      # Next.js application
│   ├── src/
│   │   ├── app/                  # App router
│   │   ├── components/           # React components
│   │   ├── lib/                  # Utilities
│   │   └── stores/               # Zustand stores
│   └── ...
│
├── prisma/                        # Database
│   ├── schema.prisma             # Database schema
│   └── migrations/               # Migration files
│
├── k8s/                           # Kubernetes manifests
└── docker-compose.yml
```

## Development Workflow

### Working on a Feature

1. **Create a feature branch**:
```bash
git checkout -b feature/your-feature-name
```

2. **Make your changes** in the relevant service

3. **Run tests**:
```bash
pnpm test
```

4. **Lint your code**:
```bash
pnpm lint
```

5. **Format your code**:
```bash
pnpm format
```

6. **Commit your changes**:
```bash
git add .
git commit -m "feat(agent): add streaming support"
```

7. **Push your branch and create a Pull Request**

### Hot Reload Development

All services support hot reload:

```bash
# Start all services with hot reload
pnpm dev

# Or start individual services
cd services/agent-service
pnpm dev
```

### Database Changes

#### Creating a Migration

```bash
cd prisma
npx prisma migrate dev --name add_user_avatar
```

#### Using Prisma Studio

```bash
cd prisma
npx prisma studio
```

Access at: http://localhost:5555

## Code Organization

### Clean Architecture

Each service follows Clean Architecture with four layers:

```
src/
├── domain/                  # Core business logic
│   ├── entities/
│   ├── repositories/
│   └── value-objects/
│
├── application/            # Use cases
│   └── use-cases/
│
├── infrastructure/         # External dependencies
│   ├── repositories/
│   ├── services/
│   └── events/
│
└── presentation/           # API layer
    ├── controllers/
    ├── gateways/
    └── dto/
```

### Dependency Rules

1. **Domain** layer has no dependencies
2. **Application** depends only on **Domain**
3. **Infrastructure** implements **Domain** interfaces
4. **Presentation** depends on **Application** and **Domain**

## Testing

### Test Structure

```
service/
├── src/
└── test/
    ├── unit/              # Unit tests
    ├── integration/       # Integration tests
    └── e2e/               # End-to-end tests
```

### Running Tests

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run tests with coverage
pnpm test:cov

# Run e2e tests
pnpm test:e2e
```

## Debugging

### VS Code Launch Configuration

Create `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "attach",
      "name": "Attach to Gateway",
      "port": 9229,
      "restart": true,
      "sourceMaps": true
    }
  ]
}
```

### Debug Mode

```bash
cd services/gateway-service
pnpm dev:debug
```

### Logging

Use NestJS Logger:

```typescript
import { Logger } from '@nestjs/common';

export class MyService {
  private readonly logger = new Logger(MyService.name);

  someMethod() {
    this.logger.log('Info message');
    this.logger.error('Error message');
    this.logger.warn('Warning message');
  }
}
```

## Best Practices

### Code Style

1. Use TypeScript strict mode
2. Follow ESLint rules
3. Use Prettier for formatting
4. Write descriptive variable names
5. Keep functions small and focused
6. Use async/await over promises

### Error Handling

```typescript
try {
  const result = await someAsyncOperation();
  return result;
} catch (error) {
  this.logger.error('Failed to execute operation', error.stack);
  throw new HttpException('Operation failed', HttpStatus.INTERNAL_SERVER_ERROR);
}
```

### Dependency Injection

```typescript
@Injectable()
export class UserService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly emailService: EmailService,
  ) {}
}
```

### Async Operations

```typescript
// Use Promise.all for parallel operations
const [users, agents, workflows] = await Promise.all([
  this.userRepository.findAll(),
  this.agentRepository.findAll(),
  this.workflowRepository.findAll(),
]);
```

## Common Tasks

### Adding a New Endpoint

1. Create DTO
2. Create Use Case
3. Create Controller
4. Add tests

### Adding a New Event

1. Define event schema in `@multi-agent/events`
2. Publish event
3. Subscribe to event

## Troubleshooting

### Port Already in Use

```bash
# Find and stop process using port
lsof -i :3000
```

### Database Connection Issues

```bash
# Check PostgreSQL status
docker-compose ps postgres

# View logs
docker-compose logs postgres

# Restart
docker-compose restart postgres
```

### NATS Connection Issues

```bash
# Check NATS status
docker-compose ps nats

# View logs
docker-compose logs nats
```

### Prisma Issues

```bash
# Regenerate Prisma client
cd prisma
npx prisma generate

# Reset database
npx prisma migrate reset
```

### Node Module Issues

```bash
# Clear and reinstall
rm -rf node_modules
pnpm install
```

---

**Last Updated**: 2024
**Version**: 1.0.0

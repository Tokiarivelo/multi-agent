# Execution Service

The Execution Service is responsible for tracking and logging workflow executions in the Multi-Agent Platform. It subscribes to execution-related events via NATS and stores execution state and logs in a PostgreSQL database.

## Features

- **Event-Driven Architecture**: Subscribes to execution events from NATS
- **Execution Tracking**: Tracks workflow execution status and lifecycle
- **Node-Level Logging**: Logs individual node executions within workflows
- **REST API**: Provides endpoints for querying execution data
- **Retry Logic**: Supports retrying failed executions from the failed node
- **Clean Architecture**: Follows Domain-Driven Design principles

## Architecture

The service follows Clean Architecture with the following layers:

- **Domain**: Core business entities and repository interfaces
- **Application**: Use cases and DTOs
- **Infrastructure**: Database, messaging, and configuration
- **Presentation**: REST API controllers and filters

## Events Subscribed

The service subscribes to the following NATS events:

- `execution.started` - Creates execution record
- `execution.node.started` - Logs node execution start
- `execution.node.completed` - Logs node execution completion
- `execution.node.failed` - Logs node execution failure
- `execution.completed` - Updates execution status to completed
- `execution.failed` - Updates execution status to failed

## REST API Endpoints

### Get Execution
```
GET /api/executions/:id
```
Returns execution details by ID.

### Get Execution Logs
```
GET /api/executions/:id/logs
```
Returns all logs for a specific execution.

### List Executions
```
GET /api/executions?page=1&limit=10
```
Returns paginated list of executions.

### Retry Execution
```
POST /api/executions/:id/retry
```
Retries a failed execution from the failed node.

### Health Check
```
GET /api/health
```
Returns service health status.

## Database Schema

The service uses two main tables:

- **executions**: Stores workflow execution records
- **execution_logs**: Stores individual node execution logs

## Configuration

Environment variables:

- `NODE_ENV` - Application environment (development/production)
- `PORT` - HTTP server port (default: 3003)
- `DATABASE_URL` - PostgreSQL connection string
- `NATS_URL` - NATS server URL (default: nats://localhost:4222)

## Development

### Install Dependencies
```bash
pnpm install
```

### Run Database Migrations
```bash
cd ../../
pnpm prisma migrate dev
```

### Start Development Server
```bash
pnpm dev
```

### Build
```bash
pnpm build
```

### Start Production Server
```bash
pnpm start:prod
```

## API Documentation

Swagger documentation is available at `/api/docs` when the service is running.

## Docker

Build and run with Docker:

```bash
docker build -t execution-service .
docker run -p 3003:3003 execution-service
```

## Dependencies

- **NestJS**: Web framework
- **Prisma**: Database ORM
- **NATS**: Message broker client
- **@multi-agent/types**: Shared types
- **@multi-agent/common**: Common utilities
- **@multi-agent/events**: Event contracts
- **@multi-agent/nats-client**: NATS client wrapper

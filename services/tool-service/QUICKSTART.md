# Tool Service - Quick Start Guide

## Overview
The Tool Service is a microservice for managing and executing tools in a secure sandbox environment. This guide will help you get started quickly.

## Prerequisites

- Node.js 20+
- pnpm 8+
- PostgreSQL 14+
- Docker (optional)

## Installation

### Option 1: Local Development

1. **Clone and navigate to the service**:
```bash
cd services/tool-service
```

2. **Install dependencies**:
```bash
pnpm install
```

3. **Configure environment**:
```bash
cp .env.example .env
# Edit .env with your database credentials
```

4. **Generate Prisma client**:
```bash
pnpm prisma:generate
```

5. **Start development server**:
```bash
pnpm start:dev
```

The service will be available at `http://localhost:3003`

### Option 2: Docker

1. **Start with Docker Compose**:
```bash
docker-compose up -d
```

2. **Check logs**:
```bash
docker-compose logs -f tool-service
```

## Quick API Tour

### 1. Health Check

```bash
curl http://localhost:3003/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "service": "tool-service",
  "database": "connected"
}
```

### 2. Create Your First Tool

Create a simple string reverser:

```bash
curl -X POST http://localhost:3003/tools \
  -H "Content-Type: application/json" \
  -d '{
    "name": "string_reverser",
    "description": "Reverse a string",
    "category": "CUSTOM",
    "parameters": [
      {
        "name": "text",
        "type": "string",
        "description": "Text to reverse",
        "required": true
      }
    ],
    "code": "const { text } = parameters; return text.split('\''\').reverse().join('\''\');"
  }'
```

Save the returned `id` for the next step.

### 3. Execute the Tool

```bash
curl -X POST http://localhost:3003/tools/execute \
  -H "Content-Type: application/json" \
  -d '{
    "toolId": "YOUR_TOOL_ID_HERE",
    "parameters": {
      "text": "Hello World"
    }
  }'
```

Expected response:
```json
{
  "success": true,
  "data": "dlroW olleH",
  "executionTime": 15
}
```

### 4. List All Tools

```bash
curl http://localhost:3003/tools
```

### 5. Filter Tools by Category

```bash
curl "http://localhost:3003/tools?category=CUSTOM"
```

## Built-in Tools Examples

### HTTP Request Tool

Make a GET request:

```bash
curl -X POST http://localhost:3003/tools/execute \
  -H "Content-Type: application/json" \
  -d '{
    "toolId": "http-request-tool-id",
    "parameters": {
      "url": "https://jsonplaceholder.typicode.com/users/1",
      "method": "GET"
    }
  }'
```

### Web Scraper Tool

Scrape a webpage:

```bash
curl -X POST http://localhost:3003/tools/execute \
  -H "Content-Type: application/json" \
  -d '{
    "toolId": "web-scraper-tool-id",
    "parameters": {
      "url": "https://example.com",
      "selector": "h1"
    }
  }'
```

### JSON Parser Tool

Parse JSON string:

```bash
curl -X POST http://localhost:3003/tools/execute \
  -H "Content-Type: application/json" \
  -d '{
    "toolId": "json-parser-tool-id",
    "parameters": {
      "json": "{\"name\":\"John\",\"age\":30}"
    }
  }'
```

## Common Use Cases

### 1. Data Transformation

Create a tool to transform data:

```javascript
{
  "name": "data_transformer",
  "category": "CUSTOM",
  "parameters": [
    {"name": "data", "type": "array", "required": true},
    {"name": "operation", "type": "string", "required": true}
  ],
  "code": `
    const { data, operation } = parameters;
    switch(operation) {
      case 'double': return data.map(x => x * 2);
      case 'square': return data.map(x => x * x);
      case 'sum': return data.reduce((a, b) => a + b, 0);
      default: throw new Error('Unknown operation');
    }
  `
}
```

### 2. Text Processing

Create a tool for text manipulation:

```javascript
{
  "name": "text_processor",
  "category": "CUSTOM",
  "parameters": [
    {"name": "text", "type": "string", "required": true},
    {"name": "operation", "type": "string", "required": true}
  ],
  "code": `
    const { text, operation } = parameters;
    switch(operation) {
      case 'uppercase': return text.toUpperCase();
      case 'lowercase': return text.toLowerCase();
      case 'capitalize': return text.split(' ').map(w => 
        w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      case 'word_count': return text.split(/\\s+/).length;
      default: throw new Error('Unknown operation');
    }
  `
}
```

### 3. Data Validation

Create a validation tool:

```javascript
{
  "name": "email_validator",
  "category": "CUSTOM",
  "parameters": [
    {"name": "email", "type": "string", "required": true}
  ],
  "code": `
    const { email } = parameters;
    const regex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
    return {
      valid: regex.test(email),
      email: email
    };
  `
}
```

## Configuration

### Environment Variables

Key configuration options in `.env`:

```env
# Server Configuration
PORT=3003
NODE_ENV=development

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/multi_agent_db

# Tool Execution
TOOL_EXECUTION_TIMEOUT=30000      # 30 seconds
MAX_TOOL_MEMORY_MB=128            # 128 MB
SANDBOX_ENABLED=true              # Always true in production

# Network Security
ALLOWED_DOMAINS=*                 # Use specific domains in production
ENABLE_FILE_OPERATIONS=false      # Disable in production if not needed

# Rate Limiting
THROTTLE_TTL=60                   # Time window in seconds
THROTTLE_LIMIT=30                 # Requests per time window
```

### Production Settings

For production, update these settings:

```env
NODE_ENV=production
SANDBOX_ENABLED=true
ALLOWED_DOMAINS=api.example.com,cdn.example.com
ENABLE_FILE_OPERATIONS=false
TOOL_EXECUTION_TIMEOUT=15000
```

## Testing

### Run Tests

```bash
# Unit tests
pnpm test

# E2E tests
pnpm test:e2e

# Coverage
pnpm test:cov
```

### Manual Testing with Postman

1. Import the Postman collection from `API.md`
2. Set base URL variable: `http://localhost:3003`
3. Test all endpoints

## Troubleshooting

### Service Won't Start

**Problem**: Service fails to start
**Solution**: 
1. Check if port 3003 is available: `lsof -i :3003`
2. Verify DATABASE_URL is correct
3. Ensure PostgreSQL is running
4. Check logs for errors

### Database Connection Error

**Problem**: Cannot connect to database
**Solution**:
1. Verify PostgreSQL is running: `psql -U user -d multi_agent_db`
2. Check DATABASE_URL format
3. Ensure database exists
4. Check network connectivity

### Tool Execution Timeout

**Problem**: Tool execution times out
**Solution**:
1. Increase TOOL_EXECUTION_TIMEOUT
2. Optimize tool code
3. Check for infinite loops
4. Reduce data processing size

### Sandbox Errors

**Problem**: Tools fail with sandbox errors
**Solution**:
1. Ensure isolated-vm is installed: `pnpm list isolated-vm`
2. Check tool code for unsupported features
3. Review error messages in logs
4. Test code syntax before creating tool

## Best Practices

### 1. Tool Development

- ✅ Keep tools focused on single responsibility
- ✅ Validate all inputs
- ✅ Handle errors gracefully
- ✅ Use descriptive names and documentation
- ✅ Test with various inputs
- ❌ Don't access global variables
- ❌ Don't use unsupported Node.js APIs
- ❌ Don't create infinite loops

### 2. Security

- ✅ Always enable sandbox in production
- ✅ Use domain whitelist for HTTP requests
- ✅ Review custom tool code
- ✅ Set appropriate timeouts
- ✅ Monitor execution metrics
- ❌ Never disable sandbox in production
- ❌ Don't trust user input
- ❌ Don't expose sensitive data in errors

### 3. Performance

- ✅ Cache tool definitions
- ✅ Use appropriate timeouts
- ✅ Monitor memory usage
- ✅ Implement rate limiting
- ✅ Profile slow tools
- ❌ Don't process large datasets in memory
- ❌ Don't make synchronous blocking calls
- ❌ Don't ignore execution time warnings

## Next Steps

1. **Read the full documentation**: Check `README.md` for detailed information
2. **Review security guidelines**: See `SECURITY.md` for security best practices
3. **Explore examples**: Check `EXAMPLES.md` for more tool examples
4. **Review API docs**: See `API.md` for complete API reference
5. **Join the community**: Contribute and get help

## Support

- **Documentation**: `/services/tool-service/README.md`
- **API Reference**: `/services/tool-service/API.md`
- **Security Guide**: `/services/tool-service/SECURITY.md`
- **Examples**: `/services/tool-service/EXAMPLES.md`

## Common Commands

```bash
# Development
make dev              # Start dev server
make build            # Build for production
make lint             # Run linter
make test             # Run tests

# Docker
make docker-build     # Build Docker image
make docker-up        # Start containers
make docker-down      # Stop containers
make docker-logs      # View logs

# Maintenance
make clean            # Clean build artifacts
make prisma-generate  # Generate Prisma client
```

## Additional Resources

- [NestJS Documentation](https://docs.nestjs.com)
- [isolated-vm Documentation](https://github.com/laverdet/isolated-vm)
- [Prisma Documentation](https://www.prisma.io/docs)
- [PostgreSQL Documentation](https://www.postgresql.org/docs)

---

**Happy Tool Building! 🛠️**

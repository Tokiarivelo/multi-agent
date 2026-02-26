# Tool Service

## Overview

The **Tool Service** is a microservice responsible for managing a registry of tools and executing them in a secure, sandboxed environment. It provides CRUD operations for tools, parameter validation, and safe execution of both built-in and custom tools.

## Features

- **Tool Registry Management**: CRUD operations for tool definitions
- **Tool Categories**: WEB, API, DATABASE, FILE, and CUSTOM
- **Sandboxed Execution**: Secure code execution using isolated-vm
- **Built-in Tools**: HTTP request, web scraping, file operations, JSON parser
- **Custom Tool Support**: Execute user-defined JavaScript code
- **Parameter Validation**: Type checking and required field validation
- **Rate Limiting**: Throttling for tool execution to prevent abuse
- **Timeout Management**: Configurable execution timeouts
- **Tool Discovery**: Search and filter tools by category and attributes

## Architecture

The service follows **Clean Architecture** principles with clear separation of concerns:

```
src/
├── domain/                      # Business logic and entities
│   ├── tool.entity.ts
│   ├── tool.repository.interface.ts
│   └── tool-execution.interface.ts
├── application/                 # Use cases and DTOs
│   ├── dto/
│   │   ├── create-tool.dto.ts
│   │   ├── update-tool.dto.ts
│   │   ├── execute-tool.dto.ts
│   │   └── list-tools.dto.ts
│   └── use-cases/
│       ├── create-tool.use-case.ts
│       ├── update-tool.use-case.ts
│       ├── delete-tool.use-case.ts
│       ├── get-tool.use-case.ts
│       ├── list-tools.use-case.ts
│       └── execute-tool.use-case.ts
├── infrastructure/              # External concerns
│   ├── database/
│   │   └── prisma.service.ts
│   ├── persistence/
│   │   └── tool.repository.ts
│   ├── sandbox/
│   │   ├── sandbox-executor.service.ts
│   │   └── built-in-tools.service.ts
│   └── config/
│       ├── config.module.ts
│       └── env.validation.ts
└── presentation/                # HTTP layer
    ├── controllers/
    │   ├── tool.controller.ts
    │   └── health.controller.ts
    └── filters/
        └── http-exception.filter.ts
```

## API Endpoints

### Tools Management

#### Create Tool
```http
POST /tools
Content-Type: application/json

{
  "name": "string",
  "description": "string",
  "category": "WEB|API|DATABASE|FILE|CUSTOM",
  "parameters": [
    {
      "name": "string",
      "type": "string|number|boolean|object|array",
      "description": "string",
      "required": boolean,
      "default": any
    }
  ],
  "code": "string (optional, required for CUSTOM)",
  "isBuiltIn": boolean
}
```

#### List Tools
```http
GET /tools?category=WEB&isBuiltIn=true&search=http
```

#### Get Tool
```http
GET /tools/:id
```

#### Update Tool
```http
PUT /tools/:id
Content-Type: application/json

{
  "name": "string",
  "description": "string",
  "category": "WEB|API|DATABASE|FILE|CUSTOM",
  "parameters": [...],
  "code": "string"
}
```

#### Delete Tool
```http
DELETE /tools/:id
```

### Tool Execution

#### Execute Tool
```http
POST /tools/execute
Content-Type: application/json

{
  "toolId": "string",
  "parameters": {
    "param1": "value1",
    "param2": "value2"
  },
  "timeout": 30000,
  "userId": "string (optional)"
}
```

Response:
```json
{
  "success": true,
  "data": {},
  "executionTime": 1234,
  "memoryUsed": 1024
}
```

### Health Check

#### Health Status
```http
GET /health
```

Response:
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "service": "tool-service",
  "database": "connected"
}
```

## Built-in Tools

### 1. HTTP Request
**Name**: `http_request`

**Description**: Make HTTP requests to external APIs

**Parameters**:
- `url` (string, required): Target URL
- `method` (string, optional): HTTP method (default: GET)
- `headers` (object, optional): Request headers
- `body` (any, optional): Request body

**Example**:
```json
{
  "toolId": "http-request-tool-id",
  "parameters": {
    "url": "https://api.example.com/data",
    "method": "GET",
    "headers": {
      "Authorization": "Bearer token"
    }
  }
}
```

### 2. Web Scraper
**Name**: `web_scraper`

**Description**: Extract data from web pages

**Parameters**:
- `url` (string, required): Target URL
- `selector` (string, optional): CSS selector for specific elements

**Example**:
```json
{
  "toolId": "web-scraper-tool-id",
  "parameters": {
    "url": "https://example.com",
    "selector": "h1.title"
  }
}
```

### 3. JSON Parser
**Name**: `json_parser`

**Description**: Parse JSON strings

**Parameters**:
- `json` (string, required): JSON string to parse

**Example**:
```json
{
  "toolId": "json-parser-tool-id",
  "parameters": {
    "json": "{\"key\": \"value\"}"
  }
}
```

### 4. File Read
**Name**: `file_read`

**Description**: Read file contents

**Parameters**:
- `path` (string, required): File path

**Example**:
```json
{
  "toolId": "file-read-tool-id",
  "parameters": {
    "path": "/tmp/data.txt"
  }
}
```

### 5. File Write
**Name**: `file_write`

**Description**: Write content to file

**Parameters**:
- `path` (string, required): File path
- `content` (string, required): Content to write

**Example**:
```json
{
  "toolId": "file-write-tool-id",
  "parameters": {
    "path": "/tmp/output.txt",
    "content": "Hello, World!"
  }
}
```

## Custom Tools

Custom tools allow you to define your own JavaScript code for execution:

### Creating a Custom Tool

```json
{
  "name": "data_transformer",
  "description": "Transform data using custom logic",
  "category": "CUSTOM",
  "parameters": [
    {
      "name": "data",
      "type": "array",
      "description": "Array of data to transform",
      "required": true
    },
    {
      "name": "operation",
      "type": "string",
      "description": "Operation to perform",
      "required": true
    }
  ],
  "code": "const { data, operation } = parameters; if (operation === 'double') { return data.map(x => x * 2); } return data;"
}
```

### Custom Tool Code Guidelines

1. **Access Parameters**: Use `parameters` object
2. **Return Values**: Use `return` statement
3. **Async Operations**: Use `async/await`
4. **Console Logging**: `console.log()`, `console.error()`, `console.warn()`

Example:
```javascript
const { url, maxRetries } = parameters;

async function fetchWithRetry(url, retries) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url);
      return await response.json();
    } catch (error) {
      if (i === retries - 1) throw error;
      console.log(`Retry ${i + 1}/${retries}`);
    }
  }
}

return await fetchWithRetry(url, maxRetries);
```

## Security Considerations

### 1. Sandboxed Execution

All custom tool code runs in an isolated isolated-vm sandbox:

- **No access to file system** (except through built-in tools)
- **No access to network** (except through built-in tools)
- **No access to process or require**
- **Limited memory allocation**
- **Execution timeout enforcement**

### 2. Domain Whitelisting

HTTP requests and web scraping are restricted to allowed domains:

```env
ALLOWED_DOMAINS=example.com,api.example.com
# or
ALLOWED_DOMAINS=*  # Allow all (development only)
```

### 3. File Operations Control

File operations can be completely disabled:

```env
ENABLE_FILE_OPERATIONS=false
```

### 4. Rate Limiting

Tool execution is rate-limited to prevent abuse:

- **Default**: 30 requests per 60 seconds
- **Execute endpoint**: 10 requests per 60 seconds

Configure via:
```env
THROTTLE_TTL=60
THROTTLE_LIMIT=30
```

### 5. Execution Timeouts

Prevent long-running or infinite loops:

```env
TOOL_EXECUTION_TIMEOUT=30000  # 30 seconds
```

### 6. Memory Limits

Restrict memory usage per execution:

```env
MAX_TOOL_MEMORY_MB=128
```

### 7. Input Validation

All tool parameters are validated before execution:

- Type checking
- Required field validation
- Custom validation rules

### 8. Code Review

**IMPORTANT**: Review all custom tool code before deployment:

- Check for malicious code patterns
- Verify no attempts to bypass sandbox
- Ensure no sensitive data exposure
- Test in isolated environment first

### 9. Built-in Tool Restrictions

- HTTP requests honor domain whitelist
- File operations check `ENABLE_FILE_OPERATIONS`
- All operations have timeout protection
- Error messages don't leak sensitive information

### 10. Audit Logging

All tool executions should be logged for security auditing:

- Tool ID and name
- User ID (if provided)
- Execution time
- Success/failure status
- Error messages (sanitized)

## Configuration

### Environment Variables

```env
# Server
NODE_ENV=development|production
PORT=3003

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/multi_agent_db

# Tool Execution
TOOL_EXECUTION_TIMEOUT=30000      # Milliseconds
MAX_TOOL_MEMORY_MB=128            # MB
ENABLE_FILE_OPERATIONS=true       # true|false
ALLOWED_DOMAINS=*                 # Comma-separated domains or *

# Rate Limiting
THROTTLE_TTL=60                   # Seconds
THROTTLE_LIMIT=30                 # Requests per TTL

# Security
SANDBOX_ENABLED=true              # true|false (NEVER disable in production)
```

## Development

### Setup

```bash
# Install dependencies
pnpm install

# Generate Prisma client
pnpm prisma:generate

# Start development server
pnpm start:dev
```

### Testing

```bash
# Run tests
pnpm test

# Run tests with coverage
pnpm test:cov

# Run tests in watch mode
pnpm test:watch
```

### Building

```bash
# Build for production
pnpm build

# Start production server
pnpm start:prod
```

### Linting

```bash
# Run ESLint
pnpm lint
```

## Deployment

### Docker

```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

EXPOSE 3003

CMD ["pnpm", "start:prod"]
```

### Docker Compose

```yaml
version: '3.8'

services:
  tool-service:
    build: .
    ports:
      - "3003:3003"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://user:password@postgres:5432/multi_agent_db
      - TOOL_EXECUTION_TIMEOUT=30000
      - SANDBOX_ENABLED=true
    depends_on:
      - postgres
```

### Health Checks

Configure health checks for orchestration platforms:

```yaml
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:3003/health"]
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 40s
```

## Monitoring

### Metrics to Track

1. **Tool Execution Metrics**
   - Execution count per tool
   - Average execution time
   - Success/failure rate
   - Timeout occurrences

2. **Resource Metrics**
   - Memory usage per execution
   - CPU usage
   - Sandbox creation time

3. **Security Metrics**
   - Sandbox escape attempts
   - Rate limit hits
   - Domain whitelist violations
   - File operation attempts (when disabled)

4. **Error Metrics**
   - Error types and frequencies
   - Failed tool executions
   - Validation failures

## Troubleshooting

### Common Issues

#### 1. Tool Execution Timeout

**Symptom**: Tools fail with timeout error

**Solutions**:
- Increase `TOOL_EXECUTION_TIMEOUT`
- Optimize tool code
- Check for infinite loops
- Reduce data processing load

#### 2. Memory Limit Exceeded

**Symptom**: Tools fail with memory error

**Solutions**:
- Increase `MAX_TOOL_MEMORY_MB`
- Optimize memory usage in tool code
- Process data in chunks
- Use streaming for large datasets

#### 3. Domain Not Allowed

**Symptom**: HTTP requests fail with domain error

**Solutions**:
- Add domain to `ALLOWED_DOMAINS`
- Check URL format
- Verify domain whitelist configuration

#### 4. Sandbox Errors

**Symptom**: Custom tools fail unexpectedly

**Solutions**:
- Review code for unsupported features
- Check for syntax errors
- Verify parameter access
- Test in development environment

## Best Practices

### Tool Development

1. **Keep tools focused**: One tool = one responsibility
2. **Document thoroughly**: Clear descriptions and parameter docs
3. **Validate inputs**: Check parameters before processing
4. **Handle errors gracefully**: Return meaningful error messages
5. **Test extensively**: Test with various inputs and edge cases
6. **Consider performance**: Optimize for speed and memory
7. **Use async/await**: For better error handling
8. **Log appropriately**: Use console methods for debugging

### Security

1. **Enable sandbox**: ALWAYS in production
2. **Limit domains**: Whitelist only necessary domains
3. **Review custom code**: Before deploying
4. **Set timeouts**: Prevent runaway executions
5. **Limit memory**: Prevent resource exhaustion
6. **Rate limit**: Protect against abuse
7. **Audit executions**: Log all tool runs
8. **Update dependencies**: Keep isolated-vm and others current

### Performance

1. **Cache tool definitions**: Reduce database queries
2. **Optimize built-in tools**: Use efficient libraries
3. **Implement pagination**: For tool listings
4. **Use connection pooling**: For database
5. **Monitor metrics**: Track execution times
6. **Profile code**: Identify bottlenecks
7. **Scale horizontally**: Add instances as needed

## Contributing

1. Follow Clean Architecture principles
2. Write tests for all features
3. Document security considerations
4. Update API documentation
5. Follow coding standards
6. Review security implications

## License

MIT License - See LICENSE file for details

## Support

For issues and questions:
- GitHub Issues: [repository-url]/issues
- Documentation: [docs-url]
- Email: support@example.com

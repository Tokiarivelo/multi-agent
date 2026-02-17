# Tool Service API Documentation

## Base URL
```
http://localhost:3003
```

## Authentication
Currently, no authentication is required. Add authentication middleware as needed for production.

---

## Endpoints

### Health Check

#### GET /health
Check service health and database connectivity.

**Response 200 OK**
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "service": "tool-service",
  "database": "connected"
}
```

---

### Tool Management

#### POST /tools
Create a new tool.

**Request Body**
```json
{
  "name": "weather_api",
  "description": "Fetch weather data from API",
  "category": "API",
  "parameters": [
    {
      "name": "city",
      "type": "string",
      "description": "City name",
      "required": true
    },
    {
      "name": "units",
      "type": "string",
      "description": "Temperature units (metric/imperial)",
      "required": false,
      "default": "metric"
    }
  ],
  "code": "const { city, units } = parameters; // Custom logic here",
  "isBuiltIn": false
}
```

**Response 201 Created**
```json
{
  "id": "uuid",
  "name": "weather_api",
  "description": "Fetch weather data from API",
  "category": "API",
  "parameters": [...],
  "code": "...",
  "isBuiltIn": false,
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

**Errors**
- `409 Conflict` - Tool with same name exists
- `400 Bad Request` - Invalid parameters or missing code for CUSTOM tools

---

#### GET /tools
List all tools with optional filtering.

**Query Parameters**
- `category` (optional) - Filter by category: WEB, API, DATABASE, FILE, CUSTOM
- `isBuiltIn` (optional) - Filter by built-in status: true, false
- `search` (optional) - Search in name and description

**Examples**
```
GET /tools
GET /tools?category=WEB
GET /tools?isBuiltIn=true
GET /tools?search=http
GET /tools?category=API&isBuiltIn=false
```

**Response 200 OK**
```json
[
  {
    "id": "uuid",
    "name": "http_request",
    "description": "Make HTTP requests",
    "category": "API",
    "parameters": [...],
    "code": null,
    "isBuiltIn": true,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  },
  ...
]
```

---

#### GET /tools/:id
Get a specific tool by ID.

**Path Parameters**
- `id` - Tool UUID

**Response 200 OK**
```json
{
  "id": "uuid",
  "name": "weather_api",
  "description": "Fetch weather data from API",
  "category": "API",
  "parameters": [...],
  "code": "...",
  "isBuiltIn": false,
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

**Errors**
- `404 Not Found` - Tool does not exist

---

#### PUT /tools/:id
Update a tool.

**Path Parameters**
- `id` - Tool UUID

**Request Body** (all fields optional)
```json
{
  "name": "updated_name",
  "description": "Updated description",
  "category": "WEB",
  "parameters": [...],
  "code": "..."
}
```

**Response 200 OK**
```json
{
  "id": "uuid",
  "name": "updated_name",
  "description": "Updated description",
  "category": "WEB",
  "parameters": [...],
  "code": "...",
  "isBuiltIn": false,
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

**Errors**
- `404 Not Found` - Tool does not exist
- `400 Bad Request` - Cannot update built-in tools
- `400 Bad Request` - Invalid parameters

---

#### DELETE /tools/:id
Delete a tool.

**Path Parameters**
- `id` - Tool UUID

**Response 204 No Content**

**Errors**
- `404 Not Found` - Tool does not exist
- `400 Bad Request` - Cannot delete built-in tools

---

### Tool Execution

#### POST /tools/execute
Execute a tool with provided parameters.

**Rate Limit**: 10 requests per 60 seconds

**Request Body**
```json
{
  "toolId": "uuid",
  "parameters": {
    "param1": "value1",
    "param2": 123
  },
  "timeout": 30000,
  "userId": "user-uuid"
}
```

**Response 200 OK** (Success)
```json
{
  "success": true,
  "data": {
    "result": "execution result"
  },
  "executionTime": 1234
}
```

**Response 200 OK** (Failure)
```json
{
  "success": false,
  "error": "Execution timeout after 30000ms",
  "executionTime": 30001
}
```

**Errors**
- `404 Not Found` - Tool does not exist
- `400 Bad Request` - Invalid parameters
- `429 Too Many Requests` - Rate limit exceeded

---

## Built-in Tools

### HTTP Request

**Tool Name**: `http_request`

**Description**: Make HTTP requests to external APIs

**Parameters**:
```json
{
  "url": {
    "type": "string",
    "required": true,
    "description": "Target URL"
  },
  "method": {
    "type": "string",
    "required": false,
    "default": "GET",
    "description": "HTTP method"
  },
  "headers": {
    "type": "object",
    "required": false,
    "description": "Request headers"
  },
  "body": {
    "type": "object",
    "required": false,
    "description": "Request body"
  }
}
```

**Example Request**:
```json
{
  "toolId": "http-request-tool-id",
  "parameters": {
    "url": "https://api.example.com/users",
    "method": "POST",
    "headers": {
      "Authorization": "Bearer token",
      "Content-Type": "application/json"
    },
    "body": {
      "name": "John Doe",
      "email": "john@example.com"
    }
  }
}
```

**Example Response**:
```json
{
  "success": true,
  "data": {
    "status": 201,
    "headers": {
      "content-type": "application/json"
    },
    "data": {
      "id": "123",
      "name": "John Doe",
      "email": "john@example.com"
    }
  },
  "executionTime": 456
}
```

---

### Web Scraper

**Tool Name**: `web_scraper`

**Description**: Extract data from web pages

**Parameters**:
```json
{
  "url": {
    "type": "string",
    "required": true,
    "description": "Target URL"
  },
  "selector": {
    "type": "string",
    "required": false,
    "description": "CSS selector for elements"
  }
}
```

**Example Request** (with selector):
```json
{
  "toolId": "web-scraper-tool-id",
  "parameters": {
    "url": "https://example.com/products",
    "selector": ".product-item"
  }
}
```

**Example Response**:
```json
{
  "success": true,
  "data": [
    {
      "text": "Product 1",
      "html": "<div class=\"product-item\">Product 1</div>",
      "attributes": {
        "class": "product-item",
        "data-id": "1"
      }
    },
    ...
  ],
  "executionTime": 789
}
```

**Example Request** (without selector):
```json
{
  "toolId": "web-scraper-tool-id",
  "parameters": {
    "url": "https://example.com"
  }
}
```

**Example Response**:
```json
{
  "success": true,
  "data": {
    "title": "Example Domain",
    "text": "This domain is for use in illustrative examples..."
  },
  "executionTime": 456
}
```

---

### JSON Parser

**Tool Name**: `json_parser`

**Description**: Parse JSON strings into objects

**Parameters**:
```json
{
  "json": {
    "type": "string",
    "required": true,
    "description": "JSON string to parse"
  }
}
```

**Example Request**:
```json
{
  "toolId": "json-parser-tool-id",
  "parameters": {
    "json": "{\"name\":\"John\",\"age\":30,\"city\":\"New York\"}"
  }
}
```

**Example Response**:
```json
{
  "success": true,
  "data": {
    "name": "John",
    "age": 30,
    "city": "New York"
  },
  "executionTime": 5
}
```

---

### File Read

**Tool Name**: `file_read`

**Description**: Read file contents (when file operations are enabled)

**Parameters**:
```json
{
  "path": {
    "type": "string",
    "required": true,
    "description": "File path to read"
  }
}
```

**Example Request**:
```json
{
  "toolId": "file-read-tool-id",
  "parameters": {
    "path": "/tmp/data.txt"
  }
}
```

**Example Response**:
```json
{
  "success": true,
  "data": "File contents here...",
  "executionTime": 10
}
```

**Errors**:
- File operations disabled
- File not found
- Permission denied

---

### File Write

**Tool Name**: `file_write`

**Description**: Write content to file (when file operations are enabled)

**Parameters**:
```json
{
  "path": {
    "type": "string",
    "required": true,
    "description": "File path to write"
  },
  "content": {
    "type": "string",
    "required": true,
    "description": "Content to write"
  }
}
```

**Example Request**:
```json
{
  "toolId": "file-write-tool-id",
  "parameters": {
    "path": "/tmp/output.txt",
    "content": "Hello, World!\nThis is a test file."
  }
}
```

**Example Response**:
```json
{
  "success": true,
  "data": null,
  "executionTime": 15
}
```

**Errors**:
- File operations disabled
- Permission denied
- Disk full

---

## Custom Tool Execution

### Example: Data Transformer

**Create Tool**:
```json
{
  "name": "data_transformer",
  "description": "Transform array of numbers",
  "category": "CUSTOM",
  "parameters": [
    {
      "name": "data",
      "type": "array",
      "description": "Array of numbers",
      "required": true
    },
    {
      "name": "operation",
      "type": "string",
      "description": "Operation: double, square, sum",
      "required": true
    }
  ],
  "code": "const { data, operation } = parameters;\n\nif (operation === 'double') {\n  return data.map(x => x * 2);\n} else if (operation === 'square') {\n  return data.map(x => x * x);\n} else if (operation === 'sum') {\n  return data.reduce((a, b) => a + b, 0);\n}\n\nthrow new Error('Unknown operation');"
}
```

**Execute Tool**:
```json
{
  "toolId": "data-transformer-id",
  "parameters": {
    "data": [1, 2, 3, 4, 5],
    "operation": "square"
  }
}
```

**Response**:
```json
{
  "success": true,
  "data": [1, 4, 9, 16, 25],
  "executionTime": 23
}
```

---

## Error Responses

### 400 Bad Request
```json
{
  "statusCode": 400,
  "message": "Invalid parameters",
  "errors": [
    "Missing required parameter: url",
    "Parameter timeout must be of type number"
  ],
  "timestamp": "2024-01-01T00:00:00.000Z",
  "path": "/tools/execute"
}
```

### 404 Not Found
```json
{
  "statusCode": 404,
  "message": "Tool with ID \"xyz\" not found",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "path": "/tools/xyz"
}
```

### 409 Conflict
```json
{
  "statusCode": 409,
  "message": "Tool with name \"weather_api\" already exists",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "path": "/tools"
}
```

### 429 Too Many Requests
```json
{
  "statusCode": 429,
  "message": "ThrottlerException: Too Many Requests",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "path": "/tools/execute"
}
```

### 500 Internal Server Error
```json
{
  "statusCode": 500,
  "message": "Internal server error",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "path": "/tools/execute"
}
```

---

## Rate Limiting

### Global Rate Limits
- **Default**: 30 requests per 60 seconds per IP

### Endpoint-Specific Limits
- **POST /tools/execute**: 10 requests per 60 seconds per IP

### Rate Limit Headers
```
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 5
X-RateLimit-Reset: 1640995200
```

---

## Best Practices

### Tool Creation
1. Use descriptive names (lowercase with underscores)
2. Provide clear descriptions
3. Define all parameters with types and descriptions
4. Mark required parameters appropriately
5. Set sensible defaults for optional parameters
6. Test custom code thoroughly before deployment

### Tool Execution
1. Always handle both success and failure responses
2. Set appropriate timeouts for long-running operations
3. Validate parameters on client-side before submission
4. Handle rate limiting with exponential backoff
5. Log execution results for debugging
6. Sanitize sensitive data in parameters

### Security
1. Never expose API keys in tool parameters
2. Use environment variables for secrets
3. Implement authentication for production
4. Whitelist allowed domains for HTTP requests
5. Disable file operations if not needed
6. Monitor tool executions for suspicious activity
7. Review custom tool code before deployment

---

## Examples

### cURL Examples

**Create Tool**:
```bash
curl -X POST http://localhost:3003/tools \
  -H "Content-Type: application/json" \
  -d '{
    "name": "hello_world",
    "description": "Simple hello world tool",
    "category": "CUSTOM",
    "parameters": [{
      "name": "name",
      "type": "string",
      "description": "Name to greet",
      "required": true
    }],
    "code": "const { name } = parameters; return `Hello, ${name}!`;"
  }'
```

**List Tools**:
```bash
curl http://localhost:3003/tools
```

**Execute Tool**:
```bash
curl -X POST http://localhost:3003/tools/execute \
  -H "Content-Type: application/json" \
  -d '{
    "toolId": "tool-uuid",
    "parameters": {
      "name": "World"
    }
  }'
```

### JavaScript/TypeScript Examples

```typescript
import axios from 'axios';

const API_BASE_URL = 'http://localhost:3003';

// Create tool
async function createTool() {
  const response = await axios.post(`${API_BASE_URL}/tools`, {
    name: 'hello_world',
    description: 'Simple hello world tool',
    category: 'CUSTOM',
    parameters: [{
      name: 'name',
      type: 'string',
      description: 'Name to greet',
      required: true,
    }],
    code: 'const { name } = parameters; return `Hello, ${name}!`;',
  });
  
  return response.data;
}

// List tools
async function listTools(category?: string) {
  const params = new URLSearchParams();
  if (category) params.append('category', category);
  
  const response = await axios.get(`${API_BASE_URL}/tools?${params}`);
  return response.data;
}

// Execute tool
async function executeTool(toolId: string, parameters: any) {
  try {
    const response = await axios.post(`${API_BASE_URL}/tools/execute`, {
      toolId,
      parameters,
      timeout: 30000,
    });
    
    if (response.data.success) {
      console.log('Result:', response.data.data);
    } else {
      console.error('Error:', response.data.error);
    }
    
    return response.data;
  } catch (error) {
    if (error.response?.status === 429) {
      console.error('Rate limit exceeded, waiting...');
      await new Promise(resolve => setTimeout(resolve, 60000));
      return executeTool(toolId, parameters);
    }
    throw error;
  }
}
```

---

## Postman Collection

Import this collection to test the API:

```json
{
  "info": {
    "name": "Tool Service API",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [
    {
      "name": "Health Check",
      "request": {
        "method": "GET",
        "header": [],
        "url": {
          "raw": "{{base_url}}/health",
          "host": ["{{base_url}}"],
          "path": ["health"]
        }
      }
    },
    {
      "name": "Create Tool",
      "request": {
        "method": "POST",
        "header": [{"key": "Content-Type", "value": "application/json"}],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"name\": \"test_tool\",\n  \"description\": \"Test tool\",\n  \"category\": \"CUSTOM\",\n  \"parameters\": [],\n  \"code\": \"return 'Hello';\"\n}"
        },
        "url": {
          "raw": "{{base_url}}/tools",
          "host": ["{{base_url}}"],
          "path": ["tools"]
        }
      }
    },
    {
      "name": "List Tools",
      "request": {
        "method": "GET",
        "header": [],
        "url": {
          "raw": "{{base_url}}/tools",
          "host": ["{{base_url}}"],
          "path": ["tools"]
        }
      }
    },
    {
      "name": "Execute Tool",
      "request": {
        "method": "POST",
        "header": [{"key": "Content-Type", "value": "application/json"}],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"toolId\": \"{{tool_id}}\",\n  \"parameters\": {}\n}"
        },
        "url": {
          "raw": "{{base_url}}/tools/execute",
          "host": ["{{base_url}}"],
          "path": ["tools", "execute"]
        }
      }
    }
  ],
  "variable": [
    {
      "key": "base_url",
      "value": "http://localhost:3003"
    }
  ]
}
```

---

## Changelog

### Version 1.0.0
- Initial release
- CRUD operations for tools
- Built-in tools: HTTP request, web scraper, JSON parser, file operations
- Custom tool support with sandboxed execution
- Rate limiting
- Parameter validation
- Health check endpoint

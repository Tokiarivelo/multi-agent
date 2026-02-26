# Tool Service Examples

## Basic Examples

### 1. Simple String Manipulator

Create a tool that manipulates strings:

```bash
curl -X POST http://localhost:3003/tools \
  -H "Content-Type: application/json" \
  -d '{
    "name": "string_manipulator",
    "description": "Manipulate strings with various operations",
    "category": "CUSTOM",
    "parameters": [
      {
        "name": "text",
        "type": "string",
        "description": "Input text",
        "required": true
      },
      {
        "name": "operation",
        "type": "string",
        "description": "Operation: uppercase, lowercase, reverse, capitalize",
        "required": true
      }
    ],
    "code": "const { text, operation } = parameters;\n\nswitch(operation) {\n  case '\''uppercase'\'':\n    return text.toUpperCase();\n  case '\''lowercase'\'':\n    return text.toLowerCase();\n  case '\''reverse'\'':\n    return text.split('\'\'').reverse().join('\'\'');\n  case '\''capitalize'\'':\n    return text.split('\'' '\'').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join('\'' '\'');\n  default:\n    throw new Error('\''Unknown operation'\'');\n}"
  }'
```

Execute:
```bash
curl -X POST http://localhost:3003/tools/execute \
  -H "Content-Type: application/json" \
  -d '{
    "toolId": "tool-id-here",
    "parameters": {
      "text": "hello world",
      "operation": "capitalize"
    }
  }'
```

Response:
```json
{
  "success": true,
  "data": "Hello World",
  "executionTime": 15
}
```

---

### 2. Number Calculator

Create a calculator tool:

```javascript
{
  "name": "calculator",
  "description": "Perform mathematical operations",
  "category": "CUSTOM",
  "parameters": [
    {
      "name": "operation",
      "type": "string",
      "description": "Operation: add, subtract, multiply, divide, power, sqrt",
      "required": true
    },
    {
      "name": "a",
      "type": "number",
      "description": "First number",
      "required": true
    },
    {
      "name": "b",
      "type": "number",
      "description": "Second number (not required for sqrt)",
      "required": false
    }
  ],
  "code": `
const { operation, a, b } = parameters;

switch(operation) {
  case 'add':
    return a + b;
  case 'subtract':
    return a - b;
  case 'multiply':
    return a * b;
  case 'divide':
    if (b === 0) throw new Error('Division by zero');
    return a / b;
  case 'power':
    return Math.pow(a, b);
  case 'sqrt':
    if (a < 0) throw new Error('Cannot calculate square root of negative number');
    return Math.sqrt(a);
  default:
    throw new Error('Unknown operation');
}
  `
}
```

---

### 3. Array Operations

Create a tool for array manipulation:

```javascript
{
  "name": "array_processor",
  "description": "Process arrays with various operations",
  "category": "CUSTOM",
  "parameters": [
    {
      "name": "data",
      "type": "array",
      "description": "Input array",
      "required": true
    },
    {
      "name": "operation",
      "type": "string",
      "description": "Operation: sum, average, max, min, sort, unique, filter",
      "required": true
    },
    {
      "name": "condition",
      "type": "string",
      "description": "Condition for filter operation (e.g., '>10')",
      "required": false
    }
  ],
  "code": `
const { data, operation, condition } = parameters;

switch(operation) {
  case 'sum':
    return data.reduce((acc, val) => acc + val, 0);
  
  case 'average':
    return data.reduce((acc, val) => acc + val, 0) / data.length;
  
  case 'max':
    return Math.max(...data);
  
  case 'min':
    return Math.min(...data);
  
  case 'sort':
    return [...data].sort((a, b) => a - b);
  
  case 'unique':
    return [...new Set(data)];
  
  case 'filter':
    if (!condition) throw new Error('Condition required for filter');
    const operator = condition.match(/[><=!]+/)[0];
    const value = parseFloat(condition.match(/[0-9.]+/)[0]);
    
    switch(operator) {
      case '>': return data.filter(x => x > value);
      case '<': return data.filter(x => x < value);
      case '>=': return data.filter(x => x >= value);
      case '<=': return data.filter(x => x <= value);
      case '==': return data.filter(x => x == value);
      case '!=': return data.filter(x => x != value);
      default: throw new Error('Invalid operator');
    }
  
  default:
    throw new Error('Unknown operation');
}
  `
}
```

---

## Advanced Examples

### 4. Data Validator

Create a tool for data validation:

```javascript
{
  "name": "data_validator",
  "description": "Validate data against schema",
  "category": "CUSTOM",
  "parameters": [
    {
      "name": "data",
      "type": "object",
      "description": "Data to validate",
      "required": true
    },
    {
      "name": "schema",
      "type": "object",
      "description": "Validation schema",
      "required": true
    }
  ],
  "code": `
const { data, schema } = parameters;
const errors = [];

for (const [key, rules] of Object.entries(schema)) {
  const value = data[key];
  
  if (rules.required && (value === undefined || value === null)) {
    errors.push(\`\${key} is required\`);
    continue;
  }
  
  if (value !== undefined && rules.type) {
    const actualType = Array.isArray(value) ? 'array' : typeof value;
    if (actualType !== rules.type) {
      errors.push(\`\${key} must be of type \${rules.type}\`);
    }
  }
  
  if (rules.min !== undefined && value < rules.min) {
    errors.push(\`\${key} must be at least \${rules.min}\`);
  }
  
  if (rules.max !== undefined && value > rules.max) {
    errors.push(\`\${key} must be at most \${rules.max}\`);
  }
  
  if (rules.pattern && typeof value === 'string') {
    const regex = new RegExp(rules.pattern);
    if (!regex.test(value)) {
      errors.push(\`\${key} does not match pattern\`);
    }
  }
}

return {
  valid: errors.length === 0,
  errors
};
  `
}
```

Usage:
```json
{
  "toolId": "validator-id",
  "parameters": {
    "data": {
      "name": "John",
      "age": 25,
      "email": "john@example.com"
    },
    "schema": {
      "name": {
        "required": true,
        "type": "string"
      },
      "age": {
        "required": true,
        "type": "number",
        "min": 18,
        "max": 100
      },
      "email": {
        "required": true,
        "type": "string",
        "pattern": "^[^@]+@[^@]+\\.[^@]+$"
      }
    }
  }
}
```

---

### 5. CSV Parser

Create a tool to parse CSV data:

```javascript
{
  "name": "csv_parser",
  "description": "Parse CSV data into array of objects",
  "category": "CUSTOM",
  "parameters": [
    {
      "name": "csv",
      "type": "string",
      "description": "CSV string",
      "required": true
    },
    {
      "name": "delimiter",
      "type": "string",
      "description": "Column delimiter",
      "required": false,
      "default": ","
    },
    {
      "name": "hasHeader",
      "type": "boolean",
      "description": "First row is header",
      "required": false,
      "default": true
    }
  ],
  "code": `
const { csv, delimiter = ',', hasHeader = true } = parameters;

const lines = csv.trim().split('\\n');
const headers = hasHeader ? lines[0].split(delimiter) : null;
const dataLines = hasHeader ? lines.slice(1) : lines;

if (!hasHeader) {
  return dataLines.map(line => line.split(delimiter));
}

return dataLines.map(line => {
  const values = line.split(delimiter);
  const obj = {};
  headers.forEach((header, index) => {
    obj[header.trim()] = values[index]?.trim();
  });
  return obj;
});
  `
}
```

---

### 6. Template Renderer

Create a tool for template rendering:

```javascript
{
  "name": "template_renderer",
  "description": "Render template with variables",
  "category": "CUSTOM",
  "parameters": [
    {
      "name": "template",
      "type": "string",
      "description": "Template string with {{variable}} placeholders",
      "required": true
    },
    {
      "name": "variables",
      "type": "object",
      "description": "Variables to replace",
      "required": true
    }
  ],
  "code": `
const { template, variables } = parameters;

let result = template;
for (const [key, value] of Object.entries(variables)) {
  const regex = new RegExp(\`{{\\\\s*\${key}\\\\s*}}\`, 'g');
  result = result.replace(regex, String(value));
}

return result;
  `
}
```

Usage:
```json
{
  "toolId": "template-id",
  "parameters": {
    "template": "Hello {{name}}, you are {{age}} years old!",
    "variables": {
      "name": "John",
      "age": 30
    }
  }
}
```

Result: `"Hello John, you are 30 years old!"`

---

## Real-World Examples

### 7. Currency Converter (with HTTP Request)

First, create the currency converter tool, then execute it:

```javascript
{
  "name": "currency_converter",
  "description": "Convert between currencies using exchange rates",
  "category": "CUSTOM",
  "parameters": [
    {
      "name": "amount",
      "type": "number",
      "description": "Amount to convert",
      "required": true
    },
    {
      "name": "from",
      "type": "string",
      "description": "Source currency code (e.g., USD)",
      "required": true
    },
    {
      "name": "to",
      "type": "string",
      "description": "Target currency code (e.g., EUR)",
      "required": true
    }
  ],
  "code": `
// Note: In real implementation, you would use the http_request built-in tool
// This is a simplified example with mock data

const { amount, from, to } = parameters;

// Mock exchange rates (in production, fetch from API)
const rates = {
  'USD': { 'EUR': 0.85, 'GBP': 0.73, 'JPY': 110.0 },
  'EUR': { 'USD': 1.18, 'GBP': 0.86, 'JPY': 129.5 },
  'GBP': { 'USD': 1.37, 'EUR': 1.16, 'JPY': 150.5 }
};

if (from === to) {
  return amount;
}

if (!rates[from] || !rates[from][to]) {
  throw new Error(\`Conversion rate not available for \${from} to \${to}\`);
}

const rate = rates[from][to];
const converted = amount * rate;

return {
  amount,
  from,
  to,
  rate,
  converted: Math.round(converted * 100) / 100
};
  `
}
```

---

### 8. Text Summarizer

Create a tool to summarize text:

```javascript
{
  "name": "text_summarizer",
  "description": "Summarize text by extracting key sentences",
  "category": "CUSTOM",
  "parameters": [
    {
      "name": "text",
      "type": "string",
      "description": "Text to summarize",
      "required": true
    },
    {
      "name": "maxSentences",
      "type": "number",
      "description": "Maximum sentences in summary",
      "required": false,
      "default": 3
    }
  ],
  "code": `
const { text, maxSentences = 3 } = parameters;

// Split into sentences
const sentences = text
  .split(/[.!?]+/)
  .map(s => s.trim())
  .filter(s => s.length > 0);

if (sentences.length <= maxSentences) {
  return text;
}

// Simple word frequency analysis
const words = text
  .toLowerCase()
  .split(/\\W+/)
  .filter(w => w.length > 3);

const wordFreq = {};
words.forEach(word => {
  wordFreq[word] = (wordFreq[word] || 0) + 1;
});

// Score sentences by word frequency
const scoredSentences = sentences.map((sentence, index) => {
  const sentenceWords = sentence.toLowerCase().split(/\\W+/);
  const score = sentenceWords.reduce((sum, word) => {
    return sum + (wordFreq[word] || 0);
  }, 0);
  
  return { sentence, score, index };
});

// Select top sentences
const topSentences = scoredSentences
  .sort((a, b) => b.score - a.score)
  .slice(0, maxSentences)
  .sort((a, b) => a.index - b.index)
  .map(s => s.sentence);

return topSentences.join('. ') + '.';
  `
}
```

---

### 9. Data Aggregator

Create a tool for aggregating data:

```javascript
{
  "name": "data_aggregator",
  "description": "Aggregate data by grouping and computing statistics",
  "category": "CUSTOM",
  "parameters": [
    {
      "name": "data",
      "type": "array",
      "description": "Array of objects to aggregate",
      "required": true
    },
    {
      "name": "groupBy",
      "type": "string",
      "description": "Field to group by",
      "required": true
    },
    {
      "name": "aggregations",
      "type": "object",
      "description": "Aggregation functions (e.g., {sales: 'sum', count: 'count'})",
      "required": true
    }
  ],
  "code": `
const { data, groupBy, aggregations } = parameters;

// Group data
const groups = {};
data.forEach(item => {
  const key = item[groupBy];
  if (!groups[key]) {
    groups[key] = [];
  }
  groups[key].push(item);
});

// Aggregate each group
const result = Object.entries(groups).map(([key, items]) => {
  const aggregated = { [groupBy]: key };
  
  for (const [field, func] of Object.entries(aggregations)) {
    switch(func) {
      case 'sum':
        aggregated[field] = items.reduce((sum, item) => sum + (item[field] || 0), 0);
        break;
      case 'avg':
      case 'average':
        const total = items.reduce((sum, item) => sum + (item[field] || 0), 0);
        aggregated[field] = total / items.length;
        break;
      case 'count':
        aggregated[field] = items.length;
        break;
      case 'min':
        aggregated[field] = Math.min(...items.map(item => item[field] || Infinity));
        break;
      case 'max':
        aggregated[field] = Math.max(...items.map(item => item[field] || -Infinity));
        break;
      default:
        throw new Error(\`Unknown aggregation function: \${func}\`);
    }
  }
  
  return aggregated;
});

return result;
  `
}
```

Usage:
```json
{
  "toolId": "aggregator-id",
  "parameters": {
    "data": [
      { "category": "Electronics", "sales": 1000, "quantity": 5 },
      { "category": "Electronics", "sales": 2000, "quantity": 10 },
      { "category": "Books", "sales": 500, "quantity": 20 },
      { "category": "Books", "sales": 300, "quantity": 15 }
    ],
    "groupBy": "category",
    "aggregations": {
      "totalSales": "sum",
      "avgSales": "avg",
      "itemCount": "count",
      "maxQuantity": "max"
    }
  }
}
```

Result:
```json
{
  "success": true,
  "data": [
    {
      "category": "Electronics",
      "totalSales": 3000,
      "avgSales": 1500,
      "itemCount": 2,
      "maxQuantity": 10
    },
    {
      "category": "Books",
      "totalSales": 800,
      "avgSales": 400,
      "itemCount": 2,
      "maxQuantity": 20
    }
  ]
}
```

---

### 10. API Response Transformer

Transform API responses:

```javascript
{
  "name": "api_transformer",
  "description": "Transform API response to desired format",
  "category": "CUSTOM",
  "parameters": [
    {
      "name": "data",
      "type": "object",
      "description": "API response data",
      "required": true
    },
    {
      "name": "mapping",
      "type": "object",
      "description": "Field mapping (newField: oldField)",
      "required": true
    }
  ],
  "code": `
const { data, mapping } = parameters;

function getNestedValue(obj, path) {
  return path.split('.').reduce((current, prop) => current?.[prop], obj);
}

function transform(item) {
  const result = {};
  for (const [newField, oldField] of Object.entries(mapping)) {
    result[newField] = getNestedValue(item, oldField);
  }
  return result;
}

if (Array.isArray(data)) {
  return data.map(transform);
}

return transform(data);
  `
}
```

Usage:
```json
{
  "toolId": "transformer-id",
  "parameters": {
    "data": {
      "user": {
        "personal_info": {
          "first_name": "John",
          "last_name": "Doe"
        },
        "contact": {
          "email_address": "john@example.com"
        }
      }
    },
    "mapping": {
      "name": "user.personal_info.first_name",
      "surname": "user.personal_info.last_name",
      "email": "user.contact.email_address"
    }
  }
}
```

Result:
```json
{
  "success": true,
  "data": {
    "name": "John",
    "surname": "Doe",
    "email": "john@example.com"
  }
}
```

---

## Testing Examples

### Integration Testing

```typescript
import { ToolService } from './tool.service';

describe('Tool Integration Tests', () => {
  let toolService: ToolService;
  
  beforeEach(() => {
    toolService = new ToolService();
  });
  
  it('should execute array operations tool', async () => {
    const result = await toolService.execute({
      toolId: 'array-processor-id',
      parameters: {
        data: [5, 2, 8, 1, 9],
        operation: 'sort'
      }
    });
    
    expect(result.success).toBe(true);
    expect(result.data).toEqual([1, 2, 5, 8, 9]);
  });
  
  it('should handle errors gracefully', async () => {
    const result = await toolService.execute({
      toolId: 'calculator-id',
      parameters: {
        operation: 'divide',
        a: 10,
        b: 0
      }
    });
    
    expect(result.success).toBe(false);
    expect(result.error).toContain('Division by zero');
  });
});
```

---

## Best Practices

1. **Keep Tools Focused**: Each tool should do one thing well
2. **Validate Inputs**: Always check parameters before processing
3. **Handle Errors**: Use try-catch and provide clear error messages
4. **Document Well**: Clear descriptions and parameter documentation
5. **Test Thoroughly**: Test with various inputs and edge cases
6. **Consider Performance**: Optimize for large datasets
7. **Use Async When Needed**: For I/O operations
8. **Log Appropriately**: Use console.log for debugging

---

## Common Patterns

### Error Handling Pattern
```javascript
const { data } = parameters;

try {
  // Validate input
  if (!data || !Array.isArray(data)) {
    throw new Error('Data must be an array');
  }
  
  if (data.length === 0) {
    throw new Error('Data array cannot be empty');
  }
  
  // Process data
  const result = data.map(/* ... */);
  
  return result;
} catch (error) {
  console.error('Processing failed:', error.message);
  throw error;
}
```

### Async Operation Pattern
```javascript
const { url } = parameters;

async function fetchData() {
  // Async operations here
  return result;
}

return await fetchData();
```

### Configuration Pattern
```javascript
const { data, options = {} } = parameters;

const config = {
  // Defaults
  timeout: 5000,
  retries: 3,
  // Override with user options
  ...options
};

// Use config
return processWithConfig(data, config);
```

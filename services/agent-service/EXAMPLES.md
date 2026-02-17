# Agent Service Examples

## Example 1: Create a Code Assistant Agent

```bash
curl -X POST http://localhost:3002/api/agents \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Code Assistant",
    "description": "Helps with coding tasks and debugging",
    "modelId": "gpt-4",
    "systemPrompt": "You are an expert software engineer. Help users with coding problems, provide clean solutions, and explain your reasoning.",
    "temperature": 0.7,
    "maxTokens": 3000,
    "tools": ["code-search", "file-reader"],
    "metadata": {
      "category": "development",
      "version": "1.0"
    }
  }'
```

## Example 2: Create a Customer Support Agent

```bash
curl -X POST http://localhost:3002/api/agents \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Support Bot",
    "description": "Handles customer inquiries",
    "modelId": "gpt-3.5-turbo",
    "systemPrompt": "You are a friendly customer support agent. Be helpful, empathetic, and professional.",
    "temperature": 0.9,
    "maxTokens": 2000,
    "tools": ["ticket-system", "knowledge-base"],
    "metadata": {
      "category": "support"
    }
  }'
```

## Example 3: Execute Agent (Non-streaming)

```bash
curl -X POST http://localhost:3002/api/agents/{agent-id}/execute \
  -H "Content-Type: application/json" \
  -d '{
    "input": "Write a Python function to calculate factorial",
    "conversationHistory": [],
    "stream": false
  }'
```

## Example 4: Execute Agent with Conversation History

```bash
curl -X POST http://localhost:3002/api/agents/{agent-id}/execute \
  -H "Content-Type: application/json" \
  -d '{
    "input": "Now optimize it for large numbers",
    "conversationHistory": [
      {
        "role": "user",
        "content": "Write a Python function to calculate factorial"
      },
      {
        "role": "assistant",
        "content": "Here is a recursive factorial function:\n\ndef factorial(n):\n    if n <= 1:\n        return 1\n    return n * factorial(n-1)"
      }
    ],
    "stream": false
  }'
```

## Example 5: WebSocket Streaming (JavaScript)

```javascript
import io from 'socket.io-client';

const socket = io('ws://localhost:3002/agent-execution');

socket.on('connect', () => {
  console.log('Connected to agent execution gateway');
  
  socket.emit('execute', {
    agentId: 'your-agent-id',
    dto: {
      input: 'Explain quantum computing in simple terms',
      conversationHistory: [],
      stream: true
    }
  });
});

socket.on('token', (data) => {
  process.stdout.write(data.token);
});

socket.on('complete', (result) => {
  console.log('\n\nExecution completed!');
  console.log('Total tokens:', result.tokens);
  socket.disconnect();
});

socket.on('error', (error) => {
  console.error('Error:', error.message);
  socket.disconnect();
});
```

## Example 6: List Agents with Filters

```bash
# List all agents
curl http://localhost:3002/api/agents

# Filter by name
curl http://localhost:3002/api/agents?name=Code

# Filter by model
curl http://localhost:3002/api/agents?modelId=gpt-4

# Pagination
curl http://localhost:3002/api/agents?limit=10&offset=0
```

## Example 7: Update Agent

```bash
curl -X PUT http://localhost:3002/api/agents/{agent-id} \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Updated Code Assistant",
    "temperature": 0.5,
    "maxTokens": 4000
  }'
```

## Example 8: Delete Agent

```bash
curl -X DELETE http://localhost:3002/api/agents/{agent-id}
```

## Example 9: Advanced Agent with Multiple Tools

```bash
curl -X POST http://localhost:3002/api/agents \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Research Assistant",
    "description": "Conducts research using multiple tools",
    "modelId": "gpt-4-turbo",
    "systemPrompt": "You are a research assistant. Use available tools to gather information and provide comprehensive answers.",
    "temperature": 0.3,
    "maxTokens": 8000,
    "tools": [
      "web-search",
      "wikipedia",
      "arxiv-search",
      "calculator"
    ],
    "metadata": {
      "category": "research",
      "priority": "high"
    }
  }'
```

## Example 10: Python Client for Streaming

```python
import socketio

sio = socketio.Client()

@sio.on('connect')
def on_connect():
    print('Connected to agent service')
    sio.emit('execute', {
        'agentId': 'your-agent-id',
        'dto': {
            'input': 'Write a detailed analysis of machine learning',
            'conversationHistory': [],
            'stream': True
        }
    })

@sio.on('token')
def on_token(data):
    print(data['token'], end='', flush=True)

@sio.on('complete')
def on_complete(result):
    print(f"\n\nCompleted! Tokens: {result['tokens']}")
    sio.disconnect()

@sio.on('error')
def on_error(error):
    print(f"Error: {error['message']}")
    sio.disconnect()

sio.connect('ws://localhost:3002/agent-execution')
sio.wait()
```

# Agent Node — Multi-Tool, Sub-Agents & MCP Server

## 1. Multi-Tool Support

The AGENT node config now accepts `toolIds[]`. These are merged with the agent's own tools at runtime (deduplicated).

**Config shape:**

```json
{ "agentId": "abc-123", "toolIds": ["t1", "t2"], "subAgents": [], "maxTokens": 0 }
```

## 2. Sub-Agent Delegation + Compact Handoff

Attach sub-agents to any AGENT node. After the primary agent answers, each sub-agent is called with a summarized context (compact handoff) or the full conversation.

**Compact handoff** caps the context at ~2000 chars before sending to the sub-agent — saves 60-80% tokens on long runs.

**Output shape:**

```json
{
  "output": "...",
  "tokens": 1234,
  "subAgentResults": [{ "agentId": "...", "role": "Reviewer", "output": "...", "tokens": 320 }]
}
```

Access downstream: `$.subAgentResults[0].output`

## 3. MCP Server

`POST http://agent-service:3002/mcp` — JSON-RPC 2.0

| Method       | Description      |
| ------------ | ---------------- |
| `initialize` | Handshake        |
| `tools/list` | List tools by ID |
| `tools/call` | Execute a tool   |
| `ping`       | Liveness         |

```bash
make test-mcp   # smoke test
make dev-agent  # start agent-service locally
make test-agent # run tests
```

Claude Desktop / Cursor config:

```json
{ "mcpServers": { "multi-agent": { "url": "http://localhost:3002/mcp" } } }
```

# NATS Event Bus Implementation Guide

This document describes the NATS-based event-driven architecture for the Multi-Agent Platform.

## Overview

The platform uses NATS with JetStream for event-driven communication between microservices. This provides:

- **Asynchronous Communication**: Services communicate through events without direct coupling
- **Persistence**: JetStream stores events for reliability
- **Streaming**: Real-time token streaming for LLM responses
- **Idempotency**: Each event is processed exactly once
- **Dead Letter Queue**: Failed events are moved to DLQ for analysis

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Gateway    │────▶│    NATS     │◀────│Orchestration│
│  Service    │     │ JetStream   │     │  Service    │
└─────────────┘     └─────────────┘     └─────────────┘
                           ▲
                           │
          ┌────────────────┼────────────────┐
          │                │                │
    ┌─────▼─────┐   ┌──────▼────┐   ┌──────▼────┐
    │   Agent   │   │   Tool    │   │  Model    │
    │  Service  │   │  Service  │   │ Service   │
    └───────────┘   └───────────┘   └───────────┘
```

## Event Contracts

All events are defined in `@multi-agent/events` package with TypeScript interfaces.

### Event Structure

```typescript
interface BaseEvent {
  eventId: string;           // Unique event ID (UUID)
  eventType: string;         // Event subject (e.g., "workflow.execution.requested")
  timestamp: Date;           // When the event was created
  correlationId?: string;    // For tracking related events
  causationId?: string;      // ID of the event that caused this one
  version: string;           // Event schema version
}
```

### Event Subjects

Events follow a hierarchical naming convention:

- `workflow.*` - Workflow lifecycle events
- `execution.*` - Execution lifecycle events
- `execution.node.*` - Node-level execution events
- `agent.*` - Agent lifecycle events
- `agent.execution.*` - Agent execution events
- `tool.execution.*` - Tool execution events
- `model.inference.*` - Model inference events
- `model.token.*` - Token streaming events
- `vector.*` - Vector database events

## Using the NATS Client

### 1. Setup in Service

```typescript
import { NatsClient, defaultNatsConfig } from '@multi-agent/nats-client';
import { EventSubjects } from '@multi-agent/events';

// Initialize client
const natsClient = new NatsClient(defaultNatsConfig, 'my-service');

// Connect
await natsClient.connect();
```

### 2. Publishing Events

```typescript
import { WorkflowExecutionRequestedEvent } from '@multi-agent/events';
import { v4 as uuidv4 } from 'uuid';

const event: WorkflowExecutionRequestedEvent = {
  eventId: uuidv4(),
  eventType: EventSubjects.WORKFLOW_EXECUTION_REQUESTED,
  timestamp: new Date(),
  version: '1.0',
  data: {
    workflowId: 'workflow-123',
    userId: 'user-456',
    executionId: 'execution-789',
    input: { key: 'value' },
  },
};

await natsClient.publish(event);
```

### 3. Subscribing to Events

```typescript
import { ExecutionNodeCompletedEvent } from '@multi-agent/events';

// Subscribe to all execution node completed events
await natsClient.subscribe(
  EventSubjects.EXECUTION_NODE_COMPLETED,
  async (event: ExecutionNodeCompletedEvent) => {
    console.log('Node completed:', event.data.nodeId);
    // Process the event...
  },
  'my-service-node-completed-handler'
);

// Subscribe with wildcards
await natsClient.subscribe(
  'execution.node.*',
  async (event) => {
    // Handle all node events
  }
);
```

### 4. Request/Reply Pattern

```typescript
// Service A: Reply to requests
await natsClient.subscribe(
  'tool.execute.request',
  async (request) => {
    // Process request
    const result = await executeTool(request.data);
    
    // Publish response
    await natsClient.publish({
      eventId: uuidv4(),
      eventType: 'tool.execute.response',
      timestamp: new Date(),
      version: '1.0',
      correlationId: request.eventId,
      data: { result },
    });
  }
);

// Service B: Make request
const response = await natsClient.request(
  'tool.execute.request',
  {
    eventId: uuidv4(),
    eventType: 'tool.execute.request',
    timestamp: new Date(),
    version: '1.0',
    data: { toolId: 'tool-123', params: {} },
  },
  5000 // timeout
);
```

### 5. Token Streaming

For LLM token streaming:

```typescript
// Model service: Stream tokens
for await (const token of llmStream) {
  await natsClient.publishStream(
    `model.token.stream.${executionId}`,
    token,
    false // not complete
  );
}

// Send completion signal
await natsClient.publishStream(
  `model.token.stream.${executionId}`,
  '',
  true // complete
);

// Frontend: Subscribe to stream
const subscription = connection.subscribe(
  `model.token.stream.${executionId}`
);

for await (const msg of subscription) {
  const { token, isComplete } = JSON.parse(msg.data);
  if (isComplete) break;
  displayToken(token);
}
```

## Idempotency

The NATS client automatically handles idempotency:

1. Before processing an event, it checks if the `eventId` has been processed
2. If already processed, the event is acknowledged and skipped
3. If not processed, the event is handled and marked as processed
4. Event IDs are stored in memory with TTL (1 hour)

**Production Note**: For production, replace the in-memory store with Redis or another distributed cache.

## Dead Letter Queue (DLQ)

Failed events are automatically sent to the DLQ after max delivery attempts:

1. Each failed delivery increments the redelivery count
2. After reaching `maxDeliverAttempts` (default: 3), the event is sent to DLQ
3. DLQ events include:
   - Original event
   - Failure reason
   - Failure count
   - First and last failure timestamps

### Monitoring DLQ

```typescript
// Subscribe to DLQ
await natsClient.subscribe('dlq.*', async (dlqEvent) => {
  console.error('Event failed:', dlqEvent);
  // Alert, log, or retry manually
});
```

## JetStream Streams

The platform uses two streams:

### 1. EVENTS Stream

- **Subjects**: All application events
- **Retention**: 7 days
- **Storage**: File-based
- **Max Messages**: 1,000,000
- **Deduplication**: 2-minute window

### 2. DLQ Stream

- **Subjects**: `dlq.*`
- **Retention**: 30 days
- **Storage**: File-based

## Environment Configuration

```bash
# .env
NATS_URL=nats://localhost:4222
NATS_MAX_RECONNECT_ATTEMPTS=-1
NATS_RECONNECT_TIME_WAIT=2000
NATS_MAX_DELIVER_ATTEMPTS=3
```

## Local Development

Start NATS with JetStream:

```bash
docker-compose up nats
```

Or using Docker directly:

```bash
docker run -p 4222:4222 -p 8222:8222 nats:2.10-alpine -js
```

## Kubernetes Deployment

Deploy NATS to Kubernetes:

```bash
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/nats/nats.yaml
```

This creates:
- StatefulSet with JetStream enabled
- Persistent storage (10Gi)
- Services (internal and external)
- HorizontalPodAutoscaler
- Health checks

## Monitoring

NATS exposes metrics on port 8222:

- Health: `http://localhost:8222/healthz`
- Metrics: `http://localhost:8222/varz`
- JetStream info: `http://localhost:8222/jsz`
- Connections: `http://localhost:8222/connz`

## Best Practices

1. **Event Design**
   - Keep events small and focused
   - Include correlation IDs for tracing
   - Version your events
   - Make events immutable

2. **Error Handling**
   - Handle errors gracefully in event handlers
   - Log failures with context
   - Use DLQ for persistent failures
   - Set appropriate timeouts

3. **Performance**
   - Use wildcards carefully (can be slow)
   - Batch operations when possible
   - Configure appropriate buffer sizes
   - Monitor JetStream storage usage

4. **Security**
   - Use TLS for production
   - Implement authentication
   - Use access control lists (ACLs)
   - Encrypt sensitive data in events

## Example: Workflow Execution Flow

```typescript
// 1. Gateway receives request
await natsClient.publish({
  eventType: EventSubjects.WORKFLOW_EXECUTION_REQUESTED,
  data: { workflowId, userId, executionId },
});

// 2. Orchestration service picks up and starts execution
await natsClient.subscribe(
  EventSubjects.WORKFLOW_EXECUTION_REQUESTED,
  async (event) => {
    await natsClient.publish({
      eventType: EventSubjects.EXECUTION_STARTED,
      data: { executionId, workflowId, userId },
    });
    
    // Execute each node
    await natsClient.publish({
      eventType: EventSubjects.AGENT_EXECUTION_REQUESTED,
      data: { agentId, executionId, nodeId, input },
    });
  }
);

// 3. Agent service processes
await natsClient.subscribe(
  EventSubjects.AGENT_EXECUTION_REQUESTED,
  async (event) => {
    const result = await executeAgent(event.data);
    
    await natsClient.publish({
      eventType: EventSubjects.AGENT_EXECUTION_COMPLETED,
      data: { agentId, executionId, nodeId, output: result },
    });
  }
);

// 4. Orchestration service continues workflow
await natsClient.subscribe(
  EventSubjects.AGENT_EXECUTION_COMPLETED,
  async (event) => {
    // Move to next node or complete execution
  }
);
```

## Troubleshooting

### Connection Issues

```typescript
// Check connection status
if (!natsClient.isConnected) {
  console.error('NATS not connected');
}

// Connection will auto-reconnect
// Check logs for reconnection events
```

### Event Not Received

1. Check subject name matches exactly
2. Verify consumer is created: `nats consumer ls EVENTS`
3. Check event is published: `nats stream view EVENTS`
4. Verify no errors in logs

### DLQ Messages

```bash
# View DLQ messages
nats stream view DLQ

# Replay from DLQ (manual retry)
nats stream get DLQ <msg-id>
```

## References

- [NATS Documentation](https://docs.nats.io/)
- [JetStream Guide](https://docs.nats.io/nats-concepts/jetstream)
- [NATS.js Client](https://github.com/nats-io/nats.js)

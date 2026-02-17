# NATS Event Bus Implementation Plan

## Requirement Summary
Replace direct HTTP service-to-service calls with NATS event-driven architecture using JetStream for persistence.

## Implementation Tasks

### 1. NATS Infrastructure Setup
- [ ] Add NATS deployment to Kubernetes (StatefulSet)
- [ ] Configure JetStream with persistent storage (PVC)
- [ ] Set up NATS subjects/streams for each service
- [ ] Configure dead-letter queues

### 2. Event Contracts Package
- [ ] Create @multi-agent/events package
- [ ] Define event schemas for all services
- [ ] Add event versioning
- [ ] Document event flows

### 3. Service Updates Required

#### Gateway Service
- [ ] Keep REST endpoints for client communication
- [ ] Publish authentication events
- [ ] No changes to external API

#### Orchestration Service
- [ ] Replace agent-client and tool-client HTTP calls
- [ ] Publish: workflow.execution.started, workflow.execution.completed
- [ ] Subscribe to: agent.execution.completed, tool.execution.completed
- [ ] Use request/reply for synchronous needs

#### Agent Service
- [ ] Subscribe to: agent.execution.requested
- [ ] Publish: agent.execution.started, agent.execution.completed, agent.token.streamed
- [ ] Stream tokens via NATS for real-time output
- [ ] Replace model-service HTTP client with NATS request/reply

#### Tool Service
- [ ] Subscribe to: tool.execution.requested
- [ ] Publish: tool.execution.started, tool.execution.completed
- [ ] Implement idempotent execution handlers

#### Model Service
- [ ] Subscribe to: model.key.requested, model.config.requested
- [ ] Publish: model.key.retrieved, model.config.retrieved
- [ ] Use request/reply pattern for key decryption

#### Vector Service (TODO)
- [ ] Subscribe to: vector.search.requested, vector.upsert.requested
- [ ] Publish: vector.search.completed, vector.upsert.completed

#### Execution Service (TODO)
- [ ] Subscribe to all execution events
- [ ] Persist execution logs
- [ ] Publish: execution.log.created

### 4. Common NATS Package
- [ ] Create @multi-agent/nats package with:
  - NatsService (connection management)
  - Event publisher helpers
  - Event subscriber decorators
  - Idempotency middleware
  - Dead-letter queue handler
  - Connection retry logic

### 5. Event Subjects Structure
```
workflow.execution.started
workflow.execution.completed
workflow.execution.failed
agent.execution.requested
agent.execution.started
agent.execution.completed
agent.token.streamed
tool.execution.requested
tool.execution.started
tool.execution.completed
model.key.requested
model.key.retrieved
model.config.requested
vector.search.requested
execution.log.created
```

### 6. Kubernetes Resources Needed
- [ ] NATS StatefulSet with 3 replicas
- [ ] NATS Service (ClusterIP)
- [ ] PersistentVolumeClaim for JetStream storage
- [ ] ConfigMap for NATS configuration
- [ ] NATS monitoring dashboard

### 7. Dependencies to Add
```json
{
  "nats": "^2.19.0",
  "@nestjs/microservices": "^10.3.0"
}
```

## Current Status
- ✅ HTTP-based service communication implemented
- ⏳ NATS migration pending
- 📋 This plan ready for implementation

## Benefits of NATS Migration
- Decoupled services
- Better scalability
- Event replay capability
- Message persistence
- Async processing
- Lower latency
- Better fault tolerance

## Estimated Effort
- Infrastructure setup: 4 hours
- @multi-agent/nats package: 8 hours
- Service migrations: 16 hours (2-3 hours per service)
- Testing and validation: 8 hours
- **Total: ~36 hours**

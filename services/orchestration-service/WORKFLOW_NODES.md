# Workflow Node System — Docs

> **Languages / Langues**: English (EN) · Français (FR)

---

## 1. Overview / Vue d'ensemble

The workflow node system allows users to visually build, edit, and execute multi-agent workflows through an interactive drag-and-drop canvas. Real-time execution logs are streamed via WebSocket directly to the browser.

Le système de nœuds de workflow permet aux utilisateurs de construire, éditer et exécuter des workflows multi-agents via un canvas interactif avec glisser-déposer. Les journaux d'exécution en temps réel sont diffusés via WebSocket directement dans le navigateur.

---

## 2. Architecture

```
Frontend                          Backend (orchestration-service)
──────────────────────────────    ──────────────────────────────────────────
WorkflowCanvas (ReactFlow)   ──►  PUT  /workflows/:id
  └─ WorkflowFlowNode             POST /workflows/:id/nodes
  └─ NodeEditor (dialog)     ──►  PUT  /workflows/:id/nodes/:nodeId
                                  DELETE /workflows/:id/nodes/:nodeId
                                  POST /workflows/:id/edges
                                  DELETE /workflows/:id/edges/:edgeId

WorkflowEditor               ──►  POST /workflows/:id/execute
  └─ ExecutionLogsPanel  ◄──  WS  ws://host/workflows  (Socket.IO)
  └─ useWorkflowLogs              events: node:update, execution:update
```

---

## 3. Node Types / Types de nœuds

| ID            | Label EN  | Label FR    | Description                            |
| ------------- | --------- | ----------- | -------------------------------------- |
| `START`       | Start     | Départ      | Entry point — required, unique         |
| `END`         | End       | Fin         | Terminal node — required, at least one |
| `AGENT`       | Agent     | Agent       | Calls an AI agent via agent-service    |
| `TOOL`        | Tool      | Outil       | Executes a tool via tool-service       |
| `CONDITIONAL` | Condition | Condition   | Branches on a JS expression            |
| `TRANSFORM`   | Transform | Transformer | Maps/transforms data between nodes     |

---

## 4. Backend Endpoints (orchestration-service)

### Workflow CRUD

| Method   | Path             | Description                           |
| -------- | ---------------- | ------------------------------------- |
| `POST`   | `/workflows`     | Create a new workflow                 |
| `GET`    | `/workflows`     | List all workflows (paginated)        |
| `GET`    | `/workflows/:id` | Get a workflow by ID                  |
| `PUT`    | `/workflows/:id` | Update workflow metadata / definition |
| `DELETE` | `/workflows/:id` | Delete a workflow                     |

### Node Operations

| Method   | Path                           | Description             |
| -------- | ------------------------------ | ----------------------- |
| `POST`   | `/workflows/:id/nodes`         | Add a node              |
| `PUT`    | `/workflows/:id/nodes/:nodeId` | Update a node           |
| `DELETE` | `/workflows/:id/nodes/:nodeId` | Remove a node (+ edges) |

### Edge Operations

| Method   | Path                           | Description    |
| -------- | ------------------------------ | -------------- |
| `POST`   | `/workflows/:id/edges`         | Add an edge    |
| `DELETE` | `/workflows/:id/edges/:edgeId` | Remove an edge |

### Execution

| Method | Path                                        | Description                   |
| ------ | ------------------------------------------- | ----------------------------- |
| `POST` | `/workflows/:id/execute`                    | Execute workflow (path-param) |
| `POST` | `/workflows/execute`                        | Execute workflow (body DTO)   |
| `GET`  | `/workflows/executions/:executionId`        | Get execution status          |
| `POST` | `/workflows/executions/:executionId/cancel` | Cancel a running execution    |

---

## 5. WebSocket Events (Socket.IO — namespace `/workflows`)

### Client → Server

| Event         | Payload                   | Effect                          |
| ------------- | ------------------------- | ------------------------------- |
| `join`        | `{ executionId: string }` | Join execution room for updates |
| `leave`       | `{ executionId: string }` | Leave execution room            |
| `subscribe`   | `{ executionId: string }` | Legacy subscribe (maps to join) |
| `unsubscribe` | `{ executionId: string }` | Legacy unsubscribe              |

### Server → Client

| Event              | Payload                                                                            |
| ------------------ | ---------------------------------------------------------------------------------- |
| `joined`           | `{ executionId }`                                                                  |
| `execution:update` | `{ executionId, status, currentNodeId, nodeExecutions, output, error, timestamp }` |
| `node:update`      | `{ executionId, nodeId, status, data, timestamp }`                                 |
| `execution:error`  | `{ executionId, error, timestamp }`                                                |

---

## 6. Frontend Components

### `WorkflowCanvas`

- **Path**: `src/features/workflows/components/WorkflowCanvas.tsx`
- **Library**: `@xyflow/react` (ReactFlow v12)
- **Features**: Drag nodes, draw edges, add/edit/delete nodes via dialog, mini-map, controls
- **Persists**: All changes are saved to the backend in real-time

### `WorkflowFlowNode`

- **Path**: `src/features/workflows/components/WorkflowFlowNode.tsx`
- Custom ReactFlow node with icon, type label (EN/FR), config summary string
- Omits input handle for START, output handle for END

### `NodeEditor`

- **Path**: `src/features/workflows/components/NodeEditor.tsx`
- Dialog for creating or editing a node
- Type-specific fields: agent selector, tool selector, condition expression, transform template

### `ExecutionLogsPanel`

- **Path**: `src/features/workflows/components/ExecutionLogsPanel.tsx`
- Real-time log display with auto-scroll, connection indicator, status badge, cancel button

### `WorkflowEditor`

- **Path**: `src/features/workflows/components/WorkflowEditor.tsx`
- Metadata form (name, description, status)
- Execute / toggleable logs panel in same view

---

## 7. Frontend Hooks

| Hook                 | Purpose                                           |
| -------------------- | ------------------------------------------------- |
| `useWorkflows`       | List all workflows (paginated)                    |
| `useWorkflow`        | Fetch single workflow by ID                       |
| `useCreateWorkflow`  | Create mutation with redirect                     |
| `useUpdateWorkflow`  | Update workflow metadata                          |
| `useDeleteWorkflow`  | Delete with redirect to list                      |
| `useAddNode`         | Add node, optimistically updates ReactFlow state  |
| `useUpdateNode`      | Update node config                                |
| `useDeleteNode`      | Delete node with optimistic cache update          |
| `useAddEdge`         | Add edge                                          |
| `useDeleteEdge`      | Delete edge with optimistic cache update          |
| `useExecuteWorkflow` | Start execution, returns `WorkflowExecution`      |
| `useCancelExecution` | Cancel a running execution                        |
| `useExecution`       | Poll execution status (2s when RUNNING/PENDING)   |
| `useWorkflowLogs`    | WebSocket connection for real-time execution logs |

---

## 8. Environment Variables

### orchestration-service `.env`

```env
# Already configured
NODE_ENV=development
PORT=3002
DATABASE_URL=postgresql://...
AGENT_SERVICE_URL=http://agent-service:3003
TOOL_SERVICE_URL=http://tool-service:3004
MAX_RETRY_ATTEMPTS=3
EXECUTION_TIMEOUT=300000
```

### frontend `.env.local`

```env
# Add if orchestration-service runs on a non-default port
NEXT_PUBLIC_ORCHESTRATION_WS_URL=http://localhost:3002
```

---

## 9. Testing

```bash
# Run orchestration-service tests
make test-orchestration

# Run all backend tests
make test
```

Tests cover:

- `UpdateWorkflowUseCase` — execute, addNode, updateNode, removeNode, addEdge, removeEdge
- `DeleteWorkflowUseCase` — happy path and NotFoundException

---

## 10. Workflow Lifecycle

```
DRAFT → ACTIVE   (workflow is ready to execute)
ACTIVE → INACTIVE
ACTIVE → ARCHIVED
INACTIVE → ACTIVE
* → ARCHIVED
```

> Only `ACTIVE` workflows can be executed.  
> Seul les workflows `ACTIVE` peuvent être exécutés.

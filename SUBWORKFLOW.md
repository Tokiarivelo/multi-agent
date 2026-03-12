# Sub-Workflow Node — SUBWORKFLOW

> **Added:** 2026-03-11  
> **Layer:** Orchestration Service + Frontend (Workflow Editor)

---

## Purpose

The `SUBWORKFLOW` node type allows any workflow to call another workflow as a **synchronous, reusable sub-process**. This enables:

- **Workflow composition** — break complex logic into smaller, maintainable workflows.
- **DRY execution** — share workflow logic across multiple parent workflows without copy-pasting nodes.
- **Modular pipelines** — change a sub-workflow's internals without touching the parent.

---

## How It Works

```
Parent Workflow
│
├─ START
├─ AGENT  (generates text)
├─ SUBWORKFLOW  ─────────────►  Child Workflow
│      ↑  input vars           │  ├─ START
│      └─ (mapped from parent) │  ├─ TOOL
│                              │  └─ END
│      ◄─ output vars ─────────┘
├─ TRANSFORM
└─ END
```

1. The **SUBWORKFLOW** node resolves the target workflow by its ID.
2. A fresh **child `WorkflowExecution`** record is created in the database.
3. The child workflow is **executed inline (synchronously)** — the parent waits.
4. The child's output variables are merged back into the parent context.
5. Optional **input/output mappings** let you rename keys at the boundary.

---

## Node Configuration

| Field | Type | Required | Description |
|---|---|---|---|
| `workflowId` | `string` | ✅ | ID of the workflow to call |
| `inputMapping` | `Record<string, string>` | ❌ | Map parent variable → sub-wf input key |
| `outputMapping` | `Record<string, string>` | ❌ | Map sub-wf output key → parent variable |

### inputMapping

Maps values **from the parent context** into the sub-workflow's starting variables.

```json
{
  "inputMapping": {
    "parentVar": "subWfInputKey"
  }
}
```

*If `inputMapping` is empty, the **entire parent context** is passed as-is.*

### outputMapping

Copies specific output keys from the child context back to the parent namespace.

```json
{
  "outputMapping": {
    "subWfOutputKey": "parentResultVar"
  }
}
```

---

## Output Shape

The SUBWORKFLOW node returns an object containing:

```typescript
{
  // All child-context variables (after child workflow completes)
  ...childContextVariables,

  // Metadata injected automatically
  _subWorkflowId: string;       // ID of the referenced workflow
  _subExecutionId: string;      // ID of the child WorkflowExecution record
  _subWorkflowName: string;     // Human-readable name of the sub-workflow
}
```

---

## Guards & Constraints

| Constraint | Error |
|---|---|
| Missing `workflowId` | `SUBWORKFLOW node requires a workflowId in config` |
| `workflowId` === current workflow | `Circular sub-workflow calls are not allowed` |
| Referenced workflow not found | `SUBWORKFLOW: referenced workflow "..." not found` |
| Child workflow has no START node | `SUBWORKFLOW: referenced workflow "..." has no START node` |
| Child execution fails | Propagates as `SUBWORKFLOW "name" failed: <error>` |

---

## Frontend (Node Editor)

The `SubWorkflowConfig` component (`SubWorkflowConfig.tsx`) provides:
- A **workflow selector** dropdown (loaded from the API, excludes current workflow).
- A **circular reference warning** when the selected workflow matches the current one.
- An **Input Mapping** editor.
- An **Output Mapping** editor.
- An **Output shape** reference panel.

---

## Backend (Executor)

**File:** `services/orchestration-service/src/infrastructure/external/workflow-executor.service.ts`

Case `NodeType.SUBWORKFLOW` in `executeNodeByType()`:

1. Validates `workflowId` config field.
2. Guards against self-referencing (circular call).  
3. Loads child workflow from `IWorkflowRepository`.  
4. Builds `subInput` from parent context variables + `inputMapping` overrides.  
5. Creates and persists a `WorkflowExecution` child record.  
6. Invokes `this.executeNode(startNodeId, subWorkflow, childExecution, childContext)` — awaited synchronously.  
7. Persists child execution final status.  
8. Applies `outputMapping` and returns enriched output object.

---

## Events / NATS

The SUBWORKFLOW node does **not** emit any dedicated NATS events. The parent execution's WebSocket gateway events already include status updates for all node executions within the parent workflow. The child's RUNNING/COMPLETED events are also emitted for the child workflow independently — visible in the Execution Logs panel if listening to that child execution ID.

---

## Testing

### Makefile

```bash
# Smoke test via orchestration service (requires running services)
WORKFLOW_ID=<parent-id> NODE_ID=<node-id> SUB_WORKFLOW_ID=<child-id> make test-subworkflow
```

### Unit Test Strategy

- Mock `IWorkflowRepository.findById` to return a minimal workflow definition.
- Assert that `prisma.workflowExecution.create` is called with `workflowId = subWorkflowId`.
- Assert that `executeNode` is called with the child workflow and context.
- Verify output mapping is applied correctly.
- Test circular reference guard (same `workflowId` throws).
- Test missing child workflow (throws not-found error).

---

## Limitations (v1)

- **No loop detection beyond direct self-reference**: `A → B → A` chains are not detected. Avoid this in v1.
- **No timeout override** for the child workflow; inherits parent timeout.
- **No parallel sub-workflows**: multiple SUBWORKFLOW nodes in the same parent run sequentially (the current executor runs branches with `Promise.allSettled` but each SUBWORKFLOW within a branch is serial).

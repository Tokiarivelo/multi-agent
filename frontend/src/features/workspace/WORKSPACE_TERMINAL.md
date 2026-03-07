# Workspace Terminal & File I/O — Feature Documentation

## Overview

This feature extends the Local Workspace with three deeply integrated capabilities:

1. **In-browser Terminal** — run file commands (`ls`, `cat`, `mkdir`, `echo`, `write`) against your open workspace folder directly in the browser.
2. **Workflow Nodes: `WORKSPACE_READ` / `WORKSPACE_WRITE`** — dedicated workflow nodes that read/write files in your local workspace _during_ a workflow execution, via a WebSocket handshake.
3. **Agent Node File Access** — agent nodes can use the `workspace_read` and `workspace_write` built-in tools, which are now registered in the database and fully wired to the browser FS bridge.

---

## Architecture & Data Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                         BROWSER                                     │
│  ┌──────────────┐   ┌──────────────────┐   ┌─────────────────────┐ │
│  │  Workspace   │   │  Workflow Canvas  │   │  useWorkflowLogs    │ │
│  │  Terminal    │   │  (NodeEditor)     │   │  (WS hook)          │ │
│  │              │   │  WORKSPACE_READ   │   │                     │ │
│  │  ls / cat /  │   │  WORKSPACE_WRITE  │   │  workspace:request  │ │
│  │  mkdir / …   │   │  node config      │   │  ──────────────────►│ │
│  └──────┬───────┘   └──────────────────┘   │  workspace:response │ │
│         │                                   │  ◄──────────────────│ │
│   File System Access API                    └──────────┬──────────┘ │
│   (window.showDirectoryPicker)                         │            │
└─────────────────────────────────────────────────────────────────────┘
                  ▲  browser → writes/reads local files             │
                  │                                                  │ WS event
┌─────────────────────────────────────────────────────────────────────┐
│                    BACKEND (orchestration-service)                  │
│                                                                     │
│  WorkflowExecutorService                                            │
│    case WORKSPACE_READ  ──► sendWorkspaceRequest(read)              │
│    case WORKSPACE_WRITE ──► sendWorkspaceRequest(write)             │
│                         ◄── getWorkspaceEmitter().once(requestId)   │
│                                                                     │
│  WorkflowGateway                                                    │
│    - sendWorkspaceRequest()  emits: workspace:request               │
│    - handleWorkspaceResponse() receives: workspace:response         │
│    - forwards to promptEmitter via requestId                        │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Files Changed

### Frontend

| File                                                      | Change                                                                                               |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `src/features/workspace/store/workspaceStore.ts`          | Added `terminalHistory`, `terminalOpen` state + actions                                              |
| `src/features/workspace/hooks/useWorkspace.ts`            | Added `executeTerminalCommand`, `refreshTree`, exported `readFileAtPath` / `writeFileAtPath` helpers |
| `src/features/workspace/components/WorkspaceTerminal.tsx` | **New** — terminal UI with command history, colorized output                                         |
| `src/features/workspace/components/LocalWorkspace.tsx`    | Added terminal panel (resizable, toggled by button) + Refresh button                                 |
| `src/features/workflows/components/nodeTypes.ts`          | Added `WORKSPACE_READ` and `WORKSPACE_WRITE` node type entries                                       |
| `src/features/workflows/api/workflows.api.ts`             | Added `WORKSPACE_READ` / `WORKSPACE_WRITE` to `AddNodePayload` union                                 |
| `src/features/workflows/components/NodeEditor.tsx`        | Added `WorkspaceReadConfig` + `WorkspaceWriteConfig` inline components                               |
| `src/features/workflows/hooks/useWorkflowLogs.ts`         | Added `workspace:request` WebSocket listener — the FS bridge                                         |
| `src/locales/en/common.ts`                                | Added workspace terminal translations (EN)                                                           |
| `src/locales/fr/common.ts`                                | Added workspace terminal translations (FR)                                                           |
| `src/locales/en/workflows.ts`                             | Added workspace node editor translations (EN)                                                        |
| `src/locales/fr/workflows.ts`                             | Added workspace node editor translations (FR)                                                        |

### Backend

| File                                                                    | Change                                                                               |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `services/orchestration-service/src/domain/entities/workflow.entity.ts` | Added `WORKSPACE_READ`, `WORKSPACE_WRITE` to `NodeType` enum                         |
| `services/orchestration-service/.../workflow-executor.service.ts`       | Added `case WORKSPACE_READ` and `case WORKSPACE_WRITE` in `executeNodeByType`        |
| `services/orchestration-service/.../workflow.gateway.ts`                | Added `sendWorkspaceRequest()`, `handleWorkspaceResponse()`, `getWorkspaceEmitter()` |
| `packages/database/src/seed/seed-tools.ts`                              | Added `workspace_read` and `workspace_write` built-in tools                          |
| `Makefile`                                                              | Added `seed-workspace-tools` target                                                  |

---

## Terminal Commands Reference

| Command                  | Description                              |
| ------------------------ | ---------------------------------------- |
| `pwd`                    | Print workspace root name                |
| `ls [path]`              | List files and folders. Defaults to root |
| `cat <path>`             | Read and print file contents             |
| `mkdir <path>`           | Create directory (recursive)             |
| `echo "text" > <path>`   | Write text to a file                     |
| `write <path> <content>` | Write content to a file                  |
| `clear`                  | Clear terminal output                    |
| `help`                   | Show all available commands              |

---

## Workflow Nodes

### `WORKSPACE_READ`

Reads a file from the open local workspace.

**Config:**

- `filePath`: Relative path from workspace root (e.g. `src/index.ts`)

**Output:**

```json
{ "content": "...", "path": "src/index.ts" }
```

### `WORKSPACE_WRITE`

Writes content to a file in the open local workspace.

**Config:**

- `filePath`: Destination path (e.g. `output/result.json`)
- `content`: Template string, supports `{{variable}}` interpolation from previous node output. Leave empty to pipe the full previous node JSON output.

**Output:**

```json
{ "written": true, "path": "output/result.json" }
```

---

## Environment

No new environment variables required. The feature relies entirely on:

- **Browser**: `window.showDirectoryPicker` (File System Access API — requires HTTPS or localhost, Chrome/Edge 86+)
- **Backend**: Existing WebSocket gateway on `orchestration-service`

---

## Setup

```bash
# Seed workspace tools into the database
make seed-workspace-tools

# Or directly
cd packages/database && pnpm ts-node src/seed/seed-tools.ts
```

---

## Security

- All local FS operations require explicit user permission via the browser's File System Access API picker dialog.
- The browser-side FS bridge only activates when:
  1. A workspace is open (user selected it manually)
  2. A workflow node requests a specific known file path via `workspace:request`
- No server-side code ever touches the local file system directly.

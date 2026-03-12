'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useWorkflowExecutionStore, NodeStatus, SubExecutionRecord } from '../store/workflowExecution.store';
import { useWorkspaceStore } from '@/features/workspace/store/workspaceStore';
import { readFileAtPath, writeFileAtPath } from '@/features/workspace/hooks/useWorkspace';

export type NodeUpdateEvent = {
  executionId: string;
  nodeId: string;
  nodeName?: string;
  status: string;
  /** data.logs contains captured console.* lines from the sandbox */
  data?: unknown;
  timestamp: string;
};

export type ExecutionUpdateEvent = {
  executionId: string;
  workflowId: string;
  status: string;
  currentNodeId?: string;
  currentNodeName?: string;
  nodeExecutions: unknown[];
  output?: unknown;
  error?: string;
  timestamp: string;
};

export type ExecutionLogLine = {
  type: 'node_update' | 'execution_update' | 'error' | 'connected' | 'subscribed';
  timestamp: string;
  message: string;
  data?: Record<string, unknown> | string | number | boolean | null;
};

interface UseWorkflowLogsOptions {
  executionId: string | null;
  /** Orchestration service websocket URL (defaults to env or localhost:3002) */
  wsUrl?: string;
}

export function useWorkflowLogs({ executionId, wsUrl }: UseWorkflowLogsOptions) {
  const socketRef = useRef<Socket | null>(null);
  const [logs, setLogs] = useState<ExecutionLogLine[]>([]);
  const [connected, setConnected] = useState(false);

  const setExecutionStatus = useWorkflowExecutionStore((s) => s.setExecutionStatus);
  const executionStatus = useWorkflowExecutionStore((s) => s.executionStatus);
  const setNodeStatus = useWorkflowExecutionStore((s) => s.setNodeStatus);
  const setNodeData = useWorkflowExecutionStore((s) => s.setNodeData);
  const clearExecution = useWorkflowExecutionStore((s) => s.clearExecution);
  const getWorkspaceById = useWorkspaceStore((s) => s.getWorkspaceById);
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const addWorkspaceEntry = useWorkspaceStore((s) => s.addTerminalEntry);
  const upsertSubExecution = useWorkflowExecutionStore((s) => s.upsertSubExecution);

  const addLog = useCallback((log: ExecutionLogLine) => {
    setLogs((prev) => [...prev, log]);
  }, []);

  const clearLogs = useCallback(() => {
    setLogs([]);
    clearExecution();
  }, [clearExecution]);

  useEffect(() => {
    if (!executionId) return;

    const url = wsUrl || process.env.NEXT_PUBLIC_ORCHESTRATION_WS_URL || 'http://localhost:3003';

    const socket = io(`${url}/workflows`, {
      path: '/socket.io',
      transports: ['websocket'],
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      addLog({
        type: 'connected',
        timestamp: new Date().toISOString(),
        message: `🔌 Connected to execution stream`,
      });

      // Join the execution room
      socket.emit('join', { executionId });
      // Also subscribe for legacy support
      socket.emit('subscribe', { executionId });
    });

    socket.on('disconnect', () => {
      setConnected(false);
      addLog({
        type: 'connected',
        timestamp: new Date().toISOString(),
        message: '🔌 Disconnected from execution stream',
      });
    });

    socket.on('joined', ({ executionId: eid }: { executionId: string }) => {
      addLog({
        type: 'subscribed',
        timestamp: new Date().toISOString(),
        message: `📡 Subscribed to execution ${eid}`,
      });
    });

    socket.on('node:update', (event: NodeUpdateEvent) => {
      setNodeStatus(event.nodeId, event.status as NodeStatus);
      if (event.data !== undefined) {
        setNodeData(event.nodeId, event.data);
      }
      const emoji =
        event.status === 'COMPLETED'
          ? '✅'
          : event.status === 'FAILED'
            ? '❌'
            : event.status === 'WAITING_INPUT'
              ? '💬'
              : event.status === 'RUNNING'
                ? '⚙️'
                : '⏳';
      addLog({
        type: 'node_update',
        timestamp: event.timestamp,
        message: `${emoji} Node ${event.nodeName ? `${event.nodeName} ` : ''}[${event.nodeId}] → ${event.status}`,
        data: event.data as ExecutionLogLine['data'],
      });

      // Append captured console.log lines from the node sandbox
      // NOTE: logs is inside event.data (emitted as { input, output, logs })
      const consoleLogs = (event.data as Record<string, unknown> | undefined)?.logs as
        | string[]
        | undefined;

      console.log('consoleLogs :>> ', consoleLogs);

      if (consoleLogs && consoleLogs.length > 0) {
        consoleLogs.forEach((line) => {
          const isError = line.startsWith('[ERROR]');
          const isWarn = line.startsWith('[WARN]');
          addLog({
            type: 'node_update',
            timestamp: event.timestamp,
            message: `${isError ? '🔴' : isWarn ? '🟡' : '⬜'} console › ${line}`,
          });
        });
      }

      // ── Detect sub-workflow child executions from SUBWORKFLOW node output ────
      // The backend returns { _subExecutionId, _subWorkflowId, _subWorkflowName }
      // in the node output when a SUBWORKFLOW node completes.
      const outputData = (event.data as Record<string, unknown> | undefined)?.output as
        | Record<string, unknown>
        | undefined;
      const subExecId = outputData?._subExecutionId as string | undefined;
      const subWfId = outputData?._subWorkflowId as string | undefined;
      const subWfName = outputData?._subWorkflowName as string | undefined;

      if (subExecId && subWfId) {
        const rec: SubExecutionRecord = {
          subExecutionId: subExecId,
          subWorkflowId: subWfId,
          subWorkflowName: subWfName ?? subWfId,
          parentNodeId: event.nodeId,
          parentNodeName: event.nodeName,
          discoveredAt: event.timestamp,
          status: 'COMPLETED',
        };
        upsertSubExecution(rec);
        addLog({
          type: 'node_update',
          timestamp: event.timestamp,
          message: `🔀 Sub-workflow "${rec.subWorkflowName}" completed → child exec: ${subExecId}`,
          data: { subExecutionId: subExecId, subWorkflowId: subWfId },
        });
      }
    });

    socket.on('execution:update', (event: ExecutionUpdateEvent) => {
      setExecutionStatus(event.status);
      const emoji =
        event.status === 'COMPLETED'
          ? '🎉'
          : event.status === 'FAILED'
            ? '💥'
            : event.status === 'RUNNING'
              ? '🚀'
              : event.status === 'CANCELLED'
                ? '🛑'
                : '⏳';
      addLog({
        type: 'execution_update',
        timestamp: event.timestamp,
        message: `${emoji} Execution → ${event.status}${
          event.currentNodeId
            ? ` (current: ${event.currentNodeName ? `${event.currentNodeName} ` : ''}[${event.currentNodeId}])`
            : ''
        }`,
        data: (event.output ?? event.error) as ExecutionLogLine['data'],
      });
    });

    socket.on(
      'execution:error',
      ({ error, timestamp }: { executionId: string; error: string; timestamp: string }) => {
        addLog({
          type: 'error',
          timestamp,
          message: `💥 Error: ${error}`,
        });
      },
    );

    // ── Workspace FS bridge (multi-workspace aware) ──────────────────────────
    socket.on(
      'workspace:request',
      async (event: {
        executionId: string;
        requestId: string;
        operation: 'read' | 'write';
        payload: Record<string, unknown>;
      }) => {
        const { requestId, operation, payload } = event;
        addLog({
          type: 'node_update',
          timestamp: new Date().toISOString(),
          message: `📂 Workspace ${operation} → ${payload.filePath}${
            payload.workspaceId ? ` (ws: ${payload.workspaceId})` : ''
          }`,
        });

        // Resolve target workspace: prefer the one configured on the node
        const targetWs = payload.workspaceId
          ? getWorkspaceById(payload.workspaceId as string)
          : (workspaces[0] ?? null);

        if (!targetWs) {
          socket.emit('workspace:response', {
            executionId,
            requestId,
            error: 'No workspace open in browser. Open a folder from the header menu first.',
          });
          addWorkspaceEntry({
            type: 'error',
            text: `[Workflow] No workspace available for ${operation}: ${payload.filePath}`,
          });
          return;
        }

        try {
          if (operation === 'read') {
            const content = await readFileAtPath(targetWs.rootHandle, payload.filePath as string);
            addWorkspaceEntry({
              type: 'info',
              text: `[Workflow] Read: ${payload.filePath} from "${targetWs.name}" (${content.length} chars)`,
            });
            socket.emit('workspace:response', {
              executionId,
              requestId,
              result: { content, path: payload.filePath, workspaceName: targetWs.name },
            });
          } else if (operation === 'write') {
            await writeFileAtPath(
              targetWs.rootHandle,
              payload.filePath as string,
              (payload.content as string) ?? '',
            );
            addWorkspaceEntry({
              type: 'info',
              text: `[Workflow] Written: ${payload.filePath} → "${targetWs.name}"`,
            });
            socket.emit('workspace:response', {
              executionId,
              requestId,
              result: { written: true, path: payload.filePath, workspaceName: targetWs.name },
            });
          }
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          addWorkspaceEntry({
            type: 'error',
            text: `[Workflow] FS error on "${targetWs.name}": ${msg}`,
          });
          socket.emit('workspace:response', { executionId, requestId, error: msg });
        }
      },
    );

    return () => {
      socket.emit('leave', { executionId });
      socket.disconnect();
      socketRef.current = null;
      setConnected(false);
    };
  }, [
    executionId,
    wsUrl,
    addLog,
    setNodeStatus,
    setExecutionStatus,
    setNodeData,
    workspaces,
    getWorkspaceById,
    addWorkspaceEntry,
    upsertSubExecution,
  ]);

  return { logs, connected, executionStatus, clearLogs };
}

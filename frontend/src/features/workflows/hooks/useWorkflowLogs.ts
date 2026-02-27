'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useWorkflowExecutionStore, NodeStatus } from '../store/workflowExecution.store';

export type NodeUpdateEvent = {
  executionId: string;
  nodeId: string;
  nodeName?: string;
  status: string;
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
  const clearExecution = useWorkflowExecutionStore((s) => s.clearExecution);

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
    console.log('url :>>>>>>>>>>>>>>>>>>>>>>>>><> ', url);

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
      console.log('event :>>>>>>>>>>>>>>>>>>>>>>>>><> ', event);

      setNodeStatus(event.nodeId, event.status as NodeStatus);
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
    });

    socket.on('execution:update', (event: ExecutionUpdateEvent) => {
      console.log('event :>>>>>>>>>>>>>>>>>>>>>>>>>>>><> ', event);

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

    return () => {
      socket.emit('leave', { executionId });
      socket.disconnect();
      socketRef.current = null;
      setConnected(false);
    };
  }, [executionId, wsUrl, addLog, setNodeStatus, setExecutionStatus]);

  return { logs, connected, executionStatus, clearLogs };
}

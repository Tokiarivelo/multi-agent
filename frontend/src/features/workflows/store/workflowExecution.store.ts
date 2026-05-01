import { create } from 'zustand';

export type NodeStatus =
  | 'PENDING'
  | 'RUNNING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED'
  | 'WAITING_INPUT';

/** Lightweight record of a child (sub-workflow) execution discovered at runtime */
export interface SubExecutionRecord {
  subExecutionId: string;
  subWorkflowId: string;
  subWorkflowName: string;
  /** ID of the SUBWORKFLOW node in the *parent* workflow that launched this */
  parentNodeId: string;
  parentNodeName?: string;
  /** ISO timestamp when it was first detected */
  discoveredAt: string;
  /** Last known status, updated when child execution:update events arrive */
  status: string;
}

export interface NodeTokenProgress {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  model: string;
  iteration: number;
}

export interface ToolCall {
  name: string;
  args: Record<string, unknown>;
}

export interface NodeThinking {
  step: string;
  thought?: string;
  plan?: string[];
  toolCalls?: ToolCall[];
  timestamp: string;
}

/** One snapshot captured from a single node:update WS event */
export interface NodeTurn {
  status: NodeStatus | string;
  /** ISO timestamp from the WS event */
  timestamp: string;
  /** Raw event data payload (input, output, prompt, agentMessage, userResponse, etc.) */
  data: unknown;
}

interface WorkflowExecutionState {
  activeExecutionId: string | null;
  executionStatus: string | null;
  selectedNodeId: string | null;
  selectedNodeName: string | null;
  nodeStatuses: Record<string, NodeStatus>;
  nodeData: Record<string, unknown>;
  /** Ordered list of every WS event received for each node this execution */
  nodeTurns: Record<string, NodeTurn[]>;
  /** Live token counts pushed during RUNNING state, keyed by nodeId */
  nodeTokenProgress: Record<string, NodeTokenProgress>;
  /** Live thinking/planning steps pushed during RUNNING state, keyed by nodeId */
  nodeThinking: Record<string, NodeThinking[]>;

  /** Child (sub-workflow) executions discovered during the active run */
  subExecutions: SubExecutionRecord[];

  setActiveExecutionId: (id: string | null) => void;
  setSelectedNodeId: (id: string | null) => void;
  setSelectedNodeName: (name: string | null) => void;
  setExecutionStatus: (status: string | null) => void;
  setNodeStatus: (nodeId: string, status: NodeStatus) => void;
  setNodeData: (nodeId: string, data: unknown) => void;
  appendNodeTurn: (nodeId: string, turn: NodeTurn) => void;
  setNodeTokenProgress: (nodeId: string, progress: NodeTokenProgress) => void;
  appendNodeThinking: (nodeId: string, thinking: NodeThinking) => void;
  clearExecution: () => void;

  /** Register a discovered sub-workflow execution (idempotent) */
  upsertSubExecution: (rec: SubExecutionRecord) => void;
  /** Update the status of a known sub-execution */
  updateSubExecutionStatus: (subExecutionId: string, status: string) => void;
}

export const useWorkflowExecutionStore = create<WorkflowExecutionState>((set) => ({
  activeExecutionId: null,
  executionStatus: null,
  selectedNodeId: null,
  selectedNodeName: null,
  nodeStatuses: {},
  nodeData: {},
  nodeTurns: {},
  nodeTokenProgress: {},
  nodeThinking: {},
  subExecutions: [],

  setActiveExecutionId: (id) => set({ activeExecutionId: id }),
  setSelectedNodeId: (id) => set({ selectedNodeId: id }),
  setSelectedNodeName: (name) => set({ selectedNodeName: name }),
  setExecutionStatus: (status) => set({ executionStatus: status }),
  setNodeStatus: (nodeId, status) =>
    set((state) => ({ nodeStatuses: { ...state.nodeStatuses, [nodeId]: status } })),
  setNodeData: (nodeId, data) =>
    set((state) => ({ nodeData: { ...state.nodeData, [nodeId]: data } })),
  appendNodeTurn: (nodeId, turn) =>
    set((state) => ({
      nodeTurns: {
        ...state.nodeTurns,
        [nodeId]: [...(state.nodeTurns[nodeId] ?? []), turn],
      },
    })),
  setNodeTokenProgress: (nodeId, progress) =>
    set((state) => ({ nodeTokenProgress: { ...state.nodeTokenProgress, [nodeId]: progress } })),
  appendNodeThinking: (nodeId, thinking) =>
    set((state) => ({
      nodeThinking: {
        ...state.nodeThinking,
        [nodeId]: [...(state.nodeThinking[nodeId] ?? []), thinking],
      },
    })),
  clearExecution: () =>
    set({
      activeExecutionId: null,
      executionStatus: null,
      nodeStatuses: {},
      nodeData: {},
      nodeTurns: {},
      nodeTokenProgress: {},
      nodeThinking: {},
      selectedNodeId: null,
      selectedNodeName: null,
      subExecutions: [],
    }),

  upsertSubExecution: (rec) =>
    set((state) => {
      const exists = state.subExecutions.some(
        (s) => s.subExecutionId === rec.subExecutionId,
      );
      if (exists) return state;
      return { subExecutions: [...state.subExecutions, rec] };
    }),

  updateSubExecutionStatus: (subExecutionId, status) =>
    set((state) => ({
      subExecutions: state.subExecutions.map((s) =>
        s.subExecutionId === subExecutionId ? { ...s, status } : s,
      ),
    })),
}));

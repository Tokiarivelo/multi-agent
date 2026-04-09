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

interface WorkflowExecutionState {
  activeExecutionId: string | null;
  executionStatus: string | null;
  selectedNodeId: string | null;
  selectedNodeName: string | null;
  nodeStatuses: Record<string, NodeStatus>;
  nodeData: Record<string, unknown>;
  /** Live token counts pushed during RUNNING state, keyed by nodeId */
  nodeTokenProgress: Record<string, NodeTokenProgress>;

  /** Child (sub-workflow) executions discovered during the active run */
  subExecutions: SubExecutionRecord[];

  setActiveExecutionId: (id: string | null) => void;
  setSelectedNodeId: (id: string | null) => void;
  setSelectedNodeName: (name: string | null) => void;
  setExecutionStatus: (status: string | null) => void;
  setNodeStatus: (nodeId: string, status: NodeStatus) => void;
  setNodeData: (nodeId: string, data: unknown) => void;
  setNodeTokenProgress: (nodeId: string, progress: NodeTokenProgress) => void;
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
  nodeTokenProgress: {},
  subExecutions: [],

  setActiveExecutionId: (id) => set({ activeExecutionId: id }),
  setSelectedNodeId: (id) => set({ selectedNodeId: id }),
  setSelectedNodeName: (name) => set({ selectedNodeName: name }),
  setExecutionStatus: (status) => set({ executionStatus: status }),
  setNodeStatus: (nodeId, status) =>
    set((state) => ({ nodeStatuses: { ...state.nodeStatuses, [nodeId]: status } })),
  setNodeData: (nodeId, data) =>
    set((state) => ({ nodeData: { ...state.nodeData, [nodeId]: data } })),
  setNodeTokenProgress: (nodeId, progress) =>
    set((state) => ({ nodeTokenProgress: { ...state.nodeTokenProgress, [nodeId]: progress } })),
  clearExecution: () =>
    set({
      activeExecutionId: null,
      executionStatus: null,
      nodeStatuses: {},
      nodeData: {},
      nodeTokenProgress: {},
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

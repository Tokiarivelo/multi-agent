import { create } from 'zustand';

export type NodeStatus =
  | 'PENDING'
  | 'RUNNING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED'
  | 'WAITING_INPUT';

interface WorkflowExecutionState {
  activeExecutionId: string | null;
  executionStatus: string | null;
  selectedNodeId: string | null;
  selectedNodeName: string | null;
  nodeStatuses: Record<string, NodeStatus>;
  nodeData: Record<string, unknown>;
  setActiveExecutionId: (id: string | null) => void;
  setSelectedNodeId: (id: string | null) => void;
  setSelectedNodeName: (name: string | null) => void;
  setExecutionStatus: (status: string | null) => void;
  setNodeStatus: (nodeId: string, status: NodeStatus) => void;
  setNodeData: (nodeId: string, data: unknown) => void;
  clearExecution: () => void;
}

export const useWorkflowExecutionStore = create<WorkflowExecutionState>((set) => ({
  activeExecutionId: null,
  executionStatus: null,
  selectedNodeId: null,
  selectedNodeName: null,
  nodeStatuses: {},
  nodeData: {},
  setActiveExecutionId: (id) => set({ activeExecutionId: id }),
  setSelectedNodeId: (id) => set({ selectedNodeId: id }),
  setSelectedNodeName: (name) => set({ selectedNodeName: name }),
  setExecutionStatus: (status) => set({ executionStatus: status }),
  setNodeStatus: (nodeId, status) =>
    set((state) => ({ nodeStatuses: { ...state.nodeStatuses, [nodeId]: status } })),
  setNodeData: (nodeId, data) =>
    set((state) => ({ nodeData: { ...state.nodeData, [nodeId]: data } })),
  clearExecution: () =>
    set({
      activeExecutionId: null,
      executionStatus: null,
      nodeStatuses: {},
      nodeData: {},
      selectedNodeId: null,
      selectedNodeName: null,
    }),
}));

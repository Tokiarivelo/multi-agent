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
  nodeStatuses: Record<string, NodeStatus>;
  setActiveExecutionId: (id: string | null) => void;
  setExecutionStatus: (status: string | null) => void;
  setNodeStatus: (nodeId: string, status: NodeStatus) => void;
  clearExecution: () => void;
}

export const useWorkflowExecutionStore = create<WorkflowExecutionState>((set) => ({
  activeExecutionId: null,
  executionStatus: null,
  nodeStatuses: {},
  setActiveExecutionId: (id) => set({ activeExecutionId: id }),
  setExecutionStatus: (status) => set({ executionStatus: status }),
  setNodeStatus: (nodeId, status) =>
    set((state) => ({ nodeStatuses: { ...state.nodeStatuses, [nodeId]: status } })),
  clearExecution: () => set({ activeExecutionId: null, executionStatus: null, nodeStatuses: {} }),
}));

import { create } from "zustand";
import { Workflow, WorkflowNode, WorkflowEdge } from "@/types";

interface WorkflowState {
  currentWorkflow: Workflow | null;
  selectedNode: WorkflowNode | null;
  setCurrentWorkflow: (workflow: Workflow | null) => void;
  setSelectedNode: (node: WorkflowNode | null) => void;
  updateNode: (nodeId: string, updates: Partial<WorkflowNode>) => void;
  addNode: (node: WorkflowNode) => void;
  removeNode: (nodeId: string) => void;
  addEdge: (edge: WorkflowEdge) => void;
  removeEdge: (edgeId: string) => void;
}

export const useWorkflowStore = create<WorkflowState>((set) => ({
  currentWorkflow: null,
  selectedNode: null,
  setCurrentWorkflow: (workflow) => set({ currentWorkflow: workflow }),
  setSelectedNode: (node) => set({ selectedNode: node }),
  updateNode: (nodeId, updates) =>
    set((state) => {
      if (!state.currentWorkflow) return state;
      return {
        currentWorkflow: {
          ...state.currentWorkflow,
          nodes: state.currentWorkflow.nodes.map((node) =>
            node.id === nodeId ? { ...node, ...updates } : node
          ),
        },
      };
    }),
  addNode: (node) =>
    set((state) => {
      if (!state.currentWorkflow) return state;
      return {
        currentWorkflow: {
          ...state.currentWorkflow,
          nodes: [...state.currentWorkflow.nodes, node],
        },
      };
    }),
  removeNode: (nodeId) =>
    set((state) => {
      if (!state.currentWorkflow) return state;
      return {
        currentWorkflow: {
          ...state.currentWorkflow,
          nodes: state.currentWorkflow.nodes.filter(
            (node) => node.id !== nodeId
          ),
          edges: state.currentWorkflow.edges.filter(
            (edge) => edge.source !== nodeId && edge.target !== nodeId
          ),
        },
      };
    }),
  addEdge: (edge) =>
    set((state) => {
      if (!state.currentWorkflow) return state;
      return {
        currentWorkflow: {
          ...state.currentWorkflow,
          edges: [...state.currentWorkflow.edges, edge],
        },
      };
    }),
  removeEdge: (edgeId) =>
    set((state) => {
      if (!state.currentWorkflow) return state;
      return {
        currentWorkflow: {
          ...state.currentWorkflow,
          edges: state.currentWorkflow.edges.filter(
            (edge) => edge.id !== edgeId
          ),
        },
      };
    }),
}));

import { create } from "zustand";
import { Execution } from "@/types";

interface ExecutionState {
  currentExecution: Execution | null;
  streamingTokens: Map<string, string>;
  setCurrentExecution: (execution: Execution | null) => void;
  appendToken: (executionId: string, token: string) => void;
  clearTokens: (executionId: string) => void;
}

export const useExecutionStore = create<ExecutionState>((set) => ({
  currentExecution: null,
  streamingTokens: new Map(),
  setCurrentExecution: (execution) => set({ currentExecution: execution }),
  appendToken: (executionId, token) =>
    set((state) => {
      const newTokens = new Map(state.streamingTokens);
      const current = newTokens.get(executionId) || "";
      newTokens.set(executionId, current + token);
      return { streamingTokens: newTokens };
    }),
  clearTokens: (executionId) =>
    set((state) => {
      const newTokens = new Map(state.streamingTokens);
      newTokens.delete(executionId);
      return { streamingTokens: newTokens };
    }),
}));

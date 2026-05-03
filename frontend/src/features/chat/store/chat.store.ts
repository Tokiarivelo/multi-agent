import { create } from 'zustand';
import { ChatMessage, ChatThinkingStep } from '../api/chat.api';

export interface WorkflowChoice {
  nodeId: string;
  prompt: string;
  choices: string[];
  multiSelect: boolean;
  agentMessage?: string;
}

export interface ToolRequestItem {
  id: string;
  name: string;
  description: string;
  category: string;
}

export interface ToolRequest {
  requestId: string;
  failedToolName: string;
  failedToolArgs: unknown;
  errorMessage: string;
  availableTools: ToolRequestItem[];
}

interface ChatState {
  activeSessionId: string | null;
  streamingContent: string;
  isStreaming: boolean;
  thinkingSteps: ChatThinkingStep[];
  workflowChoice: WorkflowChoice | null;
  toolRequest: ToolRequest | null;
  error: string | null;
  pendingMessages: ChatMessage[];

  setActiveSession: (id: string | null) => void;
  appendToken: (token: string) => void;
  setStreaming: (streaming: boolean) => void;
  addThinkingStep: (step: ChatThinkingStep) => void;
  setWorkflowChoice: (choice: WorkflowChoice | null) => void;
  setToolRequest: (request: ToolRequest | null) => void;
  addPendingMessage: (message: ChatMessage) => void;
  finalizeMessage: (message: ChatMessage) => void;
  setError: (error: string | null) => void;
  resetStream: () => void;
}

export const useChatStore = create<ChatState>((set) => ({
  activeSessionId: null,
  streamingContent: '',
  isStreaming: false,
  thinkingSteps: [],
  workflowChoice: null,
  toolRequest: null,
  error: null,
  pendingMessages: [],

  setActiveSession: (id) =>
    set({ activeSessionId: id, streamingContent: '', thinkingSteps: [], workflowChoice: null, toolRequest: null, error: null, pendingMessages: [] }),

  appendToken: (token) =>
    set((state) => ({ streamingContent: state.streamingContent + token })),

  setStreaming: (streaming) =>
    set({ isStreaming: streaming, ...(streaming ? {} : { streamingContent: '' }) }),

  addThinkingStep: (step) =>
    set((state) => ({ thinkingSteps: [...state.thinkingSteps, step] })),

  setWorkflowChoice: (choice) => set({ workflowChoice: choice }),

  setToolRequest: (request) => set({ toolRequest: request }),

  addPendingMessage: (message) =>
    set((state) => ({ pendingMessages: [...state.pendingMessages, message] })),

  finalizeMessage: (message) =>
    set((state) => ({
      pendingMessages: [...state.pendingMessages, message],
      streamingContent: '',
      thinkingSteps: [],
      workflowChoice: null,
      toolRequest: null,
    })),

  setError: (error) => set({ error }),

  resetStream: () =>
    set({ streamingContent: '', isStreaming: false, thinkingSteps: [], workflowChoice: null, toolRequest: null, error: null, pendingMessages: [] }),
}));

import { create } from 'zustand';
import { ChatMessage, ChatThinkingStep } from '../api/chat.api';

interface ChatState {
  activeSessionId: string | null;
  streamingContent: string;
  isStreaming: boolean;
  thinkingSteps: ChatThinkingStep[];
  error: string | null;
  pendingMessages: ChatMessage[];

  setActiveSession: (id: string | null) => void;
  appendToken: (token: string) => void;
  setStreaming: (streaming: boolean) => void;
  addThinkingStep: (step: ChatThinkingStep) => void;
  finalizeMessage: (message: ChatMessage) => void;
  setError: (error: string | null) => void;
  resetStream: () => void;
}

export const useChatStore = create<ChatState>((set) => ({
  activeSessionId: null,
  streamingContent: '',
  isStreaming: false,
  thinkingSteps: [],
  error: null,
  pendingMessages: [],

  setActiveSession: (id) =>
    set({ activeSessionId: id, streamingContent: '', thinkingSteps: [], error: null }),

  appendToken: (token) =>
    set((state) => ({ streamingContent: state.streamingContent + token })),

  setStreaming: (streaming) =>
    set({ isStreaming: streaming, ...(streaming ? {} : { streamingContent: '' }) }),

  addThinkingStep: (step) =>
    set((state) => ({ thinkingSteps: [...state.thinkingSteps, step] })),

  finalizeMessage: (message) =>
    set((state) => ({
      pendingMessages: [...state.pendingMessages, message],
      streamingContent: '',
      thinkingSteps: [],
    })),

  setError: (error) => set({ error }),

  resetStream: () =>
    set({ streamingContent: '', isStreaming: false, thinkingSteps: [], error: null }),
}));

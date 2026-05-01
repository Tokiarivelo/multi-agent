import { apiClient } from '@/lib/api-client';

export interface ChatSession {
  id: string;
  userId: string;
  title: string;
  modelId?: string;
  agentId?: string;
  workflowId?: string;
  tools: string[];
  systemPrompt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  attachments?: ChatAttachment[];
  toolCalls?: ChatToolCall[];
  thinkingSteps?: ChatThinkingStep[];
  tokens?: number;
  createdAt: string;
}

export interface ChatAttachment {
  fileId: string;
  name: string;
  mimeType: string;
  url?: string;
}

export interface ChatToolCall {
  id: string;
  name: string;
  args: unknown;
  result?: string;
  error?: boolean;
}

export interface ChatThinkingStep {
  step: string;
  thought?: string;
  toolName?: string;
  toolInput?: unknown;
  toolResult?: string;
}

export interface CreateSessionInput {
  title?: string;
  modelId?: string;
  agentId?: string;
  workflowId?: string;
  tools?: string[];
  systemPrompt?: string;
}

export const chatApi = {
  listSessions: async (): Promise<ChatSession[]> => {
    const { data } = await apiClient.get<ChatSession[]>('/api/chat/sessions');
    return data;
  },

  createSession: async (input: CreateSessionInput): Promise<ChatSession> => {
    const { data } = await apiClient.post<ChatSession>('/api/chat/sessions', input);
    return data;
  },

  getSession: async (id: string): Promise<ChatSession> => {
    const { data } = await apiClient.get<ChatSession>(`/api/chat/sessions/${id}`);
    return data;
  },

  updateSession: async (id: string, input: Partial<CreateSessionInput>): Promise<ChatSession> => {
    const { data } = await apiClient.patch<ChatSession>(`/api/chat/sessions/${id}`, input);
    return data;
  },

  deleteSession: async (id: string): Promise<void> => {
    await apiClient.delete(`/api/chat/sessions/${id}`);
  },

  getMessages: async (sessionId: string): Promise<ChatMessage[]> => {
    const { data } = await apiClient.get<ChatMessage[]>(`/api/chat/sessions/${sessionId}/messages`);
    return data;
  },
};

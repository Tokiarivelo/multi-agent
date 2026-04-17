import { apiClient } from '@/lib/api-client';
import { Agent, AgentCreateInput, PaginatedResponse } from '@/types';

export interface GeneratedAgentConfig {
  name: string;
  description: string;
  systemPrompt: string;
  temperature: number;
  maxTokens: number;
  tools: string[];
  metadata: Record<string, unknown>;
}

export interface ProvisionedTool {
  name: string;
  id: string;
  created: boolean; // true = auto-created by AI, false = matched existing
}

export interface AgentAiResult {
  sessionId: string;
  message: string;
  config?: GeneratedAgentConfig;
  provisionedTools?: ProvisionedTool[];
  history: Array<{ role: string; content: string; timestamp: string }>;
}

export const agentsApi = {
  getAll: async (page = 1, pageSize = 20): Promise<PaginatedResponse<Agent>> => {
    const { data } = await apiClient.get<PaginatedResponse<Agent>>(
      `/api/agents?page=${page}&pageSize=${pageSize}`,
    );
    return data;
  },

  getById: async (id: string): Promise<Agent> => {
    const { data } = await apiClient.get<Agent>(`/api/agents/${id}`);
    return data;
  },

  create: async (agent: AgentCreateInput): Promise<Agent> => {
    const { data } = await apiClient.post<Agent>('/api/agents', agent);
    return data;
  },

  update: async (id: string, agent: Partial<AgentCreateInput>): Promise<Agent> => {
    const { data } = await apiClient.put<Agent>(`/api/agents/${id}`, agent);
    return data;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/api/agents/${id}`);
  },

  generateWithAi: async (payload: {
    prompt: string;
    modelId: string;
    sessionId?: string;
  }): Promise<AgentAiResult> => {
    const { data } = await apiClient.post<AgentAiResult>('/api/agents/ai/generate', payload);
    return data;
  },
};

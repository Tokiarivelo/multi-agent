import { apiClient } from '@/lib/api-client';
import { Tool, PaginatedResponse, ToolExecutionResult } from '@/types';

export interface GeneratedToolConfig {
  name: string;
  description: string;
  category: 'WEB' | 'API' | 'DATABASE' | 'FILE' | 'CUSTOM' | 'MCP';
  parameters: Array<{
    name: string;
    type: 'string' | 'number' | 'boolean' | 'object' | 'array';
    description: string;
    required: boolean;
    default?: unknown;
  }>;
  code: string;
  icon: string;
}

export interface ToolAiResult {
  sessionId: string;
  message: string;
  config?: GeneratedToolConfig;
  history: Array<{ role: string; content: string; timestamp: string }>;
}

export const toolsApi = {
  getAll: async (page = 1, pageSize = 20): Promise<PaginatedResponse<Tool>> => {
    const { data } = await apiClient.get<PaginatedResponse<Tool>>(
      `/api/tools?page=${page}&pageSize=${pageSize}`,
    );
    return data;
  },

  getById: async (id: string): Promise<Tool> => {
    const { data } = await apiClient.get<Tool>(`/api/tools/${id}`);
    return data;
  },

  create: async (payload: Partial<Tool>): Promise<Tool> => {
    const { data } = await apiClient.post<Tool>(`/api/tools`, payload);
    return data;
  },

  update: async (id: string, payload: Partial<Tool>): Promise<Tool> => {
    const { data } = await apiClient.put<Tool>(`/api/tools/${id}`, payload);
    return data;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/api/tools/${id}`);
  },

  generateWithAi: async (payload: {
    prompt: string;
    modelId: string;
    sessionId?: string;
  }): Promise<ToolAiResult> => {
    const { data } = await apiClient.post<ToolAiResult>('/api/tools/ai/generate', payload);
    return data;
  },

  execute: async (
    toolId: string,
    parameters: Record<string, unknown>,
    cwd?: string,
    timeout?: number,
  ): Promise<ToolExecutionResult> => {
    const { data } = await apiClient.post<ToolExecutionResult>(`/api/tools/execute`, {
      toolId,
      parameters,
      ...(cwd !== undefined && { cwd }),
      ...(timeout !== undefined && { timeout }),
    });
    return data;
  },
};

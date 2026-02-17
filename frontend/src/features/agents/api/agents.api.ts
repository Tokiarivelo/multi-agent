import { apiClient } from "@/lib/api-client";
import { Agent, AgentCreateInput, ApiResponse, PaginatedResponse } from "@/types";

export const agentsApi = {
  getAll: async (page = 1, pageSize = 20): Promise<PaginatedResponse<Agent>> => {
    const { data } = await apiClient.get<PaginatedResponse<Agent>>(
      `/api/agents?page=${page}&pageSize=${pageSize}`
    );
    return data;
  },

  getById: async (id: string): Promise<Agent> => {
    const { data } = await apiClient.get<ApiResponse<Agent>>(
      `/api/agents/${id}`
    );
    return data.data;
  },

  create: async (agent: AgentCreateInput): Promise<Agent> => {
    const { data } = await apiClient.post<ApiResponse<Agent>>(
      "/api/agents",
      agent
    );
    return data.data;
  },

  update: async (id: string, agent: Partial<AgentCreateInput>): Promise<Agent> => {
    const { data } = await apiClient.put<ApiResponse<Agent>>(
      `/api/agents/${id}`,
      agent
    );
    return data.data;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/api/agents/${id}`);
  },
};

import { apiClient } from "@/lib/api-client";
import { Workflow, ApiResponse, PaginatedResponse } from "@/types";

export const workflowsApi = {
  getAll: async (page = 1, pageSize = 20): Promise<PaginatedResponse<Workflow>> => {
    const { data } = await apiClient.get<PaginatedResponse<Workflow>>(
      `/api/workflows?page=${page}&pageSize=${pageSize}`
    );
    return data;
  },

  getById: async (id: string): Promise<Workflow> => {
    const { data } = await apiClient.get<ApiResponse<Workflow>>(
      `/api/workflows/${id}`
    );
    return data.data;
  },

  create: async (workflow: Partial<Workflow>): Promise<Workflow> => {
    const { data } = await apiClient.post<ApiResponse<Workflow>>(
      "/api/workflows",
      workflow
    );
    return data.data;
  },

  update: async (id: string, workflow: Partial<Workflow>): Promise<Workflow> => {
    const { data } = await apiClient.put<ApiResponse<Workflow>>(
      `/api/workflows/${id}`,
      workflow
    );
    return data.data;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/api/workflows/${id}`);
  },

  execute: async (id: string, input?: Record<string, unknown>): Promise<{ executionId: string }> => {
    const { data } = await apiClient.post<ApiResponse<{ executionId: string }>>(
      `/api/workflows/${id}/execute`,
      { input }
    );
    return data.data;
  },
};

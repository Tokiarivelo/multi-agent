import { apiClient } from '@/lib/api-client';
import { Execution, ExecutionLog, ApiResponse, PaginatedResponse } from '@/types';

export const executionsApi = {
  getAll: async (page = 1, pageSize = 20): Promise<PaginatedResponse<Execution>> => {
    const { data } = await apiClient.get<PaginatedResponse<Execution>>(
      `/api/executions?page=${page}&pageSize=${pageSize}`,
    );
    return data;
  },

  getById: async (id: string): Promise<Execution> => {
    const { data } = await apiClient.get<ApiResponse<Execution>>(`/api/executions/${id}`);
    return data.data;
  },

  getLogs: async (
    id: string,
    page = 1,
    pageSize = 100,
  ): Promise<PaginatedResponse<ExecutionLog>> => {
    const { data } = await apiClient.get<PaginatedResponse<ExecutionLog>>(
      `/api/executions/${id}/logs?page=${page}&pageSize=${pageSize}`,
    );
    return data;
  },

  retry: async (id: string): Promise<{ executionId: string }> => {
    const { data } = await apiClient.post<ApiResponse<{ executionId: string }>>(
      `/api/executions/${id}/retry`,
    );
    return data.data;
  },

  cancel: async (id: string): Promise<void> => {
    await apiClient.post(`/api/executions/${id}/cancel`);
  },
};

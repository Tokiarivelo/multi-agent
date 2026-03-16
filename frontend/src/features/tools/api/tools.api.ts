import { apiClient } from '@/lib/api-client';
import { Tool, PaginatedResponse } from '@/types';

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
};

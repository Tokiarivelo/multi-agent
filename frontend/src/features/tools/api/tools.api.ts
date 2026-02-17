import { apiClient } from "@/lib/api-client";
import { Tool, ApiResponse, PaginatedResponse } from "@/types";

export const toolsApi = {
  getAll: async (page = 1, pageSize = 20): Promise<PaginatedResponse<Tool>> => {
    const { data } = await apiClient.get<PaginatedResponse<Tool>>(
      `/api/tools?page=${page}&pageSize=${pageSize}`
    );
    return data;
  },

  getById: async (id: string): Promise<Tool> => {
    const { data } = await apiClient.get<ApiResponse<Tool>>(
      `/api/tools/${id}`
    );
    return data.data;
  },
};

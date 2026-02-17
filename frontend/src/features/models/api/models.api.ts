import { apiClient } from "@/lib/api-client";
import { Model, ApiResponse, PaginatedResponse } from "@/types";

export const modelsApi = {
  getAll: async (page = 1, pageSize = 20): Promise<PaginatedResponse<Model>> => {
    const { data } = await apiClient.get<PaginatedResponse<Model>>(
      `/api/models?page=${page}&pageSize=${pageSize}`
    );
    return data;
  },

  getById: async (id: string): Promise<Model> => {
    const { data } = await apiClient.get<ApiResponse<Model>>(
      `/api/models/${id}`
    );
    return data.data;
  },
};

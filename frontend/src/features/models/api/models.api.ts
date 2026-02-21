import { apiClient } from '@/lib/api-client';
import {
  Model,
  ApiResponse,
  PaginatedResponse,
  CreateModelInput,
  ApiKey,
  CreateApiKeyInput,
} from '@/types';

export const modelsApi = {
  getAll: async (page = 1, pageSize = 20): Promise<PaginatedResponse<Model>> => {
    const { data } = await apiClient.get<PaginatedResponse<Model>>(
      `/api/models?page=${page}&pageSize=${pageSize}`,
    );
    return data;
  },

  getById: async (id: string): Promise<Model> => {
    const { data } = await apiClient.get<ApiResponse<Model>>(`/api/models/${id}`);
    return data.data;
  },

  create: async (modelData: CreateModelInput): Promise<Model> => {
    const { data } = await apiClient.post<ApiResponse<Model>>(`/api/models`, modelData);
    return data.data;
  },

  // API Keys
  getApiKeys: async (userId: string): Promise<PaginatedResponse<ApiKey>> => {
    const { data } = await apiClient.get<PaginatedResponse<ApiKey>>(
      `/api/api-keys?userId=${userId}`,
    );
    return data;
  },

  createApiKey: async (apiKeyData: CreateApiKeyInput): Promise<ApiKey> => {
    const { data } = await apiClient.post<ApiResponse<ApiKey>>(`/api/api-keys`, apiKeyData);
    return data.data;
  },

  deleteApiKey: async (id: string): Promise<void> => {
    await apiClient.delete(`/api/api-keys/${id}`);
  },
};

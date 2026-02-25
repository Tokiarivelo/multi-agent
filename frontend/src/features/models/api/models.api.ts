import { apiClient } from '@/lib/api-client';
import {
  Model,
  ApiResponse,
  PaginatedResponse,
  CreateModelInput,
  ApiKey,
  CreateApiKeyInput,
  ProviderModel,
} from '@/types';

export const modelsApi = {
  getAll: async (page = 1, pageSize = 20): Promise<PaginatedResponse<Model>> => {
    const { data } = await apiClient.get<PaginatedResponse<Model>>(
      `/api/models?page=${page}&pageSize=${pageSize}`,
    );
    return data;
  },

  getById: async (id: string): Promise<Model> => {
    const { data } = await apiClient.get<Model>(`/api/models/${id}`);
    return data;
  },

  create: async (modelData: CreateModelInput): Promise<Model> => {
    const { data } = await apiClient.post<Model>(`/api/models`, modelData);
    return data;
  },

  // Provider Models
  fetchProviderModels: async (provider: string): Promise<ProviderModel[]> => {
    const { data } = await apiClient.get<ProviderModel[]>(
      `/api/models/providers/${provider}/available-models`,
    );
    return data;
  },

  // API Keys
  getApiKeys: async (userId: string): Promise<PaginatedResponse<ApiKey>> => {
    const { data } = await apiClient.get<PaginatedResponse<ApiKey>>(
      `/api/api-keys?userId=${userId}`,
    );
    return data;
  },

  createApiKey: async (apiKeyData: CreateApiKeyInput): Promise<ApiKey> => {
    const { data } = await apiClient.post<ApiKey>(`/api/api-keys`, apiKeyData);
    return data;
  },

  deleteApiKey: async (id: string): Promise<void> => {
    await apiClient.delete(`/api/api-keys/${id}`);
  },
};

import { apiClient } from '@/lib/api-client';
import { ApiKey, ApiResponse, CreateApiKeyInput } from '@/types';

export const apiKeysApi = {
  getAll: async (userId: string): Promise<ApiKey[]> => {
    const { data } = await apiClient.get<ApiKey[] | { data: ApiKey[] }>(
      `/api/api-keys?userId=${userId}`,
    );
    return Array.isArray(data) ? data : data?.data || [];
  },

  getById: async (id: string): Promise<ApiKey> => {
    const { data } = await apiClient.get<ApiResponse<ApiKey>>(`/api/api-keys/${id}`);
    return data.data;
  },

  getByProvider: async (userId: string, provider: string): Promise<ApiKey[]> => {
    const { data } = await apiClient.get<ApiKey[] | { data: ApiKey[] }>(
      `/api/api-keys/provider/${provider}?userId=${userId}`,
    );

    return Array.isArray(data) ? data : data?.data || [];
  },

  create: async (input: CreateApiKeyInput): Promise<ApiKey> => {
    const { data } = await apiClient.post<ApiKey>(`/api/api-keys`, input);
    return data;
  },

  update: async (
    id: string,
    input: { keyName?: string; apiKey?: string; isActive?: boolean },
  ): Promise<ApiKey> => {
    const { data } = await apiClient.put<ApiKey>(`/api/api-keys/${id}`, input);
    return data;
  },

  getDecryptedKey: async (id: string): Promise<string> => {
    const res = await fetch(`/api/api-keys/${id}/decrypt`);
    if (!res.ok) throw new Error('Failed to decrypt API key');
    const data = await res.json();
    return data.key;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/api/api-keys/${id}`);
  },
};

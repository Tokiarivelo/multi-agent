import { apiClient } from '@/lib/api-client';
import { User, LoginCredentials, RegisterData, ApiResponse } from '@/types';

export const authApi = {
  login: async (credentials: LoginCredentials): Promise<User> => {
    const { data } = await apiClient.post<ApiResponse<User>>('/api/auth/login', credentials);
    return data.data;
  },

  register: async (userData: RegisterData): Promise<User> => {
    const { data } = await apiClient.post<ApiResponse<User>>('/api/auth/register', userData);
    return data.data;
  },

  logout: async (): Promise<void> => {
    await apiClient.post('/api/auth/logout');
  },

  getCurrentUser: async (): Promise<User | null> => {
    try {
      const { data } = await apiClient.get<ApiResponse<User>>('/api/auth/me');
      return data?.data || null;
    } catch {
      return null;
    }
  },

  refreshToken: async (): Promise<void> => {
    await apiClient.post('/api/auth/refresh');
  },
};

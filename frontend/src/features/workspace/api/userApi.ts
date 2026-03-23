import { apiClient } from '@/lib/api-client';

export interface UserSettings {
  indexableExtensions: string[];
}

export const userApi = {
  getSettings: async (): Promise<{ settings: UserSettings }> => {
    const res = await apiClient.get('/api/users/me/settings');
    return res.data;
  },

  updateSettings: async (settings: Partial<UserSettings>): Promise<{ settings: UserSettings }> => {
    const res = await apiClient.patch('/api/users/me/settings', { settings });
    return res.data;
  },
};

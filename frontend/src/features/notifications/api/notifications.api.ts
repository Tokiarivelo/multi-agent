import { apiClient } from '@/lib/api-client';
import type { AppNotification } from '@/types';

export const getNotifications = async (userId: string, unreadOnly = false): Promise<AppNotification[]> => {
  const { data } = await apiClient.get<AppNotification[]>(
    `/api/notifications?userId=${userId}&unreadOnly=${unreadOnly}`,
  );
  return data;
};

export const markNotificationRead = async (id: string, userId: string): Promise<void> => {
  await apiClient.put(`/api/notifications/${id}/read?userId=${userId}`);
};

export const markAllNotificationsRead = async (userId: string): Promise<void> => {
  await apiClient.put(`/api/notifications/read-all?userId=${userId}`);
};

import { NotificationSettings, CreateNotificationData } from '../../types/notification';

const request = async (url: string, options?: RequestInit) => {
  const token = localStorage.getItem('token');
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options?.headers,
  };

  const response = await fetch(`/api${url}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: '请求失败' }));
    throw new Error(error.error || '请求失败');
  }

  return response.json();
};

export const notificationApi = {
  getNotifications: (params?: { limit?: number; unread_only?: boolean }) => {
    const query = new URLSearchParams();
    if (params?.limit) query.append('limit', params.limit.toString());
    if (params?.unread_only) query.append('unread_only', 'true');
    return request(`/notifications?${query.toString()}`);
  },

  getUnreadCount: () => request('/notifications/unread-count'),

  markAsRead: (notificationId: string) =>
    request(`/notifications/${notificationId}/read`, { method: 'PUT' }),

  markAllAsRead: () => request('/notifications/read-all', { method: 'PUT' }),

  deleteNotification: (notificationId: string) =>
    request(`/notifications/${notificationId}`, { method: 'DELETE' }),

  clearAll: () => request('/notifications/clear-all', { method: 'DELETE' }),

  createNotification: (data: CreateNotificationData) =>
    request('/notifications', { method: 'POST', body: JSON.stringify(data) }),

  getSettings: (): Promise<{ success: boolean; data: NotificationSettings }> =>
    request('/notifications/settings'),

  updateSettings: (settings: Partial<NotificationSettings>) =>
    request('/notifications/settings', { method: 'PUT', body: JSON.stringify(settings) }),
};

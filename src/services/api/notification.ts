import {
  NotificationSettings,
  CreateNotificationData,
} from "@shared/types";
import { request } from "./client";

export const notificationApi = {
  getNotifications: (params?: { limit?: number; unread_only?: boolean }) => {
    const query = new URLSearchParams();
    if (params?.limit) query.append("limit", params.limit.toString());
    if (params?.unread_only) query.append("unread_only", "true");
    return request(`/notifications?${query.toString()}`);
  },

  getUnreadCount: () => request("/notifications/unread-count"),

  markAsRead: (notificationId: string) =>
    request(`/notifications/${notificationId}/read`, { method: "PUT" }),

  markAllAsRead: () => request("/notifications/read-all", { method: "PUT" }),

  deleteNotification: (notificationId: string) =>
    request(`/notifications/${notificationId}`, { method: "DELETE" }),

  clearAll: () => request("/notifications/clear-all", { method: "DELETE" }),

  createNotification: (data: CreateNotificationData) =>
    request("/notifications", { method: "POST", body: JSON.stringify(data) }),

  getSettings: (): Promise<{ success: boolean; data: NotificationSettings }> =>
    request("/notifications/settings"),

  updateSettings: (settings: Partial<NotificationSettings>) =>
    request("/notifications/settings", {
      method: "PUT",
      body: JSON.stringify(settings),
    }),
};

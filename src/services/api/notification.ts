import {
  Notification,
  NotificationSettings,
  CreateNotificationData,
} from "@shared/types";
import { request } from "./client";

export const notificationApi = {
  getNotifications: (params?: { limit?: number; unread_only?: boolean }) => {
    const query = new URLSearchParams();
    if (params?.limit) query.append("limit", params.limit.toString());
    if (params?.unread_only) query.append("unread_only", "true");
    return request<{ success: boolean; data: Notification[] }>(
      `/notifications?${query.toString()}`,
    );
  },

  getUnreadCount: () =>
    request<{ success: boolean; count: number }>("/notifications/unread-count"),

  markAsRead: (notificationId: string) =>
    request<{ success: boolean }>(
      `/notifications/${notificationId}/read`,
      { method: "PUT" },
    ),

  markAllAsRead: () =>
    request<{ success: boolean }>("/notifications/read-all", { method: "PUT" }),

  deleteNotification: (notificationId: string) =>
    request<{ success: boolean }>(`/notifications/${notificationId}`, {
      method: "DELETE",
    }),

  clearAll: () =>
    request<{ success: boolean }>("/notifications/clear-all", {
      method: "DELETE",
    }),

  createNotification: (data: CreateNotificationData) =>
    request<{ success: boolean; data: Notification }>("/notifications", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  getSettings: (): Promise<{ success: boolean; data: NotificationSettings }> =>
    request<{ success: boolean; data: NotificationSettings }>(
      "/notifications/settings",
    ),

  updateSettings: (settings: Partial<NotificationSettings>) =>
    request<{ success: boolean; data: NotificationSettings }>(
      "/notifications/settings",
      {
        method: "PUT",
        body: JSON.stringify(settings),
      },
    ),
};

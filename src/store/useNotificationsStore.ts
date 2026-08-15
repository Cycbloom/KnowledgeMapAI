import type { NotificationType, UserSettingsNotifications } from "@shared/types";
import { createPersistedStore } from "./createPersistedStore";

interface NotificationsState extends UserSettingsNotifications {
  setMutedNotificationTypes: (types: NotificationType[]) => void;
  toggleMutedType: (type: NotificationType) => void;
  isMuted: (type: NotificationType) => boolean;
  clearMuted: () => void;
}

export const useNotificationsStore = createPersistedStore<NotificationsState>(
  "notifications",
  (set, get) => ({
    mutedNotificationTypes: [],

    setMutedNotificationTypes: (types) =>
      set({ mutedNotificationTypes: types }),

    toggleMutedType: (type) =>
      set((state) => {
        // 合并 includes+filter 两次扫描为单趟遍历，O(2×n) → O(n)
        let found = false;
        const next: NotificationType[] = [];
        for (const t of state.mutedNotificationTypes) {
          if (t === type) {
            found = true;
          } else {
            next.push(t);
          }
        }
        return {
          mutedNotificationTypes: found ? next : [...next, type],
        };
      }),

    isMuted: (type) => get().mutedNotificationTypes.includes(type),

    clearMuted: () => set({ mutedNotificationTypes: [] }),
  }),
);

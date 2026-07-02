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
      set((state) => ({
        mutedNotificationTypes: state.mutedNotificationTypes.includes(type)
          ? state.mutedNotificationTypes.filter((t) => t !== type)
          : [...state.mutedNotificationTypes, type],
      })),

    isMuted: (type) => get().mutedNotificationTypes.includes(type),

    clearMuted: () => set({ mutedNotificationTypes: [] }),
  }),
);

import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  Bell,
  Timer,
  CheckCircle,
  Clock,
  AlertCircle,
  Coffee,
  Settings as SettingsIcon,
  CheckSquare,
  Square,
} from "lucide-react";
import type { NotificationType } from "@shared/types";
import { useNotificationsStore } from "../../store/useNotificationsStore";

const NOTIFICATION_TYPES: NotificationType[] = [
  "task_start",
  "task_complete",
  "time_slice_end",
  "deadline",
  "break_start",
  "break_end",
  "daily_summary",
  "system",
];

const NOTIFICATION_TYPE_META: Record<
  NotificationType,
  { labelKey: string; descKey: string; icon: React.ComponentType<{ className?: string }>; iconColor: string }
> = {
  task_start: {
    labelKey: "settings.notifications.types.task_start",
    descKey: "settings.notifications.types.task_startDesc",
    icon: Timer,
    iconColor: "text-primary-500",
  },
  task_complete: {
    labelKey: "settings.notifications.types.task_complete",
    descKey: "settings.notifications.types.task_completeDesc",
    icon: CheckCircle,
    iconColor: "text-green-500",
  },
  time_slice_end: {
    labelKey: "settings.notifications.types.time_slice_end",
    descKey: "settings.notifications.types.time_slice_endDesc",
    icon: Clock,
    iconColor: "text-orange-500",
  },
  deadline: {
    labelKey: "settings.notifications.types.deadline",
    descKey: "settings.notifications.types.deadlineDesc",
    icon: AlertCircle,
    iconColor: "text-red-500",
  },
  break_start: {
    labelKey: "settings.notifications.types.break_start",
    descKey: "settings.notifications.types.break_startDesc",
    icon: Coffee,
    iconColor: "text-primary-500",
  },
  break_end: {
    labelKey: "settings.notifications.types.break_end",
    descKey: "settings.notifications.types.break_endDesc",
    icon: Coffee,
    iconColor: "text-primary-500",
  },
  daily_summary: {
    labelKey: "settings.notifications.types.daily_summary",
    descKey: "settings.notifications.types.daily_summaryDesc",
    icon: CheckCircle,
    iconColor: "text-primary-500",
  },
  system: {
    labelKey: "settings.notifications.types.system",
    descKey: "settings.notifications.types.systemDesc",
    icon: Bell,
    iconColor: "text-slate-500",
  },
};

export const NotificationSettings = React.memo(function NotificationSettings() {
  const { t } = useTranslation();
  const mutedTypes = useNotificationsStore((s) => s.mutedNotificationTypes);
  const toggleMutedType = useNotificationsStore((s) => s.toggleMutedType);
  const setMutedNotificationTypes = useNotificationsStore(
    (s) => s.setMutedNotificationTypes,
  );
  const clearMuted = useNotificationsStore((s) => s.clearMuted);

  const allMuted = useMemo(
    () => NOTIFICATION_TYPES.every((type) => mutedTypes.includes(type)),
    [mutedTypes],
  );
  const allEnabled = useMemo(() => mutedTypes.length === 0, [mutedTypes]);

  const isMuted = (type: NotificationType): boolean => mutedTypes.includes(type);

  const toggleType = (type: NotificationType): void => {
    toggleMutedType(type);
  };

  const handleSelectAll = (): void => {
    // "Select all" = enable all (clear mutes)
    clearMuted();
  };

  const handleDeselectAll = (): void => {
    // "Deselect all" = mute all
    setMutedNotificationTypes([...NOTIFICATION_TYPES]);
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 p-4 md:p-6 transition-colors">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <SettingsIcon className="w-5 h-5 text-primary-600 dark:text-primary-400" />
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
            {t("settings.notifications.title")}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSelectAll}
            disabled={allEnabled}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border border-gray-200 dark:border-slate-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <CheckSquare className="w-3 h-3" />
            {t("settings.notifications.selectAll")}
          </button>
          <button
            onClick={handleDeselectAll}
            disabled={allMuted}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border border-gray-200 dark:border-slate-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Square className="w-3 h-3" />
            {t("settings.notifications.deselectAll")}
          </button>
        </div>
      </div>

      <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
        {t("settings.notifications.description")}
      </p>

      <div className="space-y-2">
        {NOTIFICATION_TYPES.map((type) => {
          const meta = NOTIFICATION_TYPE_META[type];
          const Icon = meta.icon;
          const muted = isMuted(type);
          return (
            <label
              key={type}
              className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-slate-900/50 cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Icon className={`w-4 h-4 ${meta.iconColor}`} />
                <div>
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    {t(meta.labelKey as never)}
                  </span>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                    {t(meta.descKey as never)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400 dark:text-gray-500 hidden sm:inline">
                  {muted
                    ? t("settings.notifications.muted")
                    : t("settings.notifications.enabled")}
                </span>
                <div
                  role="switch"
                  aria-checked={!muted}
                  aria-label={t(meta.labelKey as never)}
                  tabIndex={0}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                    muted ? "bg-gray-200 dark:bg-gray-700" : "bg-primary-600"
                  }`}
                  onClick={() => toggleType(type)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      toggleType(type);
                    }
                  }}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                      muted ? "translate-x-0.5" : "translate-x-5"
                    }`}
                  />
                </div>
              </div>
            </label>
          );
        })}
      </div>
    </div>
  );
});

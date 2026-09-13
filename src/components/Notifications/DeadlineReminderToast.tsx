import React, { useEffect } from "react";
import { X, AlarmClock, AlertTriangle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { frontendEventBus } from "../../services/timer/FrontendEventBus";
import type { SSEMessagePayload } from "../../services/FrontendEventTypes";
import { playNotificationSound, sendBrowserNotification } from "../../utils/messageHelper";
import { useNotificationManager } from "../../store/useNotificationManager";

export interface DeadlineReminderItem {
  id: string;
  message: string;
  taskId: string;
  overdue: boolean;
  timestamp: number;
}

export const DeadlineReminderCard: React.FC<{
  item: DeadlineReminderItem;
  onDismiss: () => void;
  onViewTask: () => void;
}> = ({ item, onDismiss, onViewTask }) => {
  const { t } = useTranslation();
  const overdue = item.overdue;

  return (
    <div className="relative overflow-hidden bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-500 max-w-sm">
      <div
        className={`absolute inset-0 bg-gradient-to-r opacity-5 ${
          overdue
            ? "from-red-500 to-rose-500"
            : "from-amber-500 to-orange-500"
        }`}
      />

      <div className="relative p-4">
        <button
          onClick={onDismiss}
          className="absolute top-2 right-2 p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
          aria-label={t("toast.deadlineReminder.dismiss")}
        >
          <X size={16} />
        </button>

        <div className="flex items-start gap-3">
          <div
            className={`flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br flex items-center justify-center shadow-lg ${
              overdue
                ? "from-red-500 to-rose-500"
                : "from-amber-500 to-orange-500"
            }`}
          >
            {overdue ? (
              <AlertTriangle size={20} className="text-white" />
            ) : (
              <AlarmClock size={20} className="text-white" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p
              className={`text-xs font-medium ${
                overdue
                  ? "text-red-600 dark:text-red-400"
                  : "text-amber-600 dark:text-amber-400"
              }`}
            >
              {overdue
                ? t("toast.deadlineReminder.overdueTitle")
                : t("toast.deadlineReminder.title")}
            </p>
            <p className="text-sm text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
              {item.message}
            </p>
            <button
              onClick={onViewTask}
              className={`mt-2 inline-flex items-center px-3 py-1.5 text-xs font-bold rounded-lg text-white transition-colors min-h-[36px] ${
                overdue
                  ? "bg-red-500 hover:bg-red-600"
                  : "bg-amber-500 hover:bg-amber-600"
              }`}
            >
              {t("toast.deadlineReminder.viewTask")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * 任务到期/逾期通知桥接：订阅后端 cron 发布的 deadline_reminder（经 SSE 转发），
 * 推送浏览器原生通知 + 提示音，并向全局 notificationManager 登记，
 * 可一键跳转任务详情。逾期红色主题，临近到期琥珀色主题。
 */
export const DeadlineReminderToast: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  // 首次挂载时尽力请求浏览器通知权限
  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      "Notification" in window &&
      Notification.permission === "default"
    ) {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  useEffect(() => {
    const handler = (payload: SSEMessagePayload) => {
      if (
        payload.type !== "notification_needed" ||
        payload.notificationType !== "deadline_reminder"
      ) {
        return;
      }

      const data = (payload.data ?? {}) as {
        taskId?: string;
        taskTitle?: string;
        overdue?: boolean;
      };
      const rawMessage =
        typeof payload.message === "string" ? payload.message : "";
      const messageText =
        rawMessage.trim() ||
        t("toast.deadlineReminder.fallback", {
          title: data.taskTitle ?? "",
        });
      const taskId = data.taskId ?? "";
      const overdue = data.overdue ?? false;

      playNotificationSound();
      sendBrowserNotification(
        overdue
          ? t("toast.deadlineReminder.overdueTitle")
          : t("toast.deadlineReminder.title"),
        messageText,
      );

      useNotificationManager.getState().show({
        id: `deadline-reminder-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        kind: "deadline-reminder",
        priority: 9,
        status: "info",
        dismissible: true,
        autoDismissMs: 10000,
        data: { message: messageText, taskId, overdue },
        action: () => {
          useNotificationManager.getState().clear("deadline-reminder");
          if (taskId) {
            navigate(`/scheduler/task/${taskId}`);
          } else {
            navigate("/scheduler");
          }
        },
      });
    };

    const unsubscribe = frontendEventBus.subscribe("sse_message", handler);
    return unsubscribe;
  }, [t, navigate]);

  return null;
};

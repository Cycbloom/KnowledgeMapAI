import React, { useCallback, useEffect } from "react";
import { X, BookOpenCheck } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { frontendEventBus } from "../../services/timer/FrontendEventBus";
import type { SSEMessagePayload } from "../../services/FrontendEventTypes";
import { playNotificationSound, sendBrowserNotification } from "../../utils/messageHelper";
import { useNotificationManager } from "../../store/useNotificationManager";

export interface ReviewReminderItem {
  id: string;
  message: string;
  count: number;
  timestamp: number;
}

export const ReviewReminderCard: React.FC<{
  item: ReviewReminderItem;
  onDismiss: () => void;
  onReview: () => void;
}> = ({ item, onDismiss, onReview }) => {
  const { t } = useTranslation();

  return (
    <div className="relative overflow-hidden bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-500 max-w-sm">
      <div className="absolute inset-0 bg-gradient-to-r from-amber-500 to-orange-500 opacity-5" />

      <div className="relative p-4">
        <button
          onClick={onDismiss}
          className="absolute top-2 right-2 p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
          aria-label={t("toast.reviewReminder.dismiss")}
        >
          <X size={16} />
        </button>

        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-lg">
            <BookOpenCheck size={20} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">
              {t("toast.reviewReminder.title")}
            </p>
            <p className="text-sm text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
              {item.message}
            </p>
            <button
              onClick={onReview}
              className="mt-2 inline-flex items-center px-3 py-1.5 text-xs font-bold rounded-lg bg-amber-500 text-white hover:bg-amber-600 transition-colors min-h-[36px]"
            >
              {t("toast.reviewReminder.goReview")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * 复习提醒通知桥接：订阅后端 cron 发布的 review_reminder（经 SSE 转发），
 * 推送浏览器原生通知 + 提示音，并向全局 notificationManager 登记。
 *
 * 数据流：checkReviewReminders(cron) → notification_needed(review_reminder)
 *   → SSE → useTaskEvents → frontendEventBus(sse_message) → 本组件按类型消费。
 */
export const ReviewReminderToast: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const handleReview = useCallback(() => {
    useNotificationManager.getState().clear("review-reminder");
    navigate("/study");
  }, [navigate]);

  // 首次挂载时尽力请求浏览器通知权限（已授权则后续可发原生通知）
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
        payload.notificationType !== "review_reminder"
      ) {
        return;
      }

      const data = (payload.data ?? {}) as { count?: number };
      const count = data.count ?? 0;
      const rawMessage = typeof payload.message === "string" ? payload.message : "";
      const messageText =
        rawMessage.trim() || t("toast.reviewReminder.fallback", { count });

      playNotificationSound();
      sendBrowserNotification(t("toast.reviewReminder.title"), messageText);

      useNotificationManager.getState().show({
        id: `review-reminder-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        kind: "review-reminder",
        priority: 10,
        status: "info",
        dismissible: true,
        autoDismissMs: 10000,
        data: { message: messageText, count },
        action: handleReview,
      });
    };

    const unsubscribe = frontendEventBus.subscribe("sse_message", handler);
    return unsubscribe;
  }, [t, handleReview]);

  return null;
};

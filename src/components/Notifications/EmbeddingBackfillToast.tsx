import React, { useEffect } from "react";
import { X, AlertTriangle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { frontendEventBus } from "../../services/timer/FrontendEventBus";
import { useNotificationManager } from "../../store/useNotificationManager";

export interface BackfillToastItem {
  id: string;
  processed: number;
  failed: number;
  timestamp: number;
}

export const EmbeddingBackfillCard: React.FC<{
  item: BackfillToastItem;
  onDismiss: () => void;
}> = ({ item, onDismiss }) => {
  const { t } = useTranslation();

  return (
    <div className="relative overflow-hidden bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-500 max-w-sm">
      <div className="absolute inset-0 bg-gradient-to-r from-rose-500 to-red-500 opacity-5" />

      <div className="relative p-4">
        <button
          onClick={onDismiss}
          className="absolute top-2 right-2 p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
          aria-label={t("toast.embeddingBackfillDismiss")}
        >
          <X size={16} />
        </button>

        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-rose-500 to-red-500 flex items-center justify-center shadow-lg">
            <AlertTriangle size={20} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-rose-600 dark:text-rose-400 font-medium">
              {t("toast.embeddingBackfillTitle")}
            </p>
            <p className="text-sm text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
              {t("toast.embeddingBackfillFailed", {
                failed: item.failed,
                processed: item.processed,
              })}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * 定时补全 Embedding 出错时的通知桥接：订阅通用 `sse_message`，
 * 仅响应 embedding_backfill_failed，并向全局 notificationManager 推送。
 */
export const EmbeddingBackfillToast: React.FC = () => {
  useEffect(() => {
    const handler = (payload: {
      type: string;
      notificationType?: string;
      data?: unknown;
    }) => {
      if (
        payload.type !== "notification_needed" ||
        payload.notificationType !== "embedding_backfill_failed"
      ) {
        return;
      }

      const data = (payload.data ?? {}) as { processed?: number; failed?: number };

      useNotificationManager.getState().show({
        id: `embedding-backfill-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        kind: "embedding-backfill",
        priority: 8,
        status: "error",
        dismissible: true,
        autoDismissMs: 8000,
        data: {
          processed: data.processed ?? 0,
          failed: data.failed ?? 1,
        },
      });
    };

    const unsubscribe = frontendEventBus.subscribe("sse_message", handler);
    return unsubscribe;
  }, []);

  return null;
};

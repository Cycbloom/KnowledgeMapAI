import React, { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, AlertTriangle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { frontendEventBus } from "../../services/timer/FrontendEventBus";
import { useReducedMotionOrPreference } from "../../hooks/common/useReducedMotionOrPreference";

interface BackfillToastItem {
  id: string;
  processed: number;
  failed: number;
  timestamp: number;
}

const AUTO_DISMISS_MS = 8000;

const SingleToast: React.FC<{
  item: BackfillToastItem;
  onDismiss: (id: string) => void;
}> = ({ item, onDismiss }) => {
  const { t } = useTranslation();
  const { reduceMotion, transitionOverride } = useReducedMotionOrPreference();

  return (
    <motion.div
      layout
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, x: 100, scale: 0.8 }}
      animate={reduceMotion ? { opacity: 1 } : { opacity: 1, x: 0, scale: 1 }}
      exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: 100, scale: 0.8 }}
      transition={transitionOverride ?? { type: "spring", stiffness: 300, damping: 25 }}
      className="relative overflow-hidden bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-500 max-w-sm"
    >
      <div className="absolute inset-0 bg-gradient-to-r from-rose-500 to-red-500 opacity-5" />

      <div className="relative p-4">
        <button
          onClick={() => onDismiss(item.id)}
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
    </motion.div>
  );
};

/**
 * 定时补全 Embedding 出错时的右下角弹窗。
 * 订阅通用 `sse_message`（后端 notification_needed 经 SSE 转发时
 * 以该通知自身的 type 作为顶层 type），仅响应 embedding_backfill_failed。
 */
export const EmbeddingBackfillToast: React.FC<{ maxVisible?: number }> = ({
  maxVisible = 3,
}) => {
  const [toasts, setToasts] = useState<BackfillToastItem[]>([]);

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
      const item: BackfillToastItem = {
        id: `embedding-backfill-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        processed: data.processed ?? 0,
        failed: data.failed ?? 1,
        timestamp: Date.now(),
      };

      setToasts((prev) => [...prev, item].slice(-Math.max(1, maxVisible)));
    };

    const unsubscribe = frontendEventBus.subscribe("sse_message", handler);
    return unsubscribe;
  }, [maxVisible]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    if (toasts.length === 0) return;
    const timer = setTimeout(() => {
      setToasts((prev) => prev.slice(1));
    }, AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [toasts]);

  return (
    <div className="fixed bottom-6 right-6 z-[60] flex flex-col gap-2 pointer-events-none">
      <AnimatePresence mode="popLayout">
        {toasts.map((item) => (
          <div key={item.id} className="pointer-events-auto">
            <SingleToast item={item} onDismiss={dismissToast} />
          </div>
        ))}
      </AnimatePresence>
    </div>
  );
};
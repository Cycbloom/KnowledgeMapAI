import React, { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { cn } from '@/utils/utils';
import { frontendEventBus } from "../../services/timer/FrontendEventBus";
import type {
  MessageShowPayload,
  MessageHidePayload,
  MessageDismissPayload,
} from "../../services/FrontendEventTypes";
import type { MessageType } from "../../utils/messageHelper";
import { useTheme } from "../../hooks";
import {
  CheckCircle,
  AlertTriangle,
  Info,
  AlertCircle,
  Loader2,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

interface MessageItem {
  id: string;
  type: MessageType;
  content: string;
  duration: number;
  action?: MessageShowPayload["action"];
  createdAt: number;
}

interface MessageBarProps {
  bottomOffset?: number;
}

const MAX_VISIBLE = 3;
const DEFAULT_DURATION = 3000;

export const MessageBar: React.FC<MessageBarProps> = ({ bottomOffset = 0 }) => {
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const { isDark } = useTheme();
  const { t } = useTranslation();

  const handleMessageShow = useCallback((payload: MessageShowPayload) => {
    const id = payload.id ?? Math.random().toString(36).substring(7);
    const duration = payload.duration ?? DEFAULT_DURATION;
    const createdAt = Date.now();
    const newItem: MessageItem = {
      id,
      type: payload.type,
      content: payload.content,
      duration,
      action: payload.action,
      createdAt,
    };

    setMessages((prev) => {
      // 去重：相同 id 替换原有项（保留位置）
      const existingIndex = prev.findIndex((m) => m.id === id);
      let next: MessageItem[];
      if (existingIndex >= 0) {
        next = [...prev];
        next[existingIndex] = newItem;
      } else {
        next = [...prev, newItem];
      }
      // FIFO：超过最大可见数时移除最早的
      if (next.length > MAX_VISIBLE) {
        next = next.slice(next.length - MAX_VISIBLE);
      }
      return next;
    });

    // 自动关闭定时器（duration 为 0 或 Infinity 时不启动）
    if (duration !== 0 && duration !== Infinity) {
      setTimeout(() => {
        setMessages((prev) =>
          prev.filter((m) => !(m.id === id && m.createdAt === createdAt)),
        );
      }, duration);
    }
  }, []);

  const removeMessage = useCallback((id: string) => {
    setMessages((prev) => prev.filter((m) => m.id !== id));
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  const handleMessageDismiss = useCallback(
    (payload: MessageDismissPayload) => {
      removeMessage(payload.id);
    },
    [removeMessage],
  );

  const handleMessageDismissAll = useCallback(() => {
    clearMessages();
  }, [clearMessages]);

  // 向后兼容：useGraphAIOperations 仍通过 message_hide 关闭 loading 消息
  const handleMessageHide = useCallback(
    (payload: MessageHidePayload) => {
      if (payload.id) {
        removeMessage(payload.id);
      } else {
        clearMessages();
      }
    },
    [removeMessage, clearMessages],
  );

  useEffect(() => {
    const unsubShow = frontendEventBus.subscribe("message_show", handleMessageShow);
    const unsubDismiss = frontendEventBus.subscribe("message_dismiss", handleMessageDismiss);
    const unsubDismissAll = frontendEventBus.subscribe("message_dismiss_all", handleMessageDismissAll);
    const unsubHide = frontendEventBus.subscribe("message_hide", handleMessageHide);
    return () => {
      unsubShow();
      unsubDismiss();
      unsubDismissAll();
      unsubHide();
    };
  }, [handleMessageShow, handleMessageDismiss, handleMessageDismissAll, handleMessageHide]);

  const getBackgroundColor = (type: MessageType) => {
    switch (type) {
      case "error":
        return "bg-red-600";
      case "warning":
        return "bg-amber-600";
      case "success":
        return "bg-emerald-600";
      case "loading":
        return "bg-primary-600";
      default:
        return isDark ? "bg-slate-900" : "bg-primary-600";
    }
  };

  const getIcon = (type: MessageType) => {
    switch (type) {
      case "error":
        return <AlertCircle className="w-3.5 h-3.5" />;
      case "warning":
        return <AlertTriangle className="w-3.5 h-3.5" />;
      case "success":
        return <CheckCircle className="w-3.5 h-3.5" />;
      case "loading":
        return (
          <Loader2
            data-testid="loading-spinner"
            className="w-3.5 h-3.5 animate-spin"
          />
        );
      default:
        return <Info className="w-3.5 h-3.5" />;
    }
  };

  const hasError = messages.some((m) => m.type === "error");
  const ariaLive = hasError ? "assertive" : "polite";

  return (
    <div
      className="absolute left-0 right-0 z-50 pointer-events-none"
      style={{ bottom: bottomOffset }}
      role="region"
      aria-label={t('common.aria.notifications')}
      aria-live={ariaLive}
      aria-atomic="false"
    >
      <AnimatePresence>
        {messages.map((msg) => (
          <motion.div
            key={msg.id}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className={cn(
              'w-full h-8',
              getBackgroundColor(msg.type),
              'text-white flex items-center px-4 text-xs select-none shadow-lg pointer-events-auto'
            )}
            {...(msg.type === "loading"
              ? { role: "status", "aria-busy": "true", "aria-live": "polite" }
              : msg.type === "error"
                ? { role: "alert", "aria-live": "assertive" }
                : { role: "status", "aria-live": "polite" })}
          >
            <div className="flex items-center gap-2 flex-1 overflow-hidden">
              <div className="flex items-center gap-2 truncate">
                {getIcon(msg.type)}
                <span className="font-medium tracking-wide">
                  {msg.content}
                </span>
                {msg.action && (
                  <button
                    onClick={msg.action.onClick}
                    className="ml-3 underline hover:text-white/80 transition-colors font-semibold"
                  >
                    {msg.action.label}
                  </button>
                )}
              </div>
            </div>
            {msg.type !== "loading" && (
              <button
                onClick={() => removeMessage(msg.id)}
                aria-label={t('common.aria.close')}
                className="ml-2 hover:text-white/80 transition-colors flex-shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};

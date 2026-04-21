import React, { useState, useEffect, useCallback } from "react";
import { frontendEventBus } from "../../services/timer/FrontendEventBus";
import type { MessageShowPayload } from "../../services/FrontendEventTypes";
import { useTheme } from "../../hooks";
import {
  CheckCircle,
  AlertTriangle,
  Info,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

interface CurrentMessage {
  id: string;
  type: MessageShowPayload["type"];
  content: string;
  action?: MessageShowPayload["action"];
}

interface MessageBarProps {
  bottomOffset?: number;
}

export const MessageBar: React.FC<MessageBarProps> = ({ bottomOffset = 0 }) => {
  const [currentMessage, setCurrentMessage] = useState<CurrentMessage | null>(null);
  const { isDark } = useTheme();

  const handleMessageShow = useCallback((payload: MessageShowPayload) => {
    const id = payload.id ?? Math.random().toString(36).substring(7);
    setCurrentMessage({
      id,
      type: payload.type,
      content: payload.content,
      action: payload.action,
    });

    if (payload.duration !== 0) {
      setTimeout(() => {
        setCurrentMessage((prev) => (prev?.id === id ? null : prev));
      }, payload.duration ?? 3000);
    }
  }, []);

  const handleMessageHide = useCallback((payload: { id?: string }) => {
    if (payload.id) {
      setCurrentMessage((prev) => (prev?.id === payload.id ? null : prev));
    } else {
      setCurrentMessage(null);
    }
  }, []);

  useEffect(() => {
    const unsubShow = frontendEventBus.subscribe("message_show", handleMessageShow);
    const unsubHide = frontendEventBus.subscribe("message_hide", handleMessageHide);
    return () => {
      unsubShow();
      unsubHide();
    };
  }, [handleMessageShow, handleMessageHide]);

  const getBackgroundColor = (
    type?: "info" | "success" | "warning" | "error" | "loading",
  ) => {
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

  const getIcon = (
    type?: "info" | "success" | "warning" | "error" | "loading",
  ) => {
    switch (type) {
      case "error":
        return <AlertCircle className="w-3.5 h-3.5" />;
      case "warning":
        return <AlertTriangle className="w-3.5 h-3.5" />;
      case "success":
        return <CheckCircle className="w-3.5 h-3.5" />;
      case "loading":
        return <Loader2 className="w-3.5 h-3.5 animate-spin" />;
      default:
        return <Info className="w-3.5 h-3.5" />;
    }
  };

  return (
    <div
      className="absolute left-0 right-0 z-50 pointer-events-none"
      style={{ bottom: bottomOffset }}
    >
      <AnimatePresence>
        {currentMessage && (
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className={`w-full h-8 ${getBackgroundColor(currentMessage.type)} text-white flex items-center px-4 text-xs select-none shadow-lg pointer-events-auto`}
          >
            <div className="flex items-center gap-2 flex-1 overflow-hidden">
              <motion.div
                key={currentMessage.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center gap-2 truncate"
              >
                {getIcon(currentMessage.type)}
                <span className="font-medium tracking-wide">
                  {currentMessage.content}
                </span>
                {currentMessage.action && (
                  <button
                    onClick={currentMessage.action.onClick}
                    className="ml-3 underline hover:text-white/80 transition-colors font-semibold"
                  >
                    {currentMessage.action.label}
                  </button>
                )}
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useNotificationManager } from "@/store/useNotificationManager";
import { useReducedMotionOrPreference } from "@/hooks/common/useReducedMotionOrPreference";
import { notificationRenderers } from "./notificationRenderers";

export const NotificationHost: React.FC = () => {
  const entries = useNotificationManager((s) => s.entries);
  const dismiss = useNotificationManager((s) => s.dismiss);
  const { reduceMotion, transitionOverride } = useReducedMotionOrPreference();

  if (entries.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-notification flex flex-col gap-2 pointer-events-none">
      <AnimatePresence mode="popLayout">
        {entries.map((entry) => {
          const Renderer = notificationRenderers[entry.kind];
          if (!Renderer) return null;
          return (
            <motion.div
              key={entry.id}
              layout
              initial={reduceMotion ? { opacity: 0 } : { opacity: 0, x: 100, scale: 0.9 }}
              animate={reduceMotion ? { opacity: 1 } : { opacity: 1, x: 0, scale: 1 }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: 100, scale: 0.9 }}
              transition={transitionOverride ?? { type: "spring", stiffness: 300, damping: 25 }}
              className="pointer-events-auto"
            >
              <Renderer
                data={entry.data}
                status={entry.status}
                onDismiss={() => {
                  if (entry.onDismiss) {
                    entry.onDismiss();
                  } else {
                    dismiss(entry.id);
                  }
                }}
                onAction={entry.action}
              />
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};

export default NotificationHost;

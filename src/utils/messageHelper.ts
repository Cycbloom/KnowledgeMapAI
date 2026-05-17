import { frontendEventBus } from "../services/timer/FrontendEventBus";

interface MessageOptions {
  duration?: number;
}

export const message = {
  success: (content: string, options?: MessageOptions) =>
    frontendEventBus.publish("message_show", {
      type: "success",
      content,
      duration: options?.duration ?? 3000,
    }),

  error: (content: string, options?: MessageOptions) =>
    frontendEventBus.publish("message_show", {
      type: "error",
      content,
      duration: options?.duration ?? 5000,
    }),

  info: (content: string, options?: MessageOptions) =>
    frontendEventBus.publish("message_show", {
      type: "info",
      content,
      duration: options?.duration ?? 3000,
    }),

  warning: (content: string, options?: MessageOptions) =>
    frontendEventBus.publish("message_show", {
      type: "warning",
      content,
      duration: options?.duration ?? 4000,
    }),
};

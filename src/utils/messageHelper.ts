import { frontendEventBus } from "../services/timer/FrontendEventBus";
import { useFocusStore } from "../store/useFocusStore";

interface MessageOptions {
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export const message = {
  success: (content: string, options?: MessageOptions) =>
    frontendEventBus.publish("message_show", {
      type: "success",
      content,
      duration: options?.duration ?? 3000,
      action: options?.action,
    }),

  error: (content: string, options?: MessageOptions) =>
    frontendEventBus.publish("message_show", {
      type: "error",
      content,
      duration: options?.duration ?? 5000,
      action: options?.action,
    }),

  info: (content: string, options?: MessageOptions) =>
    frontendEventBus.publish("message_show", {
      type: "info",
      content,
      duration: options?.duration ?? 3000,
      action: options?.action,
    }),

  warning: (content: string, options?: MessageOptions) =>
    frontendEventBus.publish("message_show", {
      type: "warning",
      content,
      duration: options?.duration ?? 4000,
      action: options?.action,
    }),
};

/**
 * 播放通知提示音
 * 仅在用户开启声音时播放，使用 Web Audio API 生成 800Hz 正弦波提示音
 */
export function playNotificationSound(): void {
  const { soundEnabled } = useFocusStore.getState();
  if (!soundEnabled) return;
  try {
    const AudioCtx =
      window.AudioContext ?? (window as never)["webkitAudioContext"];
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 800;
    osc.type = "sine";
    gain.gain.value = 0.3;
    osc.start();
    setTimeout(() => {
      osc.stop();
      ctx.close();
    }, 300);
  } catch {
    // Audio not available
  }
}

/**
 * 发送浏览器通知
 * 需要用户已授予通知权限
 */
export function sendBrowserNotification(title: string, body: string): void {
  if (typeof window === "undefined") return;
  if (!("Notification" in window)) return;
  if (Notification.permission !== "granted") return;

  new Notification(title, { body });
}

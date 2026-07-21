import { frontendEventBus } from "../services/timer/FrontendEventBus";
import { useFocusStore } from "../store/useFocusStore";

export type MessageType = "success" | "error" | "info" | "warning" | "loading";

export interface MessageOptions {
  id?: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export interface MessageApi {
  success: (content: string, options?: MessageOptions) => string;
  error: (content: string, options?: MessageOptions) => string;
  info: (content: string, options?: MessageOptions) => string;
  warning: (content: string, options?: MessageOptions) => string;
  loading: (content: string, options?: MessageOptions) => string;
  dismiss: (id?: string) => void;
}

/**
 * 生成消息 id：优先使用 crypto.randomUUID()，SSR/老环境回退到时间戳+随机串
 */
function generateMessageId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function publishMessage(
  type: MessageType,
  content: string,
  options: MessageOptions | undefined,
  defaultDuration: number,
): string {
  const id = options?.id ?? generateMessageId();
  const duration = options?.duration ?? defaultDuration;
  frontendEventBus.publish("message_show", {
    id,
    type,
    content,
    duration,
    action: options?.action,
  });
  return id;
}

export const message: MessageApi = {
  success: (content, options) =>
    publishMessage("success", content, options, 3000),

  error: (content, options) => publishMessage("error", content, options, 5000),

  info: (content, options) => publishMessage("info", content, options, 3000),

  warning: (content, options) =>
    publishMessage("warning", content, options, 4000),

  loading: (content, options) =>
    publishMessage("loading", content, options, Infinity),

  dismiss: (id) => {
    if (id === undefined) {
      frontendEventBus.publish("message_dismiss_all", {});
    } else {
      frontendEventBus.publish("message_dismiss", { id });
    }
  },
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

import { useEffect } from "react";
import { frontendEventBus } from "@/services/timer/FrontendEventBus";
import type { CelebrationBurstPayload } from "@/services/FrontendEventTypes";
import { usePreferencesStore } from "@/store/usePreferencesStore";

/**
 * 庆祝效果单例组件。
 *
 * 挂载在 App 根（与 Toaster 同级），订阅 frontendEventBus 的 "celebration_burst" 事件。
 * 收到事件后按以下顺序判断是否渲染粒子：
 *   1. usePreferencesStore.celebrationEnabled 为 false → 忽略（toast 文字反馈由调用方负责）
 *   2. prefers-reduced-motion: reduce → 忽略
 *   3. 否则调用 canvas-confetti 渲染粒子，参数从事件的 config 取
 *
 * 组件本身不渲染任何可见 DOM（Canvas 由 canvas-confetti 自动创建并附加到 body，
 * pointer-events: none），返回 null。
 */
export function CelebrationOverlay() {
  useEffect(() => {
    // SSR 安全：node 环境下不订阅
    if (typeof window === "undefined") return;

    const unsubscribe = frontendEventBus.subscribe(
      "celebration_burst",
      async (payload: CelebrationBurstPayload) => {
        // 用户偏好：关闭庆祝效果则忽略
        if (!usePreferencesStore.getState().celebrationEnabled) {
          return;
        }

        // 用户偏好减少动效则忽略
        if (
          window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ) {
          return;
        }

        // 按需加载 canvas-confetti（庆典特效非首屏关键依赖，动态 import 缩小主入口）
        const { default: confetti } = await import("canvas-confetti");
        // 渲染粒子：CelebrationConfig 字段与 canvas-confetti Options 结构兼容
        confetti(payload.config);
      },
    );

    return () => {
      unsubscribe();
    };
  }, []);

  return null;
}

export default CelebrationOverlay;

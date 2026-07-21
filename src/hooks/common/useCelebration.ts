import { useCallback } from "react";
import { frontendEventBus } from "../../services/timer/FrontendEventBus";
import {
  createCelebrationThrottler,
  getCelebrationConfig,
  type CelebrationPreset,
} from "../../services/celebrationService";

/**
 * 模块级单例节流器：跨组件共享，1 秒内多次触发合并为一次。
 * 通过模块级变量保证整个应用共用同一个节流窗口，
 * 避免不同组件实例各自节流导致频率失控。
 */
const sharedThrottler = createCelebrationThrottler(1000);

/**
 * 庆祝效果 Hook。
 *
 * 仅负责发布 "celebration_burst" 事件到 frontendEventBus，
 * 不直接渲染。实际渲染由 CelebrationOverlay 组件订阅事件完成。
 *
 * 内部使用模块级单例节流器，跨组件共享节流窗口。
 */
export function useCelebration(): {
  triggerCelebration: (preset: CelebrationPreset) => void;
} {
  const triggerCelebration = useCallback((preset: CelebrationPreset): void => {
    if (!sharedThrottler(preset)) {
      return;
    }
    frontendEventBus.publish("celebration_burst", {
      preset,
      config: getCelebrationConfig(preset),
      timestamp: Date.now(),
    });
  }, []);

  return { triggerCelebration };
}

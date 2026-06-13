/**
 * Store Integrations
 *
 * 统一管理 Store 间的事件协调，避免 Store 之间直接互相引用。
 * 所有 Store 间耦合逻辑集中在此文件中。
 */
import { frontendEventBus } from "../services/timer/FrontendEventBus";
import { useNoiseStore } from "./useNoiseStore";
import { useTimerStore } from "./useTimerStore";

// 退出专注模式时，重置白噪音
frontendEventBus.subscribe("focus_exit", () => {
  useNoiseStore.getState().setNoise("none");
});

// 专注设置变更时，同步到 TimerStore
frontendEventBus.subscribe("focus_settings_changed", (settings) => {
  useTimerStore.getState().syncFocusSettings(settings);
});
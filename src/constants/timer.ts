import type { TimerMode } from "@shared/types";

/**
 * TimerMode 对应的 i18n key 映射
 */
export const TIMER_MODE_I18N_KEYS: Record<TimerMode, string> = {
  focus: "focusTimer.focus",
  shortBreak: "focusTimer.shortBreak",
  longBreak: "focusTimer.longBreak",
};

/**
 * 获取 TimerMode 的 i18n 标签
 */
export function getModeLabel(
  mode: TimerMode,
  t: (key: string) => string,
): string {
  return t(TIMER_MODE_I18N_KEYS[mode]);
}

/**
 * TimerMode 颜色映射
 */
export const TIMER_MODE_COLORS: Record<
  TimerMode,
  { primary: string; secondary: string; bg: string; bgLight: string }
> = {
  focus: {
    primary: "#3b82f6",
    secondary: "#1d4ed8",
    bg: "rgba(59, 130, 246, 0.15)",
    bgLight: "rgba(59, 130, 246, 0.12)",
  },
  shortBreak: {
    primary: "#10b981",
    secondary: "#059669",
    bg: "rgba(16, 185, 129, 0.15)",
    bgLight: "rgba(16, 185, 129, 0.12)",
  },
  longBreak: {
    primary: "#8b5cf6",
    secondary: "#7c3aed",
    bg: "rgba(139, 92, 246, 0.15)",
    bgLight: "rgba(139, 92, 246, 0.12)",
  },
};

import type { UserSettingsFocus } from "@shared/types";

/**
 * 专注设置默认值。
 * 作为唯一权威默认值来源，供 useFocusStore 初始状态与 useTimerStore 缓存使用，
 * 避免 store 之间直接相互 import。
 */
export const DEFAULT_FOCUS_SETTINGS: UserSettingsFocus = {
  focusDuration: 25,
  shortBreakDuration: 5,
  longBreakDuration: 15,
  longBreakInterval: 4,
  autoStartBreak: true,
  autoStartPomodoro: false,
  soundEnabled: true,
  notificationEnabled: true,
  highlightEnabled: false,
  highlightIntensity: 0.5,
};
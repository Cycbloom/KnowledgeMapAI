import { frontendEventBus } from "../services/timer/FrontendEventBus";
import { createPersistedStore } from "./createPersistedStore";
import { DEFAULT_FOCUS_SETTINGS } from "../constants/focusSettings";
import type { UserSettingsFocus } from "@shared/types";

interface FocusState extends UserSettingsFocus {
  // Transient (runtime-only) fields, not persisted.
  isInFocusMode: boolean;
  currentNodeId: string | null;

  updateSettings: (
    settings: Partial<
      Pick<
        FocusState,
        | "focusDuration"
        | "shortBreakDuration"
        | "longBreakDuration"
        | "longBreakInterval"
        | "autoStartBreak"
        | "autoStartPomodoro"
        | "soundEnabled"
        | "notificationEnabled"
      >
    >,
  ) => void;
  enterFocusMode: (nodeId?: string) => void;
  exitFocusMode: () => void;
  setHighlightEnabled: (enabled: boolean) => void;
  setHighlightIntensity: (intensity: number) => void;
}

function toUserSettings(state: FocusState): UserSettingsFocus {
  return {
    focusDuration: state.focusDuration,
    shortBreakDuration: state.shortBreakDuration,
    longBreakDuration: state.longBreakDuration,
    longBreakInterval: state.longBreakInterval,
    autoStartBreak: state.autoStartBreak,
    autoStartPomodoro: state.autoStartPomodoro,
    soundEnabled: state.soundEnabled,
    notificationEnabled: state.notificationEnabled,
    highlightEnabled: state.highlightEnabled,
    highlightIntensity: state.highlightIntensity,
  };
}

function publishSettings(state: FocusState): void {
  frontendEventBus.publish("focus_settings_changed", {
    settings: toUserSettings(state),
  });
}

export const useFocusStore = createPersistedStore<FocusState>(
  "focus",
  (set, get) => ({
    ...DEFAULT_FOCUS_SETTINGS,

    isInFocusMode: false,
    currentNodeId: null,

    updateSettings: (settings) => {
      set((state) => ({ ...state, ...settings }));
      publishSettings(get());
    },

    enterFocusMode: (nodeId) =>
      set({
        isInFocusMode: true,
        currentNodeId: nodeId || null,
      }),

    exitFocusMode: () => {
      const nodeId = get().currentNodeId;
      set({ isInFocusMode: false });
      frontendEventBus.publish("focus_exit", { nodeId: nodeId ?? undefined });
    },

    setHighlightEnabled: (enabled) => set({ highlightEnabled: enabled }),

    setHighlightIntensity: (intensity) =>
      set({ highlightIntensity: intensity }),
  }),
  {
    partialize: (state) => ({
      focusDuration: state.focusDuration,
      shortBreakDuration: state.shortBreakDuration,
      longBreakDuration: state.longBreakDuration,
      longBreakInterval: state.longBreakInterval,
      autoStartBreak: state.autoStartBreak,
      autoStartPomodoro: state.autoStartPomodoro,
      soundEnabled: state.soundEnabled,
      notificationEnabled: state.notificationEnabled,
      highlightEnabled: state.highlightEnabled,
      highlightIntensity: state.highlightIntensity,
    }),
    onRehydrateStorage: () => (hydratedState) => {
      // 延迟到微任务，确保各 store 的模块级订阅（如 useTimerStore）已注册，
      // 再将持久化设置同步到订阅方。
      if (hydratedState) {
        queueMicrotask(() => publishSettings(hydratedState));
      }
    },
  },
);
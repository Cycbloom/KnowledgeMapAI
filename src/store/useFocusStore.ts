import { frontendEventBus } from "../services/timer/FrontendEventBus";
import { createPersistedStore } from "./createPersistedStore";
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

const DEFAULT_SETTINGS = {
  focusDuration: 25,
  shortBreakDuration: 5,
  longBreakDuration: 15,
  longBreakInterval: 4,
  autoStartBreak: true,
  autoStartPomodoro: false,
  soundEnabled: true,
  notificationEnabled: true,
};

export { DEFAULT_SETTINGS };

export const useFocusStore = createPersistedStore<FocusState>(
  "focus",
  (set, get) => ({
    focusDuration: DEFAULT_SETTINGS.focusDuration,
    shortBreakDuration: DEFAULT_SETTINGS.shortBreakDuration,
    longBreakDuration: DEFAULT_SETTINGS.longBreakDuration,
    longBreakInterval: DEFAULT_SETTINGS.longBreakInterval,
    autoStartBreak: DEFAULT_SETTINGS.autoStartBreak,
    autoStartPomodoro: DEFAULT_SETTINGS.autoStartPomodoro,
    soundEnabled: DEFAULT_SETTINGS.soundEnabled,
    notificationEnabled: DEFAULT_SETTINGS.notificationEnabled,

    isInFocusMode: false,
    highlightEnabled: false,
    highlightIntensity: 0.5,
    currentNodeId: null,

    updateSettings: (settings) => {
      set((state) => {
        const newState = { ...state, ...settings };
        return newState;
      });
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
  },
);

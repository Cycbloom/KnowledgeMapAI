import { create } from "zustand";
import { persist, devtools } from "zustand/middleware";

import type { TimerMode } from "@shared/types";
export type { TimerMode };

// Re-export noise types and store for backward compatibility
export { useNoiseStore } from "./useNoiseStore";
export type {
  WhiteNoiseType,
  NoiseCategory,
  MixedNoise,
  NoisePreset,
  NoiseOption,
} from "./useNoiseStore";

import { useNoiseStore } from "./useNoiseStore";

interface FocusState {
  focusDuration: number;
  shortBreakDuration: number;
  longBreakDuration: number;
  longBreakInterval: number;
  autoStartBreak: boolean;
  autoStartPomodoro: boolean;
  soundEnabled: boolean;
  notificationEnabled: boolean;

  isInFocusMode: boolean;
  highlightEnabled: boolean;
  highlightIntensity: number;
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

export const useFocusStore = create<FocusState>()(
  devtools(
    persist(
      (set) => ({
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
          set({ isInFocusMode: false });
          // Sync: reset noise when exiting focus mode
          useNoiseStore.getState().setNoise("none");
        },

        setHighlightEnabled: (enabled) => set({ highlightEnabled: enabled }),

        setHighlightIntensity: (intensity) =>
          set({ highlightIntensity: intensity }),
      }),
      {
        name: "focus-storage",
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
    ),
    { name: "FocusStore" },
  ),
);

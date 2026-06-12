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
  soundEnabled: boolean;

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
        | "soundEnabled"
      >
    >,
  ) => void;
  enterFocusMode: (nodeId?: string) => void;
  exitFocusMode: () => void;
  setHighlightEnabled: (enabled: boolean) => void;
  setHighlightIntensity: (intensity: number) => void;
}

const DEFAULT_DURATIONS = {
  focus: 25,
  shortBreak: 5,
  longBreak: 15,
};

export const useFocusStore = create<FocusState>()(
  devtools(
    persist(
      (set) => ({
        focusDuration: DEFAULT_DURATIONS.focus,
        shortBreakDuration: DEFAULT_DURATIONS.shortBreak,
        longBreakDuration: DEFAULT_DURATIONS.longBreak,
        soundEnabled: true,

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
          soundEnabled: state.soundEnabled,
          highlightEnabled: state.highlightEnabled,
          highlightIntensity: state.highlightIntensity,
        }),
      },
    ),
    { name: "FocusStore" },
  ),
);

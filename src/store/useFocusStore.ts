import { create } from "zustand";
import { persist, devtools } from "zustand/middleware";

export type TimerMode = "focus" | "shortBreak" | "longBreak";

export type WhiteNoiseType =
  | "rain"
  | "thunder"
  | "ocean"
  | "stream"
  | "wind"
  | "forest"
  | "fire"
  | "cafe"
  | "library"
  | "night"
  | "train"
  | "airplane"
  | "singing_bowl"
  | "wind_chime"
  | "breathing"
  | "white_noise"
  | "pink_noise"
  | "brown_noise"
  | "none";

export type NoiseCategory = "nature" | "environment" | "meditation";

export interface MixedNoise {
  type: WhiteNoiseType;
  volume: number;
}

export interface NoisePreset {
  id: string;
  name: string;
  noises: MixedNoise[];
  isBuiltIn?: boolean;
}

export interface NoiseOption {
  id: WhiteNoiseType;
  label: string;
  icon: string;
  category: NoiseCategory;
}

interface FocusState {
  mode: TimerMode;

  taskId: string | null;

  focusDuration: number;
  shortBreakDuration: number;
  longBreakDuration: number;
  soundEnabled: boolean;

  sessionsCompleted: number;

  isInFocusMode: boolean;
  selectedNoise: WhiteNoiseType;
  noiseVolume: number;
  highlightEnabled: boolean;
  highlightIntensity: number;
  currentNodeId: string | null;

  mixedNoises: MixedNoise[];
  customPresets: NoisePreset[];
  activePresetId: string | null;

  setMode: (mode: TimerMode) => void;
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
  setNoise: (noise: WhiteNoiseType) => void;
  setNoiseVolume: (volume: number) => void;
  setHighlightEnabled: (enabled: boolean) => void;
  setHighlightIntensity: (intensity: number) => void;
  setCurrentNodeId: (nodeId: string | null) => void;
  addMixedNoise: (noise: MixedNoise) => void;
  removeMixedNoise: (type: WhiteNoiseType) => void;
  updateMixedNoiseVolume: (type: WhiteNoiseType, volume: number) => void;
  clearMixedNoises: () => void;
  saveCustomPreset: (name: string) => void;
  deleteCustomPreset: (id: string) => void;
  loadPreset: (preset: NoisePreset) => void;
  setActivePresetId: (id: string | null) => void;
}

const DEFAULT_DURATIONS = {
  focus: 25,
  shortBreak: 5,
  longBreak: 15,
};

export const useFocusStore = create<FocusState>()(
  devtools(
    persist(
      (set, get) => ({
        mode: "focus",
        taskId: null,
        focusDuration: DEFAULT_DURATIONS.focus,
        shortBreakDuration: DEFAULT_DURATIONS.shortBreak,
        longBreakDuration: DEFAULT_DURATIONS.longBreak,
        soundEnabled: true,
        sessionsCompleted: 0,

        isInFocusMode: false,
        selectedNoise: "none" as WhiteNoiseType,
        noiseVolume: 0.5,
        highlightEnabled: false,
        highlightIntensity: 0.5,
        currentNodeId: null,

        mixedNoises: [],
        customPresets: [],
        activePresetId: null,

        setMode: (mode) => {
          set({ mode });
        },

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

        exitFocusMode: () =>
          set({
            isInFocusMode: false,
            selectedNoise: "none" as WhiteNoiseType,
          }),

        setNoise: (noise) => set({ selectedNoise: noise }),

        setNoiseVolume: (volume) => set({ noiseVolume: volume }),

        setHighlightEnabled: (enabled) => set({ highlightEnabled: enabled }),

        setHighlightIntensity: (intensity) =>
          set({ highlightIntensity: intensity }),

        setCurrentNodeId: (nodeId) => set({ currentNodeId: nodeId }),

        addMixedNoise: (noise) =>
          set((state) => {
            const exists = state.mixedNoises.find((n) => n.type === noise.type);
            if (exists) {
              return {
                mixedNoises: state.mixedNoises.map((n) =>
                  n.type === noise.type ? noise : n,
                ),
              };
            }
            return { mixedNoises: [...state.mixedNoises, noise] };
          }),

        removeMixedNoise: (type) =>
          set((state) => ({
            mixedNoises: state.mixedNoises.filter((n) => n.type !== type),
          })),

        updateMixedNoiseVolume: (type, volume) =>
          set((state) => ({
            mixedNoises: state.mixedNoises.map((n) =>
              n.type === type ? { ...n, volume } : n,
            ),
          })),

        clearMixedNoises: () => set({ mixedNoises: [], activePresetId: null }),

        saveCustomPreset: (name) => {
          const { mixedNoises, customPresets } = get();
          if (mixedNoises.length === 0) return;

          const newPreset: NoisePreset = {
            id: `preset_${Date.now()}`,
            name,
            noises: [...mixedNoises],
            isBuiltIn: false,
          };

          set({
            customPresets: [...customPresets, newPreset],
            activePresetId: newPreset.id,
          });
        },

        deleteCustomPreset: (id) =>
          set((state) => ({
            customPresets: state.customPresets.filter((p) => p.id !== id),
            activePresetId:
              state.activePresetId === id ? null : state.activePresetId,
          })),

        loadPreset: (preset) =>
          set({
            mixedNoises: [...preset.noises],
            activePresetId: preset.id,
          }),

        setActivePresetId: (id) => set({ activePresetId: id }),
      }),
      {
        name: "focus-storage",
        partialize: (state) => ({
          focusDuration: state.focusDuration,
          shortBreakDuration: state.shortBreakDuration,
          longBreakDuration: state.longBreakDuration,
          soundEnabled: state.soundEnabled,
          sessionsCompleted: state.sessionsCompleted,
          selectedNoise: state.selectedNoise,
          noiseVolume: state.noiseVolume,
          highlightEnabled: state.highlightEnabled,
          highlightIntensity: state.highlightIntensity,
          mixedNoises: state.mixedNoises,
          customPresets: state.customPresets,
          activePresetId: state.activePresetId,
        }),
      },
    ),
    { name: "FocusStore" },
  ),
);

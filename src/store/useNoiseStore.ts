import { create } from "zustand";
import { persist, devtools } from "zustand/middleware";

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

interface NoiseState {
  selectedNoise: WhiteNoiseType;
  noiseVolume: number;
  mixedNoises: MixedNoise[];
  customPresets: NoisePreset[];
  activePresetId: string | null;

  setNoise: (noise: WhiteNoiseType) => void;
  setNoiseVolume: (volume: number) => void;
  addMixedNoise: (noise: MixedNoise) => void;
  removeMixedNoise: (type: WhiteNoiseType) => void;
  updateMixedNoiseVolume: (type: WhiteNoiseType, volume: number) => void;
  clearMixedNoises: () => void;
  saveCustomPreset: (name: string) => void;
  deleteCustomPreset: (id: string) => void;
  loadPreset: (preset: NoisePreset) => void;
  setActivePresetId: (id: string | null) => void;
}

export const useNoiseStore = create<NoiseState>()(
  devtools(
    persist(
      (set, get) => ({
        selectedNoise: "none" as WhiteNoiseType,
        noiseVolume: 0.5,
        mixedNoises: [],
        customPresets: [],
        activePresetId: null,

        setNoise: (noise) => set({ selectedNoise: noise }),

        setNoiseVolume: (volume) => set({ noiseVolume: volume }),

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
        name: "noise-storage",
        partialize: (state) => ({
          selectedNoise: state.selectedNoise,
          noiseVolume: state.noiseVolume,
          mixedNoises: state.mixedNoises,
          customPresets: state.customPresets,
          activePresetId: state.activePresetId,
        }),
      },
    ),
    { name: "NoiseStore" },
  ),
);

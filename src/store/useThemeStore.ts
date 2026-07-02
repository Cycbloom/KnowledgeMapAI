import { createPersistedStore } from "./createPersistedStore";
import type {
  UserSettingsAppearance,
  UserSettingsThemeMode,
} from "@shared/types";
import type { ThemePreset } from "@shared/types";

interface ThemeStoreState extends UserSettingsAppearance {
  setThemeMode: (mode: UserSettingsThemeMode) => void;
  setThemePreset: (preset: ThemePreset) => void;
}

export const useThemeStore = createPersistedStore<ThemeStoreState>(
  "theme",
  (set) => ({
    themeMode: "system",
    themePreset: "default",
    setThemeMode: (mode) => set({ themeMode: mode }),
    setThemePreset: (preset) => set({ themePreset: preset }),
  }),
  {
    partialize: (state) => ({
      themeMode: state.themeMode,
      themePreset: state.themePreset,
    }),
  },
);

import { createPersistedStore } from "./createPersistedStore";
import type {
  UserSettingsAppearance,
  UserSettingsThemeMode,
  ThemePreset,
  UserSettingsUiFontFamily,
} from "@shared/types";

interface ThemeStoreState extends UserSettingsAppearance {
  setThemeMode: (mode: UserSettingsThemeMode) => void;
  setThemePreset: (preset: ThemePreset) => void;
  setUiFontFamily: (font: UserSettingsUiFontFamily) => void;
}

export const useThemeStore = createPersistedStore<ThemeStoreState>(
  "theme",
  (set) => ({
    themeMode: "system",
    themePreset: "default",
    uiFontFamily: "system",
    setThemeMode: (mode) => set({ themeMode: mode }),
    setThemePreset: (preset) => set({ themePreset: preset }),
    setUiFontFamily: (font) => set({ uiFontFamily: font }),
  }),
  {
    partialize: (state) => ({
      themeMode: state.themeMode,
      themePreset: state.themePreset,
      uiFontFamily: state.uiFontFamily,
    }),
    version: 2,
    migrate: (persistedState: unknown, version: number) => {
      if (
        version < 2 &&
        persistedState &&
        typeof persistedState === "object" &&
        !("uiFontFamily" in (persistedState as Record<string, unknown>))
      ) {
        (persistedState as Record<string, unknown>).uiFontFamily =
          "system" as UserSettingsUiFontFamily;
      }
      return persistedState as unknown as ThemeStoreState;
    },
  },
);

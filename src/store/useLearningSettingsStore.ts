import { createPersistedStore } from './createPersistedStore';
import type {
  UserSettingsLearning,
  UserSettingsReadingMode,
  UserSettingsPaginationMode,
  UserSettingsContentWidthMode,
  UserSettingsFontFamily,
  UserSettingsLineHeight,
  UserSettingsAILanguage,
} from '@shared/types';
import { useThemeStore } from './useThemeStore';

interface LearningSettingsState extends UserSettingsLearning {
  setFontSize: (size: number) => void;
  setFontFamily: (family: UserSettingsFontFamily) => void;
  setLineHeight: (lineHeight: UserSettingsLineHeight) => void;
  setReadingMode: (mode: UserSettingsReadingMode) => void;
  setPaginationMode: (mode: UserSettingsPaginationMode) => void;
  setContentWidthMode: (mode: UserSettingsContentWidthMode) => void;
  setAILanguage: (language: UserSettingsAILanguage) => void;
  setMaterialLanguage: (language: "auto" | "zh" | "en") => void;
  resetSettings: () => void;
}

const DEFAULT_SETTINGS: UserSettingsLearning = {
  fontSize: 16,
  fontFamily: 'sans',
  lineHeight: 'normal',
  readingMode: 'default',
  paginationMode: 'scroll',
  contentWidthMode: 'comfortable',
  aiLanguage: 'auto',
  materialLanguage: 'auto',
};

export const useLearningSettingsStore = createPersistedStore<LearningSettingsState>(
  'learning-settings',
  (set) => ({
    ...DEFAULT_SETTINGS,
    setFontSize: (size) => {
      const clampedSize = Math.max(12, Math.min(28, size));
      set({ fontSize: clampedSize });
    },
    setFontFamily: (family) => set({ fontFamily: family }),
    setLineHeight: (lineHeight) => set({ lineHeight }),
    setReadingMode: (mode) => set({ readingMode: mode }),
    setPaginationMode: (mode) => set({ paginationMode: mode }),
    setContentWidthMode: (mode) => set({ contentWidthMode: mode }),
    setAILanguage: (language) => set({ aiLanguage: language }),
    setMaterialLanguage: (language) => set({ materialLanguage: language }),
    resetSettings: () => set(DEFAULT_SETTINGS),
  }),
  {
    version: 3,
    migrate: (persistedState) => {
      // Migrate legacy readingMode === 'dark'. Dark mode is now owned by the
      // global theme (UserSettingsAppearance.themeMode), so move users who had
      // the dark reading mode over to the default reading mode and apply the
      // dark theme.
      if (persistedState && typeof persistedState === 'object') {
        const s = persistedState as { readingMode?: string };
        if (s.readingMode === 'dark') {
          s.readingMode = 'default';
          try {
            useThemeStore.getState().setThemeMode('dark');
          } catch {
            // theme store unavailable during migration; ignore
          }
        }
      }
      return persistedState as LearningSettingsState;
    },
  },
);

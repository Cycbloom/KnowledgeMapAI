import { create } from 'zustand';
import { persist, createJSONStorage, devtools } from 'zustand/middleware';

type ReadingMode = 'default' | 'eye-care' | 'dark';
type PaginationMode = 'scroll' | 'pagination';
type ContentWidthMode = 'full' | 'comfortable' | 'narrow';
type AILanguage = 'auto' | 'zh-CN' | 'en-US';

interface LearningSettingsState {
  fontSize: number;
  readingMode: ReadingMode;
  paginationMode: PaginationMode;
  contentWidthMode: ContentWidthMode;
  aiLanguage: AILanguage;
  setFontSize: (size: number) => void;
  setReadingMode: (mode: ReadingMode) => void;
  setPaginationMode: (mode: PaginationMode) => void;
  setContentWidthMode: (mode: ContentWidthMode) => void;
  setAILanguage: (language: AILanguage) => void;
  resetSettings: () => void;
}

const DEFAULT_SETTINGS = {
  fontSize: 16,
  readingMode: 'default' as const,
  paginationMode: 'scroll' as const,
  contentWidthMode: 'comfortable' as const,
  aiLanguage: 'auto' as const,
};

export const useLearningSettingsStore = create<LearningSettingsState>()(
  devtools(
    persist(
      (set) => ({
        ...DEFAULT_SETTINGS,
        setFontSize: (size) => {
          const clampedSize = Math.max(12, Math.min(24, size));
          set({ fontSize: clampedSize });
        },
        setReadingMode: (mode) => set({ readingMode: mode }),
        setPaginationMode: (mode) => set({ paginationMode: mode }),
        setContentWidthMode: (mode) => set({ contentWidthMode: mode }),
        setAILanguage: (language) => set({ aiLanguage: language }),
        resetSettings: () => set(DEFAULT_SETTINGS),
      }),
      {
        name: 'knowledge-map-learning-settings',
        storage: createJSONStorage(() => localStorage),
      }
    ),
    { name: 'LearningSettingsStore' }
  )
);

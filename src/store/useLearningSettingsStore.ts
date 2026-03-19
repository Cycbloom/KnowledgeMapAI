import { create } from 'zustand';
import { persist, createJSONStorage, devtools } from 'zustand/middleware';

type ReadingMode = 'default' | 'eye-care' | 'dark';
type PaginationMode = 'scroll' | 'pagination';

interface LearningSettingsState {
  fontSize: number;
  readingMode: ReadingMode;
  paginationMode: PaginationMode;
  setFontSize: (size: number) => void;
  setReadingMode: (mode: ReadingMode) => void;
  setPaginationMode: (mode: PaginationMode) => void;
  resetSettings: () => void;
}

const DEFAULT_SETTINGS = {
  fontSize: 16,
  readingMode: 'default' as const,
  paginationMode: 'scroll' as const,
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

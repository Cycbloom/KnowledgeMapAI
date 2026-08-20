import { createPersistedStore } from './createPersistedStore';
import type {
  UserSettingsQuiz,
  UserSettingsLineHeight,
  UserSettingsContentWidthMode,
} from '@shared/types';

interface QuizSettingsState extends UserSettingsQuiz {
  setFontSize: (size: number) => void;
  setLineHeight: (lineHeight: UserSettingsLineHeight) => void;
  setContentWidthMode: (mode: UserSettingsContentWidthMode) => void;
  resetSettings: () => void;
}

const DEFAULT_SETTINGS: UserSettingsQuiz = {
  fontSize: 16,
  lineHeight: 'normal',
  contentWidthMode: 'comfortable',
};

export const useQuizSettingsStore = createPersistedStore<QuizSettingsState>(
  'quiz-settings',
  (set) => ({
    ...DEFAULT_SETTINGS,
    setFontSize: (size) => {
      const clampedSize = Math.max(12, Math.min(28, size));
      set({ fontSize: clampedSize });
    },
    setLineHeight: (lineHeight) => set({ lineHeight }),
    setContentWidthMode: (mode) => set({ contentWidthMode: mode }),
    resetSettings: () => set(DEFAULT_SETTINGS),
  }),
  {
    version: 1,
    // 必须显式提供 partialize，否则 undefined 会覆盖 zustand persist 的默认
    // identity 函数，导致每次 setState 时 setItem 抛 "partialize is not a function"
    partialize: (state) => ({
      fontSize: state.fontSize,
      lineHeight: state.lineHeight,
      contentWidthMode: state.contentWidthMode,
    }),
  },
);

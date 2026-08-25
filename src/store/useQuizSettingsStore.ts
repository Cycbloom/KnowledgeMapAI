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
  setTimerSeconds: (seconds: number) => void;
  setOptionShuffle: (enabled: boolean) => void;
  setWrongRequeue: (enabled: boolean) => void;
  setExamShuffleQuestions: (enabled: boolean) => void;
  resetSettings: () => void;
}

const DEFAULT_SETTINGS: UserSettingsQuiz = {
  fontSize: 16,
  lineHeight: 'normal',
  contentWidthMode: 'comfortable',
  timerSeconds: 0,
  optionShuffle: true,
  wrongRequeue: true,
  examShuffleQuestions: true,
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
    setTimerSeconds: (seconds) => {
      const clamped = Math.max(0, Math.min(600, Math.round(seconds)));
      set({ timerSeconds: clamped });
    },
    setOptionShuffle: (enabled) => set({ optionShuffle: enabled }),
    setWrongRequeue: (enabled) => set({ wrongRequeue: enabled }),
    setExamShuffleQuestions: (enabled) => set({ examShuffleQuestions: enabled }),
    resetSettings: () => set(DEFAULT_SETTINGS),
  }),
  {
    version: 3,
    // 仅持久化用户可调项，忽略 action 函数
    partialize: (state) => ({
      fontSize: state.fontSize,
      lineHeight: state.lineHeight,
      contentWidthMode: state.contentWidthMode,
      timerSeconds: state.timerSeconds,
      optionShuffle: state.optionShuffle,
      wrongRequeue: state.wrongRequeue,
      examShuffleQuestions: state.examShuffleQuestions,
    }),
  },
);
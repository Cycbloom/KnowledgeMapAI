import { createPersistedStore } from './createPersistedStore';
import type {
  UserSettingsQuiz,
  UserSettingsQuizReadPart,
  UserSettingsLineHeight,
  UserSettingsContentWidthMode,
  TTSEngine,
} from '@shared/types';

interface QuizSettingsState extends UserSettingsQuiz {
  setFontSize: (size: number) => void;
  setLineHeight: (lineHeight: UserSettingsLineHeight) => void;
  setContentWidthMode: (mode: UserSettingsContentWidthMode) => void;
  setTimerSeconds: (seconds: number) => void;
  setOptionShuffle: (enabled: boolean) => void;
  setWrongRequeue: (enabled: boolean) => void;
  setExamShuffleQuestions: (enabled: boolean) => void;
  setInterleaveMode: (enabled: boolean) => void;
  setAutoReadEnabled: (enabled: boolean) => void;
  setAutoReadEngine: (engine: TTSEngine) => void;
  setAutoReadVoice: (voice: string) => void;
  setAutoReadRate: (rate: number) => void;
  setAutoReadPart: (part: UserSettingsQuizReadPart) => void;
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
  interleaveMode: false,
  autoReadEnabled: false,
  autoReadEngine: 'browser',
  autoReadVoice: '',
  autoReadRate: 1,
  autoReadPart: 'question',
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
    setInterleaveMode: (enabled) => set({ interleaveMode: enabled }),
    setAutoReadEnabled: (enabled) => set({ autoReadEnabled: enabled }),
    setAutoReadEngine: (engine) => set({ autoReadEngine: engine }),
    setAutoReadVoice: (voice) => set({ autoReadVoice: voice }),
    setAutoReadRate: (rate) => {
      const clamped = Math.max(0.5, Math.min(2, rate));
      set({ autoReadRate: clamped });
    },
    setAutoReadPart: (part) => set({ autoReadPart: part }),
    resetSettings: () => set(DEFAULT_SETTINGS),
  }),
  {
    version: 4,
    // 仅持久化用户可调项，忽略 action 函数
    partialize: (state) => ({
      fontSize: state.fontSize,
      lineHeight: state.lineHeight,
      contentWidthMode: state.contentWidthMode,
      timerSeconds: state.timerSeconds,
      optionShuffle: state.optionShuffle,
      wrongRequeue: state.wrongRequeue,
      examShuffleQuestions: state.examShuffleQuestions,
      interleaveMode: state.interleaveMode,
      autoReadEnabled: state.autoReadEnabled,
      autoReadEngine: state.autoReadEngine,
      autoReadVoice: state.autoReadVoice,
      autoReadRate: state.autoReadRate,
      autoReadPart: state.autoReadPart,
    }),
  },
);
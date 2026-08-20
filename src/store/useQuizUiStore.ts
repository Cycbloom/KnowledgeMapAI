import { create } from 'zustand';

interface QuizUiState {
  /** 答题模式是否激活：激活时全局布局隐去主侧边栏，由答题专用侧边栏接管 */
  isQuizModeActive: boolean;
  setQuizModeActive: (active: boolean) => void;
}

export const useQuizUiStore = create<QuizUiState>((set) => ({
  isQuizModeActive: false,
  setQuizModeActive: (active) => set({ isQuizModeActive: active }),
}));

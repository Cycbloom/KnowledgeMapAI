import { createPersistedStore } from './createPersistedStore';

export type QualityLevel = 'high' | 'medium' | 'low';

interface PerformanceState {
  quality: QualityLevel;
  showStats: boolean;
  fps: number;

  setQuality: (quality: QualityLevel) => void;
  toggleStats: () => void;
  setFps: (fps: number) => void;
}

export const usePerformanceStore = createPersistedStore<PerformanceState>(
  'performance',
  (set) => ({
    quality: 'high',
    showStats: false,
    fps: 0,

    setQuality: (quality) => set({ quality }),
    toggleStats: () => set((state) => ({ showStats: !state.showStats })),
    setFps: (fps) => set({ fps }),
  }),
  {
    partialize: (state) => ({ quality: state.quality, showStats: state.showStats }),
  }
);

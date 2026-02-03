import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type QualityLevel = 'high' | 'medium' | 'low';

interface PerformanceState {
  quality: QualityLevel;
  showStats: boolean;
  fps: number;
  
  setQuality: (quality: QualityLevel) => void;
  toggleStats: () => void;
  setFps: (fps: number) => void;
}

export const usePerformanceStore = create<PerformanceState>()(
  persist(
    (set) => ({
      quality: 'high',
      showStats: false,
      fps: 0,

      setQuality: (quality) => set({ quality }),
      toggleStats: () => set((state) => ({ showStats: !state.showStats })),
      setFps: (fps) => set({ fps }),
    }),
    {
      name: 'performance-storage',
      partialize: (state) => ({ quality: state.quality, showStats: state.showStats }), // Only persist settings, not transient FPS
    }
  )
);

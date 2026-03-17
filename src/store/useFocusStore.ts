import { create } from 'zustand';
import { persist, devtools } from 'zustand/middleware';
import { api } from '../services/api';

export type TimerMode = 'focus' | 'shortBreak' | 'longBreak';

export type WhiteNoiseType = 'rain' | 'cafe' | 'forest' | 'ocean' | 'fire' | 'none';

interface FocusState {
  isActive: boolean;
  timeLeft: number;
  mode: TimerMode;
  
  taskId: string | null;
  
  focusDuration: number;
  shortBreakDuration: number;
  longBreakDuration: number;
  soundEnabled: boolean;
  
  sessionsCompleted: number;

  isInFocusMode: boolean;
  selectedNoise: WhiteNoiseType;
  noiseVolume: number;
  highlightEnabled: boolean;
  highlightIntensity: number;
  currentNodeId: string | null;

  startTimer: () => void;
  pauseTimer: () => void;
  resetTimer: () => void;
  setMode: (mode: TimerMode) => void;
  tick: () => void;
  updateSettings: (settings: Partial<Pick<FocusState, 'focusDuration' | 'shortBreakDuration' | 'longBreakDuration' | 'soundEnabled'>>) => void;
  setTaskId: (taskId: string | null) => void;
  setDuration: (minutes: number) => void;
  enterFocusMode: (nodeId?: string) => void;
  exitFocusMode: () => void;
  setNoise: (noise: WhiteNoiseType) => void;
  setNoiseVolume: (volume: number) => void;
  setHighlightEnabled: (enabled: boolean) => void;
  setHighlightIntensity: (intensity: number) => void;
  setCurrentNodeId: (nodeId: string | null) => void;
}

const DEFAULT_DURATIONS = {
  focus: 25,
  shortBreak: 5,
  longBreak: 15,
};

export const useFocusStore = create<FocusState>()(
  devtools(
    persist(
      (set, get) => ({
        isActive: false,
        mode: 'focus',
        timeLeft: DEFAULT_DURATIONS.focus * 60,
        taskId: null,
        focusDuration: DEFAULT_DURATIONS.focus,
        shortBreakDuration: DEFAULT_DURATIONS.shortBreak,
        longBreakDuration: DEFAULT_DURATIONS.longBreak,
        soundEnabled: true,
        sessionsCompleted: 0,

        isInFocusMode: false,
        selectedNoise: 'none' as WhiteNoiseType,
        noiseVolume: 0.5,
        highlightEnabled: false,
        highlightIntensity: 0.5,
        currentNodeId: null,

        startTimer: () => set({ isActive: true }),
        
        pauseTimer: () => set({ isActive: false }),
        
        resetTimer: () => {
          const { mode, focusDuration, shortBreakDuration, longBreakDuration } = get();
          let duration = focusDuration;
          if (mode === 'shortBreak') duration = shortBreakDuration;
          if (mode === 'longBreak') duration = longBreakDuration;
          
          set({ isActive: false, timeLeft: duration * 60 });
        },
        
        setMode: (mode) => {
          const { focusDuration, shortBreakDuration, longBreakDuration } = get();
          let duration = focusDuration;
          if (mode === 'shortBreak') duration = shortBreakDuration;
          if (mode === 'longBreak') duration = longBreakDuration;
          
          set({ mode, isActive: false, timeLeft: duration * 60 });
        },
        
        tick: () => {
          const { timeLeft, isActive, soundEnabled } = get();
          if (!isActive) return;
          
          if (timeLeft > 0) {
            set({ timeLeft: timeLeft - 1 });
          } else {
            const { mode, focusDuration, shortBreakDuration, longBreakDuration, taskId } = get();
            
            let duration = 0;
            if (mode === 'focus') duration = focusDuration;
            else if (mode === 'shortBreak') duration = shortBreakDuration;
            else if (mode === 'longBreak') duration = longBreakDuration;

            const endTime = new Date();
            const startTime = new Date(endTime.getTime() - duration * 60 * 1000);
            
            api.focus.saveSession({
              duration,
              mode,
              start_time: startTime.toISOString(),
              end_time: endTime.toISOString(),
              task_id: taskId || undefined,
            }).catch(err => console.error('Failed to save focus session:', err));

            set((state) => ({ 
              isActive: false,
              sessionsCompleted: mode === 'focus' ? state.sessionsCompleted + 1 : state.sessionsCompleted
            }));
            
            if (soundEnabled) {
              try {
                if (typeof window !== 'undefined') {
                  const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
                  const osc = ctx.createOscillator();
                  const gain = ctx.createGain();
                  osc.connect(gain);
                  gain.connect(ctx.destination);
                  osc.type = 'sine';
                  osc.frequency.value = 880;
                  gain.gain.value = 0.1;
                  osc.start();
                  setTimeout(() => osc.stop(), 500);
                }
              } catch (e) {
                console.error('Audio play failed', e);
              }
            }
          }
        },
        
        updateSettings: (settings) => {
          set((state) => {
            const newState = { ...state, ...settings };
            return newState;
          });
        },

        setTaskId: (taskId) => set({ taskId }),

        setDuration: (minutes) => {
          const { isActive } = get();
          if (!isActive) {
            set({ timeLeft: minutes * 60, focusDuration: minutes });
          }
        },

        enterFocusMode: (nodeId) => set({ 
          isInFocusMode: true, 
          currentNodeId: nodeId || null 
        }),

        exitFocusMode: () => set({ 
          isInFocusMode: false,
          selectedNoise: 'none' as WhiteNoiseType
        }),

        setNoise: (noise) => set({ selectedNoise: noise }),

        setNoiseVolume: (volume) => set({ noiseVolume: volume }),

        setHighlightEnabled: (enabled) => set({ highlightEnabled: enabled }),

        setHighlightIntensity: (intensity) => set({ highlightIntensity: intensity }),

        setCurrentNodeId: (nodeId) => set({ currentNodeId: nodeId }),
      }),
      {
        name: 'focus-storage',
        partialize: (state) => ({
          focusDuration: state.focusDuration,
          shortBreakDuration: state.shortBreakDuration,
          longBreakDuration: state.longBreakDuration,
          soundEnabled: state.soundEnabled,
          sessionsCompleted: state.sessionsCompleted,
          selectedNoise: state.selectedNoise,
          noiseVolume: state.noiseVolume,
          highlightEnabled: state.highlightEnabled,
          highlightIntensity: state.highlightIntensity,
        }),
      }
    ),
    { name: 'FocusStore' }
  )
);

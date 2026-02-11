import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type TimerMode = 'focus' | 'shortBreak' | 'longBreak';

interface FocusState {
  // Timer State
  isActive: boolean;
  timeLeft: number; // in seconds
  mode: TimerMode;
  
  // Settings
  focusDuration: number; // in minutes
  shortBreakDuration: number; // in minutes
  longBreakDuration: number; // in minutes
  soundEnabled: boolean;
  
  // Stats (Session tracking for current session)
  sessionsCompleted: number;

  // Actions
  startTimer: () => void;
  pauseTimer: () => void;
  resetTimer: () => void;
  setMode: (mode: TimerMode) => void;
  tick: () => void;
  updateSettings: (settings: Partial<Pick<FocusState, 'focusDuration' | 'shortBreakDuration' | 'longBreakDuration' | 'soundEnabled'>>) => void;
}

const DEFAULT_DURATIONS = {
  focus: 25,
  shortBreak: 5,
  longBreak: 15,
};

export const useFocusStore = create<FocusState>()(
  persist(
    (set, get) => ({
      isActive: false,
      mode: 'focus',
      timeLeft: DEFAULT_DURATIONS.focus * 60,
      focusDuration: DEFAULT_DURATIONS.focus,
      shortBreakDuration: DEFAULT_DURATIONS.shortBreak,
      longBreakDuration: DEFAULT_DURATIONS.longBreak,
      soundEnabled: true,
      sessionsCompleted: 0,

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
        const { timeLeft, isActive, mode, soundEnabled } = get();
        if (!isActive) return;
        
        if (timeLeft > 0) {
          set({ timeLeft: timeLeft - 1 });
        } else {
          // Timer finished
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
                osc.frequency.value = 880; // A5
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
          // If the updated setting affects the current mode, reset the timer
          // Logic can be refined, but for now simple update
          return newState;
        });
      },
    }),
    {
      name: 'focus-storage',
      partialize: (state) => ({
        focusDuration: state.focusDuration,
        shortBreakDuration: state.shortBreakDuration,
        longBreakDuration: state.longBreakDuration,
        soundEnabled: state.soundEnabled,
        sessionsCompleted: state.sessionsCompleted,
      }),
    }
  )
);

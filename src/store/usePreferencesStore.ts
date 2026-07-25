import { createPersistedStore } from './createPersistedStore';

export interface PreferencesState {
  celebrationEnabled: boolean;
  shortcutHintEnabled: boolean;
  reducedMotion: boolean;
  setCelebrationEnabled: (value: boolean) => void;
  setShortcutHintEnabled: (value: boolean) => void;
  setReducedMotion: (value: boolean) => void;
}

export const usePreferencesStore = createPersistedStore<PreferencesState>(
  'preferences',
  (set) => ({
    celebrationEnabled: true,
    shortcutHintEnabled: true,
    reducedMotion: false,
    setCelebrationEnabled: (value) => set({ celebrationEnabled: value }),
    setShortcutHintEnabled: (value) => set({ shortcutHintEnabled: value }),
    setReducedMotion: (value) => set({ reducedMotion: value }),
  }),
  {
    partialize: (state) => ({
      celebrationEnabled: state.celebrationEnabled,
      shortcutHintEnabled: state.shortcutHintEnabled,
      reducedMotion: state.reducedMotion,
    }),
  },
);

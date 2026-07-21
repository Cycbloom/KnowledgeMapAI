import { createPersistedStore } from './createPersistedStore';

export interface PreferencesState {
  celebrationEnabled: boolean;
  shortcutHintEnabled: boolean;
  setCelebrationEnabled: (value: boolean) => void;
  setShortcutHintEnabled: (value: boolean) => void;
}

export const usePreferencesStore = createPersistedStore<PreferencesState>(
  'preferences',
  (set) => ({
    celebrationEnabled: true,
    shortcutHintEnabled: true,
    setCelebrationEnabled: (value) => set({ celebrationEnabled: value }),
    setShortcutHintEnabled: (value) => set({ shortcutHintEnabled: value }),
  }),
  {
    partialize: (state) => ({
      celebrationEnabled: state.celebrationEnabled,
      shortcutHintEnabled: state.shortcutHintEnabled,
    }),
  },
);

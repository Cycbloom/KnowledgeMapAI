import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { 
  DEFAULT_SHORTCUTS, 
  ShortcutDefinition, 
  ShortcutKey, 
  ShortcutBinding
} from '../config/shortcuts';

interface ShortcutState {
  bindings: Record<string, ShortcutBinding>;
  enabled: boolean;
  
  getShortcut: (id: string) => ShortcutDefinition | undefined;
  getBinding: (id: string) => ShortcutBinding | undefined;
  getKeyForAction: (action: string) => ShortcutKey | undefined;
  setBinding: (id: string, keys: ShortcutKey) => void;
  resetBinding: (id: string) => void;
  resetAllBindings: () => void;
  toggleShortcut: (id: string, enabled: boolean) => void;
  setEnabled: (enabled: boolean) => void;
  getAllShortcuts: () => ShortcutDefinition[];
  getShortcutsByCategory: () => Record<string, ShortcutDefinition[]>;
}

const defaultBindings: Record<string, ShortcutBinding> = {};
DEFAULT_SHORTCUTS.forEach(shortcut => {
  defaultBindings[shortcut.id] = {
    id: shortcut.id,
    keys: shortcut.defaultKeys,
    enabled: true
  };
});

export const useShortcutStore = create<ShortcutState>()(
  persist(
    (set, get) => ({
      bindings: defaultBindings,
      enabled: true,
      
      getShortcut: (id: string) => {
        return DEFAULT_SHORTCUTS.find(s => s.id === id);
      },
      
      getBinding: (id: string) => {
        return get().bindings[id];
      },
      
      getKeyForAction: (action: string) => {
        const shortcuts = DEFAULT_SHORTCUTS.filter(s => s.action === action);
        for (const shortcut of shortcuts) {
          const binding = get().bindings[shortcut.id];
          if (binding && binding.enabled) {
            return binding.keys;
          }
        }
        return undefined;
      },
      
      setBinding: (id: string, keys: ShortcutKey) => {
        set(state => ({
          bindings: {
            ...state.bindings,
            [id]: {
              ...state.bindings[id],
              keys
            }
          }
        }));
      },
      
      resetBinding: (id: string) => {
        const shortcut = DEFAULT_SHORTCUTS.find(s => s.id === id);
        if (shortcut) {
          set(state => ({
            bindings: {
              ...state.bindings,
              [id]: {
                id,
                keys: shortcut.defaultKeys,
                enabled: true
              }
            }
          }));
        }
      },
      
      resetAllBindings: () => {
        set({ bindings: defaultBindings });
      },
      
      toggleShortcut: (id: string, enabled: boolean) => {
        set(state => ({
          bindings: {
            ...state.bindings,
            [id]: {
              ...state.bindings[id],
              enabled
            }
          }
        }));
      },
      
      setEnabled: (enabled: boolean) => {
        set({ enabled });
      },
      
      getAllShortcuts: () => {
        return DEFAULT_SHORTCUTS;
      },
      
      getShortcutsByCategory: () => {
        const result: Record<string, ShortcutDefinition[]> = {};
        DEFAULT_SHORTCUTS.forEach(shortcut => {
          if (!result[shortcut.category]) {
            result[shortcut.category] = [];
          }
          result[shortcut.category].push(shortcut);
        });
        return result;
      }
    }),
    {
      name: 'shortcut-settings',
      partialize: (state) => ({
        bindings: state.bindings,
        enabled: state.enabled
      })
    }
  )
);

export function useShortcutKey(id: string): ShortcutKey | undefined {
  const binding = useShortcutStore(state => state.bindings[id]);
  return binding?.enabled ? binding.keys : undefined;
}

export function useFormattedShortcut(id: string): string {
  const { getShortcut, getBinding } = useShortcutStore();
  const shortcut = getShortcut(id);
  const binding = getBinding(id);
  
  if (!shortcut || !binding || !binding.enabled) {
    return '';
  }
  
  const { formatShortcutKey } = require('../config/shortcuts');
  return formatShortcutKey(binding.keys);
}

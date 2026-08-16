import {
  DEFAULT_SHORTCUTS,
  ShortcutDefinition,
  ShortcutKey,
  ShortcutBinding,
  formatShortcutKey
} from '../config/shortcuts';
import { createPersistedStore } from './createPersistedStore';
import type { UserSettingsShortcuts } from '@shared/types';

interface ShortcutState extends UserSettingsShortcuts {
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

// 预构建 id→定义 与 action→定义组 索引，将 getShortcut/getKeyForAction 的
// 线性扫描（O(n)）降为 O(1) 查找 / 单次遍历
const SHORTCUTS_BY_ID = new Map<string, ShortcutDefinition>(
  DEFAULT_SHORTCUTS.map(shortcut => [shortcut.id, shortcut]),
);
const SHORTCUTS_BY_ACTION = new Map<string, ShortcutDefinition[]>();
DEFAULT_SHORTCUTS.forEach(shortcut => {
  const list = SHORTCUTS_BY_ACTION.get(shortcut.action);
  if (list) {
    list.push(shortcut);
  } else {
    SHORTCUTS_BY_ACTION.set(shortcut.action, [shortcut]);
  }
});

export const useShortcutStore = createPersistedStore<ShortcutState>(
  'shortcut',
  (set, get) => ({
    bindings: defaultBindings,
    enabled: true,

    getShortcut: (id: string) => {
      // O(1) Map 查找替代 find 的线性扫描
      return SHORTCUTS_BY_ID.get(id);
    },

    getBinding: (id: string) => {
      return get().bindings[id];
    },

    getKeyForAction: (action: string) => {
      // 预构建 action 索引替代 filter 的线性扫描，O(1) 取组
      const shortcuts = SHORTCUTS_BY_ACTION.get(action) ?? [];
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
    partialize: (state) => ({
      bindings: state.bindings,
      enabled: state.enabled
    })
  }
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

  return formatShortcutKey(binding.keys);
}

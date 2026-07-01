import { create, type StateCreator } from 'zustand';
import { persist, devtools, createJSONStorage } from 'zustand/middleware';

interface CreatePersistedStoreOptions<T> {
  partialize?: (state: T) => Partial<T>;
  version?: number;
  storage?: Storage;
}

export function createPersistedStore<T>(
  name: string,
  stateCreator: StateCreator<T>,
  options?: CreatePersistedStoreOptions<T>,
) {
  const persistKey = `km-${name}`;
  return create<T>()(
    devtools(
      persist(stateCreator, {
        name: persistKey,
        storage: createJSONStorage(
          () => options?.storage ?? window.localStorage,
        ),
        partialize: options?.partialize as ((state: T) => T) | undefined,
        version: options?.version ?? 1,
        migrate: (persistedState: unknown, version: number) => {
          if (version < (options?.version ?? 1)) {
            return persistedState as T;
          }
          return persistedState as T;
        },
      }),
      { name: persistKey },
    ),
  );
}

const LEGACY_KEY_MAP: Record<string, string> = {
  'knowledge-map-auth': 'km-auth',
  'focus-storage': 'km-focus',
  'knowledgeMap-console': 'km-console',
  'performance-storage': 'km-performance',
  'noise-storage': 'km-noise',
  'shortcut-settings': 'km-shortcut',
  'knowledge-map-learning-settings': 'km-learning-settings',
};

export function migrateLegacyKeys(): void {
  for (const [oldKey, newKey] of Object.entries(LEGACY_KEY_MAP)) {
    if (localStorage.getItem(newKey) !== null) {
      continue;
    }
    const oldValue = localStorage.getItem(oldKey);
    if (oldValue !== null) {
      localStorage.setItem(newKey, oldValue);
      localStorage.removeItem(oldKey);
    }
  }
}

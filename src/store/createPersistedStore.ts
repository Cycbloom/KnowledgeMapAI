import { create, type StateCreator } from 'zustand';
import {
  persist,
  devtools,
  createJSONStorage,
  type PersistOptions,
} from 'zustand/middleware';

interface CreatePersistedStoreOptions<T> {
  partialize?: (state: T) => Partial<T>;
  version?: number;
  storage?: Storage;
  migrate?: (persistedState: unknown, version: number) => T | Promise<T>;
  onRehydrateStorage?: (
    state: T,
  ) => ((state?: T, error?: unknown) => void) | void;
}

export function createPersistedStore<T>(
  name: string,
  stateCreator: StateCreator<T>,
  options?: CreatePersistedStoreOptions<T>,
) {
  const persistKey = `km-${name}`;
  const persistOptions: PersistOptions<T, Partial<T>> = {
    name: persistKey,
    storage: createJSONStorage(() => options?.storage ?? window.localStorage),
    version: options?.version ?? 1,
    migrate: (persistedState: unknown, version: number) => {
      if (options?.migrate) {
        return options.migrate(persistedState, version);
      }
      return persistedState as T;
    },
    onRehydrateStorage: options?.onRehydrateStorage,
  };
  // Only forward `partialize` when the caller actually provided one. Zustand
  // v5's persist middleware already defaults partialize to an identity
  // function, but explicitly passing `undefined` (spread over its defaults)
  // would clobber that default — then every write crashes in persist's
  // setItem with "options.partialize is not a function".
  if (options?.partialize) {
    persistOptions.partialize = options.partialize;
  }
  return create<T>()(
    devtools(persist(stateCreator, persistOptions), { name: persistKey }),
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

// Legacy keys whose raw value should be merged into a specific field of a
// JSON-serialized zustand store (multiple legacy keys may target the same
// new key). Used when a raw localStorage value must be folded into a
// createPersistedStore state object rather than copied verbatim, e.g. the
// legacy `themeMode` / `themePreset` raw values merging into `km-theme`.
const LEGACY_FIELD_MAP: Record<string, { newKey: string; field: string }> = {
  themeMode: { newKey: 'km-theme', field: 'themeMode' },
  themePreset: { newKey: 'km-theme', field: 'themePreset' },
};

// Legacy keys whose value is a JSON-stringified payload (NOT in the
// zustand persist {state, version} envelope). `field` places the parsed
// value as a single named field in `state`; `spread` merges all fields of
// the parsed object into `state`. Used when a legacy JSON value must be
// folded into a createPersistedStore state object, e.g. the legacy
// `mutedNotificationTypes` array and `graphEditorPreferences` object.
const LEGACY_JSON_FIELD_MAP: Record<string, {
  newKey: string;
  field?: string;
  spread?: boolean;
}> = {
  mutedNotificationTypes: { newKey: 'km-notifications', field: 'mutedNotificationTypes' },
  graphEditorPreferences: { newKey: 'km-graph-editor', spread: true },
};

// Legacy keys that should be deleted outright with no migration target.
// These belong to features whose UI/store was removed without a replacement,
// e.g. `gesture-settings` from the deleted GestureSettingsPanel.
const LEGACY_DELETE_KEYS: string[] = ['gesture-settings'];

export function migrateLegacyKeys(): void {
  // 1:1 raw-value copies.
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

  // Field-level merges into JSON-serialized stores.
  const mergeTargets = new Map<
    string,
    { state: Record<string, unknown>; version: number; dirty: boolean }
  >();
  for (const [oldKey, { newKey, field }] of Object.entries(LEGACY_FIELD_MAP)) {
    const oldValue = localStorage.getItem(oldKey);
    if (oldValue === null) {
      continue;
    }
    let target = mergeTargets.get(newKey);
    if (!target) {
      const existing = localStorage.getItem(newKey);
      if (existing !== null) {
        try {
          const parsed = JSON.parse(existing) as {
            state?: Record<string, unknown>;
            version?: number;
          };
          target = {
            state: parsed.state ?? {},
            version: parsed.version ?? 1,
            dirty: false,
          };
        } catch {
          target = { state: {}, version: 1, dirty: false };
        }
      } else {
        target = { state: {}, version: 1, dirty: false };
      }
      mergeTargets.set(newKey, target);
    }
    if (target.state[field] === undefined) {
      target.state[field] = oldValue;
      target.dirty = true;
    }
    localStorage.removeItem(oldKey);
  }

  // JSON-payload merges into JSON-serialized stores. Shares `mergeTargets`
  // with the field-level loop above so legacy raw and JSON keys targeting
  // the same new key merge into one state object.
  for (const [oldKey, { newKey, field, spread }] of Object.entries(LEGACY_JSON_FIELD_MAP)) {
    const oldValue = localStorage.getItem(oldKey);
    if (oldValue === null) {
      continue;
    }
    let parsedValue: unknown;
    try {
      parsedValue = JSON.parse(oldValue);
    } catch {
      continue;
    }
    let target = mergeTargets.get(newKey);
    if (!target) {
      const existing = localStorage.getItem(newKey);
      if (existing !== null) {
        try {
          const parsed = JSON.parse(existing) as {
            state?: Record<string, unknown>;
            version?: number;
          };
          target = {
            state: parsed.state ?? {},
            version: parsed.version ?? 1,
            dirty: false,
          };
        } catch {
          target = { state: {}, version: 1, dirty: false };
        }
      } else {
        target = { state: {}, version: 1, dirty: false };
      }
      mergeTargets.set(newKey, target);
    }
    if (field !== undefined && target.state[field] === undefined) {
      target.state[field] = parsedValue;
      target.dirty = true;
    }
    if (
      spread &&
      parsedValue &&
      typeof parsedValue === 'object' &&
      !Array.isArray(parsedValue)
    ) {
      const parsedObj = parsedValue as Record<string, unknown>;
      for (const [k, v] of Object.entries(parsedObj)) {
        if (target.state[k] === undefined) {
          target.state[k] = v;
          target.dirty = true;
        }
      }
    }
    localStorage.removeItem(oldKey);
  }
  for (const [newKey, target] of mergeTargets) {
    if (target.dirty) {
      localStorage.setItem(
        newKey,
        JSON.stringify({ state: target.state, version: target.version }),
      );
    }
  }

  // Plain deletions for orphaned legacy keys (no migration target).
  for (const key of LEGACY_DELETE_KEYS) {
    localStorage.removeItem(key);
  }
}

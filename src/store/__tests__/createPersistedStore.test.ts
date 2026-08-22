// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createPersistedStore, migrateLegacyKeys } from '../createPersistedStore';

// 创建内存 Storage 用于测试
function createMemoryStorage(): Storage {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => { store.set(key, value); },
    removeItem: (key: string) => { store.delete(key); },
    clear: () => { store.clear(); },
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    get length() { return store.size; },
  };
}

interface TestState {
  count: number;
  label: string;
  setCount: (n: number) => void;
  setLabel: (s: string) => void;
}

describe('createPersistedStore', () => {
  it('应该创建带正确初始状态的 store', () => {
    const useTestStore = createPersistedStore<TestState>(
      'test-init',
      (set) => ({
        count: 0,
        label: 'default',
        setCount: (n) => set({ count: n }),
        setLabel: (s) => set({ label: s }),
      }),
    );
    const state = useTestStore.getState();
    expect(state.count).toBe(0);
    expect(state.label).toBe('default');
    expect(typeof state.setCount).toBe('function');
    expect(typeof state.setLabel).toBe('function');
  });

  it('应该能通过 action 更新状态', () => {
    const useTestStore = createPersistedStore<TestState>(
      'test-action',
      (set) => ({
        count: 0,
        label: 'default',
        setCount: (n) => set({ count: n }),
        setLabel: (s) => set({ label: s }),
      }),
    );
    useTestStore.getState().setCount(42);
    useTestStore.getState().setLabel('updated');
    const state = useTestStore.getState();
    expect(state.count).toBe(42);
    expect(state.label).toBe('updated');
  });

  it('应该支持自定义 storage 持久化状态', () => {
    const memoryStorage = createMemoryStorage();
    const useTestStore = createPersistedStore<TestState>(
      'test-persist',
      (set) => ({
        count: 0,
        label: 'default',
        setCount: (n) => set({ count: n }),
        setLabel: (s) => set({ label: s }),
      }),
      {
        storage: memoryStorage,
        partialize: (state) => ({ count: state.count, label: state.label }),
      },
    );
    useTestStore.getState().setCount(99);

    // 验证持久化到自定义 storage
    const raw = memoryStorage.getItem('km-test-persist');
    expect(raw).not.toBe(null);
    const parsed = JSON.parse(raw as string) as { state: { count: number } };
    expect(parsed.state.count).toBe(99);
  });

  it('应该支持 partialize 仅持久化指定字段', () => {
    const memoryStorage = createMemoryStorage();
    const useTestStore = createPersistedStore<TestState>(
      'test-partialize',
      (set) => ({
        count: 0,
        label: 'default',
        setCount: (n) => set({ count: n }),
        setLabel: (s) => set({ label: s }),
      }),
      {
        storage: memoryStorage,
        partialize: (state) => ({ count: state.count, label: state.label }),
      },
    );
    useTestStore.getState().setCount(7);
    useTestStore.getState().setLabel('partial');

    const raw = memoryStorage.getItem('km-test-partialize');
    expect(raw).not.toBe(null);
    const parsed = JSON.parse(raw as string) as { state: Record<string, unknown> };
    // partialize 应排除 actions（functions）
    expect(parsed.state.count).toBe(7);
    expect(parsed.state.label).toBe('partial');
    expect(parsed.state.setCount).toBeUndefined();
    expect(parsed.state.setLabel).toBeUndefined();
  });
});

describe('migrateLegacyKeys', () => {
  let memStore: Record<string, string>;

  beforeEach(() => {
    memStore = {};
    vi.spyOn(window.localStorage, 'getItem').mockImplementation(
      (key: string) => memStore[key] ?? null,
    );
    vi.spyOn(window.localStorage, 'setItem').mockImplementation(
      (key: string, value: string) => { memStore[key] = value; },
    );
    vi.spyOn(window.localStorage, 'removeItem').mockImplementation(
      (key: string) => { delete memStore[key]; },
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('应该将旧键的值迁移到新键', () => {
    memStore['knowledge-map-auth'] = JSON.stringify({ state: { user: 'test' }, version: 1 });
    migrateLegacyKeys();
    expect(memStore['km-auth']).toBeDefined();
    expect(memStore['knowledge-map-auth']).toBeUndefined();
  });

  it('新键已存在时不应覆盖', () => {
    memStore['knowledge-map-auth'] = 'old-value';
    memStore['km-auth'] = 'existing-value';
    migrateLegacyKeys();
    expect(memStore['km-auth']).toBe('existing-value');
  });

  it('应该删除无迁移目标的孤立旧键', () => {
    memStore['gesture-settings'] = 'orphan-data';
    migrateLegacyKeys();
    expect(memStore['gesture-settings']).toBeUndefined();
  });

  it('应该将旧字段合并到 JSON 序列化的 store', () => {
    memStore['themeMode'] = 'dark';
    migrateLegacyKeys();
    expect(memStore['km-theme']).toBeDefined();
    const parsed = JSON.parse(memStore['km-theme']) as { state: { themeMode?: string } };
    expect(parsed.state.themeMode).toBe('dark');
    expect(memStore['themeMode']).toBeUndefined();
  });

  it('应该将 JSON 载荷旧键合并到目标 store', () => {
    memStore['mutedNotificationTypes'] = JSON.stringify(['task_start', 'deadline']);
    migrateLegacyKeys();
    expect(memStore['km-notifications']).toBeDefined();
    const parsed = JSON.parse(memStore['km-notifications']) as { state: { mutedNotificationTypes?: string[] } };
    expect(parsed.state.mutedNotificationTypes).toEqual(['task_start', 'deadline']);
    expect(memStore['mutedNotificationTypes']).toBeUndefined();
  });
});

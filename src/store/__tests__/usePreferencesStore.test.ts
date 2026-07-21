// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';

const PERSIST_KEY = 'km-preferences';

describe('usePreferencesStore', () => {
  let memStore: Record<string, string>;

  beforeEach(() => {
    memStore = {};
    // setupTests.ts 把 window.localStorage 替换为不存储任何值的 vi.fn mock。
    // 这里通过 spyOn 覆盖方法实现，给 persist middleware 提供一个真实的内存存储。
    vi.spyOn(window.localStorage, 'getItem').mockImplementation(
      (key: string) => memStore[key] ?? null,
    );
    vi.spyOn(window.localStorage, 'setItem').mockImplementation(
      (key: string, value: string) => {
        memStore[key] = value;
      },
    );
    vi.spyOn(window.localStorage, 'removeItem').mockImplementation(
      (key: string) => {
        delete memStore[key];
      },
    );
    // 重置模块注册表，让每个测试通过动态 import 重新创建 store 实例，
    // 从而验证 persist 在新"会话"中的重新水合行为。
    vi.resetModules();
  });

  it('初始默认值应为 celebrationEnabled=true / shortcutHintEnabled=true', async () => {
    const { usePreferencesStore } = await import('../usePreferencesStore');
    const state = usePreferencesStore.getState();
    expect(state.celebrationEnabled).toBe(true);
    expect(state.shortcutHintEnabled).toBe(true);
  });

  it('应该通过 setCelebrationEnabled 更新 celebrationEnabled', async () => {
    const { usePreferencesStore } = await import('../usePreferencesStore');
    usePreferencesStore.getState().setCelebrationEnabled(false);
    expect(usePreferencesStore.getState().celebrationEnabled).toBe(false);
    usePreferencesStore.getState().setCelebrationEnabled(true);
    expect(usePreferencesStore.getState().celebrationEnabled).toBe(true);
  });

  it('应该通过 setShortcutHintEnabled 更新 shortcutHintEnabled', async () => {
    const { usePreferencesStore } = await import('../usePreferencesStore');
    usePreferencesStore.getState().setShortcutHintEnabled(false);
    expect(usePreferencesStore.getState().shortcutHintEnabled).toBe(false);
    usePreferencesStore.getState().setShortcutHintEnabled(true);
    expect(usePreferencesStore.getState().shortcutHintEnabled).toBe(true);
  });

  it('应该将字段持久化到 localStorage 的 km-preferences 键', async () => {
    const { usePreferencesStore } = await import('../usePreferencesStore');
    usePreferencesStore.getState().setCelebrationEnabled(false);
    usePreferencesStore.getState().setShortcutHintEnabled(false);

    const raw = memStore[PERSIST_KEY];
    expect(raw).toBeDefined();
    const parsed = JSON.parse(raw) as { state: Record<string, unknown> };
    expect(parsed.state.celebrationEnabled).toBe(false);
    expect(parsed.state.shortcutHintEnabled).toBe(false);
  });

  it('应该只持久化字段，不持久化 setter', async () => {
    const { usePreferencesStore } = await import('../usePreferencesStore');
    usePreferencesStore.getState().setCelebrationEnabled(false);

    const raw = memStore[PERSIST_KEY];
    expect(raw).toBeDefined();
    const parsed = JSON.parse(raw) as { state: Record<string, unknown> };
    expect(parsed.state.setCelebrationEnabled).toBeUndefined();
    expect(parsed.state.setShortcutHintEnabled).toBeUndefined();
  });

  it('应该跨"会话"从 localStorage 恢复状态', async () => {
    // 模拟前一次会话写入的 localStorage 数据
    memStore[PERSIST_KEY] = JSON.stringify({
      state: { celebrationEnabled: false, shortcutHintEnabled: false },
      version: 1,
    });

    // 重新导入 store 模块，触发 persist 重新水合
    const { usePreferencesStore } = await import('../usePreferencesStore');
    const state = usePreferencesStore.getState();
    expect(state.celebrationEnabled).toBe(false);
    expect(state.shortcutHintEnabled).toBe(false);
  });

  it('跨会话恢复后 setter 应仍可正常调用', async () => {
    memStore[PERSIST_KEY] = JSON.stringify({
      state: { celebrationEnabled: false, shortcutHintEnabled: false },
      version: 1,
    });

    const { usePreferencesStore } = await import('../usePreferencesStore');
    const state = usePreferencesStore.getState();
    expect(typeof state.setCelebrationEnabled).toBe('function');
    expect(typeof state.setShortcutHintEnabled).toBe('function');
    state.setCelebrationEnabled(true);
    expect(usePreferencesStore.getState().celebrationEnabled).toBe(true);
  });
});

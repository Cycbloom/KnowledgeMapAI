// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { StateCreator } from 'zustand';
import type { NotificationType } from '@shared/types';

// createPersistedStore 在未提供 partialize 时会传 undefined 给 zustand persist
// 中间件，覆盖其默认的 identity partialize，导致每次状态变更后抛出
// "options.partialize is not a function"。此处 mock createPersistedStore，
// 在未提供 partialize 时注入默认 identity 函数，以便测试 store 的真实逻辑。
vi.mock('../createPersistedStore', async (importOriginal) => {
  const actual = await importOriginal() as typeof import('../createPersistedStore');
  return {
    ...actual,
    createPersistedStore: function createPersistedStore<T>(
      name: string,
      stateCreator: StateCreator<T>,
      options?: {
        partialize?: (state: T) => Partial<T>;
        version?: number;
        storage?: Storage;
        migrate?: (persistedState: unknown, version: number) => T | Promise<T>;
      },
    ) {
      return actual.createPersistedStore<T>(name, stateCreator, {
        ...options,
        partialize: options?.partialize ?? ((state: T) => state),
      });
    },
  };
});

import { useNotificationsStore } from '../useNotificationsStore';

describe('useNotificationsStore', () => {
  beforeEach(() => {
    useNotificationsStore.setState({ mutedNotificationTypes: [] });
  });

  it('应该有正确的初始状态', () => {
    const state = useNotificationsStore.getState();
    expect(state.mutedNotificationTypes).toEqual([]);
  });

  it('应该能通过 setMutedNotificationTypes 设置静音类型列表', () => {
    const types: NotificationType[] = ['task_start', 'deadline'];
    useNotificationsStore.getState().setMutedNotificationTypes(types);
    expect(useNotificationsStore.getState().mutedNotificationTypes).toEqual(types);
  });

  it('应该能通过 toggleMutedType 添加静音类型', () => {
    useNotificationsStore.getState().toggleMutedType('task_start');
    expect(useNotificationsStore.getState().mutedNotificationTypes).toEqual(['task_start']);
  });

  it('应该能通过 toggleMutedType 移除已静音类型', () => {
    useNotificationsStore.getState().setMutedNotificationTypes(['task_start', 'deadline']);
    useNotificationsStore.getState().toggleMutedType('task_start');
    expect(useNotificationsStore.getState().mutedNotificationTypes).toEqual(['deadline']);
  });

  it('isMuted 应该正确返回静音状态', () => {
    useNotificationsStore.getState().setMutedNotificationTypes(['deadline']);
    expect(useNotificationsStore.getState().isMuted('deadline')).toBe(true);
    expect(useNotificationsStore.getState().isMuted('task_start')).toBe(false);
  });

  it('应该能通过 clearMuted 清空所有静音类型', () => {
    useNotificationsStore.getState().setMutedNotificationTypes(['task_start', 'deadline']);
    useNotificationsStore.getState().clearMuted();
    expect(useNotificationsStore.getState().mutedNotificationTypes).toEqual([]);
  });
});

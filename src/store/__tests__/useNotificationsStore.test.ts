// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import type { NotificationType } from '@shared/types';

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

// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { User } from '../../types';
import { useStore } from '../useStore';

// Mock errorReporter 以隔离 store 测试，避免加载 api/client 依赖链
vi.mock('../../utils/errorReporter', () => ({
  setUserContext: vi.fn(),
  clearUserContext: vi.fn(),
}));

const mockUser: User = {
  id: 'user-1',
  email: 'test@example.com',
  name: 'Test User',
};

describe('useStore', () => {
  beforeEach(() => {
    useStore.setState({ user: null, token: null, refreshToken: null });
  });

  it('应该有正确的初始状态', () => {
    const state = useStore.getState();
    expect(state.user).toBe(null);
    expect(state.token).toBe(null);
    expect(state.refreshToken).toBe(null);
  });

  it('应该能通过 setUser 更新用户和令牌', () => {
    useStore.getState().setUser(mockUser, 'token-abc');
    const state = useStore.getState();
    expect(state.user).toEqual(mockUser);
    expect(state.token).toBe('token-abc');
    expect(state.refreshToken).toBe(null);
  });

  it('应该能通过 setUser 同时设置 refreshToken', () => {
    useStore.getState().setUser(mockUser, 'token-abc', 'refresh-xyz');
    const state = useStore.getState();
    expect(state.refreshToken).toBe('refresh-xyz');
  });

  it('应该能通过 clearAuth 重置认证状态', () => {
    useStore.getState().setUser(mockUser, 'token-abc', 'refresh-xyz');
    useStore.getState().clearAuth();
    const state = useStore.getState();
    expect(state.user).toBe(null);
    expect(state.token).toBe(null);
    expect(state.refreshToken).toBe(null);
  });

  it('setUser 传入 null 用户时应清空认证', () => {
    useStore.getState().setUser(mockUser, 'token-abc', 'refresh-xyz');
    useStore.getState().setUser(null, null);
    const state = useStore.getState();
    expect(state.user).toBe(null);
    expect(state.token).toBe(null);
  });
});

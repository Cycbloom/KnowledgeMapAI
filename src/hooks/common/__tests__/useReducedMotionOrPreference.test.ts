// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

// 共享 mock 状态：通过 vi.hoisted 确保 vi.mock 工厂在模块加载阶段可访问。
// framer-motion 与 usePreferencesStore 都需要在模块导入前注册 mock，
// 否则 hook 内部的 import 会先于 mock 注册拿到真实模块。
const mockSystem = vi.hoisted(() => ({ reduced: false }));
const mockUser = vi.hoisted(() => ({ reduced: false }));

vi.mock('framer-motion', () => ({
  useReducedMotion: () => mockSystem.reduced,
}));

vi.mock('../../../store/usePreferencesStore', () => ({
  usePreferencesStore: (
    selector: (state: { reducedMotion: boolean }) => unknown,
  ) => selector({ reducedMotion: mockUser.reduced }),
}));

import { useReducedMotionOrPreference } from '../useReducedMotionOrPreference';

describe('useReducedMotionOrPreference', () => {
  beforeEach(() => {
    mockSystem.reduced = false;
    mockUser.reduced = false;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('system=false / user=false 应该返回 reduceMotion=false 且 transitionOverride=undefined', () => {
    mockSystem.reduced = false;
    mockUser.reduced = false;

    const { result } = renderHook(() => useReducedMotionOrPreference());

    expect(result.current.reduceMotion).toBe(false);
    expect(result.current.transitionOverride).toBeUndefined();
  });

  it('system=true / user=false 应该返回 reduceMotion=true 且 transitionOverride={ duration: 0 }', () => {
    mockSystem.reduced = true;
    mockUser.reduced = false;

    const { result } = renderHook(() => useReducedMotionOrPreference());

    expect(result.current.reduceMotion).toBe(true);
    expect(result.current.transitionOverride).toEqual({ duration: 0 });
  });

  it('system=false / user=true 应该返回 reduceMotion=true 且 transitionOverride={ duration: 0 }', () => {
    mockSystem.reduced = false;
    mockUser.reduced = true;

    const { result } = renderHook(() => useReducedMotionOrPreference());

    expect(result.current.reduceMotion).toBe(true);
    expect(result.current.transitionOverride).toEqual({ duration: 0 });
  });

  it('system=true / user=true 应该返回 reduceMotion=true 且 transitionOverride={ duration: 0 }', () => {
    mockSystem.reduced = true;
    mockUser.reduced = true;

    const { result } = renderHook(() => useReducedMotionOrPreference());

    expect(result.current.reduceMotion).toBe(true);
    expect(result.current.transitionOverride).toEqual({ duration: 0 });
  });
});

// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useEscapeKey } from '../useEscapeKey';

describe('useEscapeKey', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('按下 Escape 键应该触发回调函数', () => {
    const onEscape = vi.fn();

    renderHook(() => useEscapeKey(onEscape));

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    expect(onEscape).toHaveBeenCalledTimes(1);
  });

  it('按下非 Escape 键不应该触发回调', () => {
    const onEscape = vi.fn();

    renderHook(() => useEscapeKey(onEscape));

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));

    expect(onEscape).not.toHaveBeenCalled();
  });

  it('enabled=false 时按下 Escape 键不应该触发回调', () => {
    const onEscape = vi.fn();

    renderHook(() => useEscapeKey(onEscape, false));

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    expect(onEscape).not.toHaveBeenCalled();
  });

  it('组件卸载时应该移除 keydown 事件监听', () => {
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

    const { unmount } = renderHook(() => useEscapeKey(vi.fn()));

    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      'keydown',
      expect.any(Function),
    );
  });
});
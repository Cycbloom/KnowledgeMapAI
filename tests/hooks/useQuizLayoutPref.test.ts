// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useQuizLayoutPref } from '../../src/hooks/quiz/useQuizLayoutPref';
import * as useIsMobileModule from '../../src/hooks/common/useIsMobile';

const STORAGE_KEY = 'km-quiz-layout';

function mockIsMobile(isMobile: boolean): vi.SpyInstance {
  return vi.spyOn(useIsMobileModule, 'useIsMobile').mockReturnValue({
    isMobile,
    isTablet: false,
    isDesktop: !isMobile,
    screenWidth: isMobile ? 375 : 1280,
    screenHeight: isMobile ? 667 : 800,
    orientation: isMobile ? 'portrait' : 'landscape',
  });
}

describe('useQuizLayoutPref', () => {
  let storage: Record<string, string>;

  beforeEach(() => {
    vi.clearAllMocks();
    storage = {};
    vi.mocked(window.localStorage.getItem).mockImplementation((key) => {
      return storage[key] ?? null;
    });
    vi.mocked(window.localStorage.setItem).mockImplementation((key, value) => {
      storage[key] = value;
    });
    vi.mocked(window.localStorage.removeItem).mockImplementation((key) => {
      delete storage[key];
    });
    vi.mocked(window.localStorage.clear).mockImplementation(() => {
      storage = {};
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('初始化读取 localStorage', () => {
    it('localStorage 无值时默认返回 flash', () => {
      mockIsMobile(false);
      const { result } = renderHook(() => useQuizLayoutPref());
      expect(result.current.layoutMode).toBe('flash');
      expect(result.current.isForcedFlash).toBe(false);
    });

    it('localStorage 存储 flash 时返回 flash', () => {
      storage[STORAGE_KEY] = 'flash';
      mockIsMobile(false);
      const { result } = renderHook(() => useQuizLayoutPref());
      expect(result.current.layoutMode).toBe('flash');
    });

    it('localStorage 存储 focus 时返回 focus', () => {
      storage[STORAGE_KEY] = 'focus';
      mockIsMobile(false);
      const { result } = renderHook(() => useQuizLayoutPref());
      expect(result.current.layoutMode).toBe('focus');
    });

    it('localStorage 存储非法值时回退到 flash', () => {
      storage[STORAGE_KEY] = 'invalid-mode';
      mockIsMobile(false);
      const { result } = renderHook(() => useQuizLayoutPref());
      expect(result.current.layoutMode).toBe('flash');
    });

    it('localStorage 读取异常时回退到 flash 不崩溃', () => {
      vi.mocked(window.localStorage.getItem).mockImplementation(() => {
        throw new Error('read error');
      });
      mockIsMobile(false);
      const { result } = renderHook(() => useQuizLayoutPref());
      expect(result.current.layoutMode).toBe('flash');
    });
  });

  describe('setLayoutMode 写入 localStorage', () => {
    it('桌面端切换到 focus 并持久化', () => {
      mockIsMobile(false);
      const { result } = renderHook(() => useQuizLayoutPref());
      act(() => {
        result.current.setLayoutMode('focus');
      });
      expect(result.current.layoutMode).toBe('focus');
      expect(window.localStorage.setItem).toHaveBeenCalledWith(STORAGE_KEY, 'focus');
      expect(storage[STORAGE_KEY]).toBe('focus');
    });

    it('桌面端切换到 flash 并持久化', () => {
      storage[STORAGE_KEY] = 'focus';
      mockIsMobile(false);
      const { result } = renderHook(() => useQuizLayoutPref());
      act(() => {
        result.current.setLayoutMode('flash');
      });
      expect(result.current.layoutMode).toBe('flash');
      expect(window.localStorage.setItem).toHaveBeenCalledWith(STORAGE_KEY, 'flash');
      expect(storage[STORAGE_KEY]).toBe('flash');
    });

    it('写入失败时仅 console.warn 不抛异常', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      vi.mocked(window.localStorage.setItem).mockImplementation(() => {
        throw new Error('quota exceeded');
      });
      mockIsMobile(false);
      const { result } = renderHook(() => useQuizLayoutPref());
      expect(() => {
        act(() => {
          result.current.setLayoutMode('focus');
        });
      }).not.toThrow();
      expect(result.current.layoutMode).toBe('focus');
      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();
    });
  });

  describe('移动端强制 flash', () => {
    it('移动端 isForcedFlash=true 且 layoutMode=flash', () => {
      mockIsMobile(true);
      const { result } = renderHook(() => useQuizLayoutPref());
      expect(result.current.layoutMode).toBe('flash');
      expect(result.current.isForcedFlash).toBe(true);
    });

    it('移动端 localStorage 存 focus 依然强制返回 flash', () => {
      storage[STORAGE_KEY] = 'focus';
      mockIsMobile(true);
      const { result } = renderHook(() => useQuizLayoutPref());
      expect(result.current.layoutMode).toBe('flash');
      expect(result.current.isForcedFlash).toBe(true);
    });

    it('移动端 setLayoutMode 无效：值不变且不写 localStorage', () => {
      mockIsMobile(true);
      const { result } = renderHook(() => useQuizLayoutPref());
      act(() => {
        result.current.setLayoutMode('focus');
      });
      expect(result.current.layoutMode).toBe('flash');
      expect(window.localStorage.setItem).not.toHaveBeenCalled();
    });
  });
});

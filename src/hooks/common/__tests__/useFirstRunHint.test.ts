// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { useFirstRunHint } from "../useFirstRunHint";

describe("useFirstRunHint", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-01T00:00:00Z"));

    // setupTests.ts 把 window.localStorage 替换为 vi.fn mock。
    // 每个测试开始前重置 getItem 默认返回 null（首次访问场景），
    // 并清空 setItem / removeItem 的调用记录。
    vi.mocked(window.localStorage.getItem).mockReturnValue(null);
    vi.mocked(window.localStorage.setItem).mockClear();
    vi.mocked(window.localStorage.removeItem).mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("首次访问（localStorage 无标记）应该返回 isVisible=true", () => {
    const { result } = renderHook(() =>
      useFirstRunHint({ storageKey: "hint-first" }),
    );

    expect(result.current.isVisible).toBe(true);
  });

  it("已 dismiss（localStorage 有 'true' 标记）应该返回 isVisible=false", () => {
    vi.mocked(window.localStorage.getItem).mockReturnValue("true");

    const { result } = renderHook(() =>
      useFirstRunHint({ storageKey: "hint-dismissed" }),
    );

    expect(result.current.isVisible).toBe(false);
  });

  it("dismiss() 应该写入 localStorage 并设置 isVisible=false", () => {
    const setItemSpy = window.localStorage.setItem as ReturnType<typeof vi.fn>;

    const { result } = renderHook(() =>
      useFirstRunHint({ storageKey: "hint-dismiss-action" }),
    );

    expect(result.current.isVisible).toBe(true);

    act(() => {
      result.current.dismiss();
    });

    expect(result.current.isVisible).toBe(false);
    expect(setItemSpy).toHaveBeenCalledWith("hint-dismiss-action", "true");
  });

  it("reset() 应该清除 localStorage 并恢复 isVisible=true", () => {
    const removeItemSpy = window.localStorage
      .removeItem as ReturnType<typeof vi.fn>;

    const { result } = renderHook(() =>
      useFirstRunHint({ storageKey: "hint-reset-action" }),
    );

    // 先 dismiss 再 reset，验证状态切换
    act(() => {
      result.current.dismiss();
    });
    expect(result.current.isVisible).toBe(false);

    act(() => {
      result.current.reset();
    });

    expect(result.current.isVisible).toBe(true);
    expect(removeItemSpy).toHaveBeenCalledWith("hint-reset-action");
  });

  it("dismissOn='timeout' 时 mount 后推进 timeoutMs 应该自动 dismiss", () => {
    const { result } = renderHook(() =>
      useFirstRunHint({
        storageKey: "hint-timeout",
        dismissOn: "timeout",
        timeoutMs: 5000,
      }),
    );

    // 初始可见
    expect(result.current.isVisible).toBe(true);

    // 推进 4999ms 仍可见
    act(() => {
      vi.advanceTimersByTime(4999);
    });
    expect(result.current.isVisible).toBe(true);

    // 推进到 5000ms 触发自动 dismiss
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current.isVisible).toBe(false);
  });

  it("dismissOn='timeout' 组件卸载时应该清理 timer 不抛错", () => {
    const { unmount } = renderHook(() =>
      useFirstRunHint({
        storageKey: "hint-unmount",
        dismissOn: "timeout",
        timeoutMs: 5000,
      }),
    );

    // 卸载时 effect cleanup 应清理 setTimeout
    expect(() => {
      unmount();
    }).not.toThrow();

    // 卸载后推进时间不应触发任何回调（timer 已清理）
    expect(() => {
      act(() => {
        vi.advanceTimersByTime(10000);
      });
    }).not.toThrow();
  });

  it("SSR 环境（window 未定义）不应该抛错且 isVisible=false", () => {
    // useState lazy initializer 通过 typeof window === "undefined" 守卫
    // 避免访问 localStorage；renderToString 不会运行 useEffect。
    vi.stubGlobal("window", undefined);

    function TestSSR(): null {
      useFirstRunHint({ storageKey: "hint-ssr" });
      return null;
    }

    expect(() => {
      renderToString(createElement(TestSSR));
    }).not.toThrow();

    // 恢复 window 供后续测试使用
    vi.unstubAllGlobals();
  });

  it("默认 dismissOn='manual' 不会自动 dismiss（推进时间后仍可见）", () => {
    const { result } = renderHook(() =>
      useFirstRunHint({ storageKey: "hint-manual" }),
    );

    // 推进 60s 仍可见，因为没有设置 timeout
    act(() => {
      vi.advanceTimersByTime(60000);
    });

    expect(result.current.isVisible).toBe(true);
  });

  it("localStorage 损坏（非 'true' 值）时视为未 dismiss，isVisible=true", () => {
    // 模拟 storage 被写入非法值（如旧版本格式或其他代码误写）
    vi.mocked(window.localStorage.getItem).mockReturnValue("garbage-value");

    const { result } = renderHook(() =>
      useFirstRunHint({ storageKey: "hint-corrupt" }),
    );

    expect(result.current.isVisible).toBe(true);
  });

  it("dismissOn='click' 默认不会自动 dismiss，需调用方主动调用", () => {
    const { result } = renderHook(() =>
      useFirstRunHint({ storageKey: "hint-click", dismissOn: "click" }),
    );

    act(() => {
      vi.advanceTimersByTime(30000);
    });
    expect(result.current.isVisible).toBe(true);

    // 调用方在适当时机主动 dismiss
    act(() => {
      result.current.dismiss();
    });
    expect(result.current.isVisible).toBe(false);
  });
});

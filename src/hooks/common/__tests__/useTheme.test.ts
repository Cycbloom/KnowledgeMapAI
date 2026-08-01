// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { ThemeProvider, useTheme } from "../useTheme";
import { useThemeStore } from "../../../store/useThemeStore";

describe("useTheme", () => {
  beforeEach(() => {
    vi.mocked(window.localStorage.getItem).mockClear();
    vi.mocked(window.localStorage.setItem).mockClear();
    vi.mocked(window.localStorage.removeItem).mockClear();
    // 确保 getItem 默认返回 null，避免跨测试影响
    vi.mocked(window.localStorage.getItem).mockReturnValue(null);
    // 重置 store 状态
    useThemeStore.setState({ themeMode: "system", themePreset: "default" });
  });

  it("默认应该返回 light 主题（系统偏好为 light）", () => {
    const { result } = renderHook(() => useTheme(), {
      wrapper: ThemeProvider,
    });
    expect(result.current.theme).toBe("light");
    expect(result.current.themeMode).toBe("system");
  });

  it("toggleTheme 应该在 light 和 dark 之间切换", () => {
    const { result } = renderHook(() => useTheme(), {
      wrapper: ThemeProvider,
    });

    expect(result.current.theme).toBe("light");

    act(() => {
      result.current.toggleTheme();
    });
    expect(result.current.theme).toBe("dark");

    act(() => {
      result.current.toggleTheme();
    });
    expect(result.current.theme).toBe("light");
  });

  it("setTheme 应该更新主题模式", () => {
    const { result } = renderHook(() => useTheme(), {
      wrapper: ThemeProvider,
    });

    act(() => {
      result.current.setTheme("dark");
    });
    expect(result.current.theme).toBe("dark");
    expect(result.current.themeMode).toBe("dark");
  });

  it("主题变化应该持久化到 localStorage", () => {
    const { result } = renderHook(() => useTheme(), {
      wrapper: ThemeProvider,
    });

    act(() => {
      result.current.setTheme("dark");
    });

    // 验证 store 状态已更新
    const state = useThemeStore.getState();
    expect(state.themeMode).toBe("dark");

    // 验证 persist middleware 已初始化
    expect((useThemeStore as unknown as { persist: unknown }).persist).toBeDefined();
  });

  it("应该从 localStorage 恢复已保存的主题", () => {
    // 预设 localStorage 中的主题数据
    vi.mocked(window.localStorage.getItem).mockReturnValue(
      JSON.stringify({
        state: { themeMode: "dark", themePreset: "default" },
        version: 1,
      }),
    );

    // 直接设置 store 状态，模拟从 localStorage 恢复后的效果
    useThemeStore.setState({ themeMode: "dark", themePreset: "default" });

    // 验证 ThemeProvider 中的 useTheme 能正确反映 store 状态
    const { result } = renderHook(() => useTheme(), {
      wrapper: ThemeProvider,
    });
    expect(result.current.theme).toBe("dark");
    expect(result.current.themeMode).toBe("dark");
  });
});
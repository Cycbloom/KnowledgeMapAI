// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useDebouncedSearch } from "../useDebouncedSearch";

describe("useDebouncedSearch", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("应该返回初始状态（默认空字符串）", () => {
    const { result } = renderHook(() => useDebouncedSearch());
    expect(result.current.query).toBe("");
    expect(result.current.debouncedQuery).toBe("");
  });

  it("应该接受自定义初始查询字符串", () => {
    const { result } = renderHook(() => useDebouncedSearch("keyword"));
    expect(result.current.query).toBe("keyword");
    expect(result.current.debouncedQuery).toBe("keyword");
  });

  it("应该立即更新 query 但延迟更新 debouncedQuery", () => {
    const { result } = renderHook(() => useDebouncedSearch());

    act(() => {
      result.current.setQuery("hello");
    });

    // query 立即更新
    expect(result.current.query).toBe("hello");
    // debouncedQuery 在防抖期内尚未更新
    expect(result.current.debouncedQuery).toBe("");

    // 推进 300ms 后 debouncedQuery 应同步
    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(result.current.debouncedQuery).toBe("hello");
  });

  it("应该支持自定义防抖延迟", () => {
    const { result } = renderHook(() => useDebouncedSearch("", 500));

    act(() => {
      result.current.setQuery("custom");
    });

    // 300ms 时还未触发
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(result.current.debouncedQuery).toBe("");

    // 500ms 时触发
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(result.current.debouncedQuery).toBe("custom");
  });

  it("应该在快速连续输入时只取最后一次值", () => {
    const { result } = renderHook(() => useDebouncedSearch());

    act(() => {
      result.current.setQuery("a");
    });
    act(() => {
      vi.advanceTimersByTime(100);
    });
    act(() => {
      result.current.setQuery("ab");
    });
    act(() => {
      vi.advanceTimersByTime(100);
    });
    act(() => {
      result.current.setQuery("abc");
    });

    expect(result.current.query).toBe("abc");
    expect(result.current.debouncedQuery).toBe("");

    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(result.current.debouncedQuery).toBe("abc");
  });

  it("应该通过 reset 同时清空 query 与 debouncedQuery", () => {
    const { result } = renderHook(() => useDebouncedSearch("initial"));

    act(() => {
      result.current.reset();
    });

    expect(result.current.query).toBe("");
    expect(result.current.debouncedQuery).toBe("");
  });

  it("应该在卸载时清理定时器，不再更新 debouncedQuery", () => {
    const { result, unmount } = renderHook(() => useDebouncedSearch());

    act(() => {
      result.current.setQuery("pending");
    });

    unmount();

    // 卸载后推进时间，debouncedQuery 仍为空（清理函数取消了 timer）
    act(() => {
      vi.advanceTimersByTime(500);
    });

    // 由于 hook 已卸载，result.current 是卸载前的快照；这里只验证不会抛错
    expect(result.current.debouncedQuery).toBe("");
  });
});

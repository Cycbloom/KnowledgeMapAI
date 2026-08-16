// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useSaveFeedback } from "../useSaveFeedback";

describe("useSaveFeedback", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("初始 saved 为 false", () => {
    const { result } = renderHook(() => useSaveFeedback());
    expect(result.current.saved).toBe(false);
  });

  it("notify 后 saved 变 true", () => {
    const { result } = renderHook(() => useSaveFeedback());
    act(() => result.current.notify());
    expect(result.current.saved).toBe(true);
  });

  it("notify 后在持续时间后自动复位为 false", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useSaveFeedback(1500));
    act(() => result.current.notify());
    expect(result.current.saved).toBe(true);
    act(() => {
      vi.advanceTimersByTime(1500);
    });
    expect(result.current.saved).toBe(false);
  });

  it("在复位前再次 notify 会延长显示时间", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useSaveFeedback(1500));
    act(() => result.current.notify());
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    act(() => result.current.notify());
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current.saved).toBe(true);
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(result.current.saved).toBe(false);
  });
});
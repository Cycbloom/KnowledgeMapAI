// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { StrictMode, createElement, type ReactNode } from "react";
import { renderHook, act } from "@testing-library/react";
import { useAutoSave } from "../useAutoSave";

describe("useAutoSave", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("自动保存应该在防抖延迟后触发，并使用最新数据调用回调", () => {
    const onSave = vi.fn();
    const { rerender } = renderHook(
      ({ value }) => useAutoSave({ value, onSave, delay: 1000 }),
      { initialProps: { value: "initial" } },
    );

    // 首次渲染不触发保存
    expect(onSave).not.toHaveBeenCalled();

    // 更新 value 触发防抖定时器
    rerender({ value: "updated" });

    // 防抖窗口内未触发
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(onSave).not.toHaveBeenCalled();

    // 到达防抖延迟后触发
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith("updated");
  });

  it("防抖合并：多次变化只触发一次保存，使用最终值", () => {
    const onSave = vi.fn();
    const { rerender } = renderHook(
      ({ value }) => useAutoSave({ value, onSave, delay: 1000 }),
      { initialProps: { value: "initial" } },
    );

    // 防抖窗口内连续变化
    rerender({ value: "a" });
    act(() => {
      vi.advanceTimersByTime(200);
    });
    rerender({ value: "ab" });
    act(() => {
      vi.advanceTimersByTime(200);
    });
    rerender({ value: "abc" });
    act(() => {
      vi.advanceTimersByTime(200);
    });

    // 尚未到达延迟时间，未触发
    expect(onSave).not.toHaveBeenCalled();

    // 从最后一次变化推进 1000ms 到达延迟
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith("abc");
  });

  it("reset 应该取消待执行的保存", () => {
    const onSave = vi.fn();
    const { result, rerender } = renderHook(
      ({ value }) => useAutoSave({ value, onSave, delay: 1000 }),
      { initialProps: { value: "initial" } },
    );

    rerender({ value: "pending" });

    // 在防抖窗口内取消
    act(() => {
      result.current.reset();
    });

    // 推进时间
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(onSave).not.toHaveBeenCalled();
    expect(result.current.status).toBe("idle");
  });

  it("组件卸载时应该清理待执行的定时器", () => {
    const onSave = vi.fn();
    const { rerender, unmount } = renderHook(
      ({ value }) => useAutoSave({ value, onSave, delay: 1000 }),
      { initialProps: { value: "initial" } },
    );

    rerender({ value: "pending" });

    // 卸载组件（effect cleanup 应清除定时器）
    expect(() => {
      unmount();
    }).not.toThrow();

    // 卸载后推进时间，不应触发保存
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(onSave).not.toHaveBeenCalled();
  });

  it("手动 save 应立即触发保存", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(
      () => useAutoSave({ value: "test", onSave, delay: 3000 }),
    );

    await act(async () => {
      await result.current.save();
    });

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith("test");
  });

  it("保存状态应该正确更新", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(
      () => useAutoSave({ value: "test", onSave, delay: 3000 }),
    );

    // 初始状态为 idle
    expect(result.current.status).toBe("idle");

    // 手动保存
    await act(async () => {
      await result.current.save();
    });

    // 保存成功后状态为 saved
    expect(result.current.status).toBe("saved");
  });

  it("StrictMode 下首次挂载（值未变）不触发自动保存（回归：未修改也保存）", () => {
    const onSave = vi.fn();
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(StrictMode, null, children);
    const { rerender, unmount } = renderHook(
      ({ value }) => useAutoSave({ value, onSave, delay: 1000 }),
      { initialProps: { value: "initial" }, wrapper },
    );

    // StrictMode 会让 effect 运行两次；值未变不应设置定时器 → 推进时间也不应保存
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(onSave).not.toHaveBeenCalled();

    // 值真正变化后才触发
    rerender({ value: "updated" });
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith("updated");

    unmount();
  });

  it("值改回已保存值时不重复触发保存", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const { rerender } = renderHook(
      ({ value }) => useAutoSave({ value, onSave, delay: 1000 }),
      { initialProps: { value: "initial" } },
    );

    // 首次变化 → 自动保存 "edited"
    rerender({ value: "edited" });
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith("edited");

    // 改回与已保存值不同的值 → 仍是新变更，会再保存
    rerender({ value: "initial" });
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    expect(onSave).toHaveBeenCalledTimes(2);
    expect(onSave).toHaveBeenCalledWith("initial");

    // 值不再变化 → 不再触发保存
    rerender({ value: "initial" });
    await act(async () => {
      vi.advanceTimersByTime(2000);
    });
    expect(onSave).toHaveBeenCalledTimes(2);
  });
});
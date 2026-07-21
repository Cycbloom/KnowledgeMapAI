// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useMicrofeedback } from "../useMicrofeedback";

describe("useMicrofeedback", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("初始 state 应为 idle", () => {
    const { result } = renderHook(() => useMicrofeedback());
    expect(result.current.state).toBe("idle");
    expect(result.current.isIdle).toBe(true);
    expect(result.current.isPending).toBe(false);
    expect(result.current.isSuccess).toBe(false);
    expect(result.current.isError).toBe(false);
  });

  it("调用 trigger 后 state 应为 pending", () => {
    const { result } = renderHook(() => useMicrofeedback());
    act(() => {
      result.current.trigger();
    });
    expect(result.current.state).toBe("pending");
    expect(result.current.isPending).toBe(true);
  });

  it("调用 succeed 后 state 应为 success，1.5s 后自动回 idle", () => {
    const { result } = renderHook(() => useMicrofeedback());
    act(() => {
      result.current.trigger();
    });
    act(() => {
      result.current.succeed();
    });
    expect(result.current.state).toBe("success");
    expect(result.current.isSuccess).toBe(true);

    // 推进 1.4s 不应复位
    act(() => {
      vi.advanceTimersByTime(1400);
    });
    expect(result.current.state).toBe("success");

    // 推进至 1.5s 应自动复位
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(result.current.state).toBe("idle");
    expect(result.current.isIdle).toBe(true);
  });

  it("调用 fail 后 state 应为 error，不会自动复位", () => {
    const { result } = renderHook(() => useMicrofeedback());
    act(() => {
      result.current.trigger();
    });
    act(() => {
      result.current.fail();
    });
    expect(result.current.state).toBe("error");
    expect(result.current.isError).toBe(true);

    // 推进 5s 仍应保持 error
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(result.current.state).toBe("error");
  });

  it("reset 应强制回到 idle 并清理 timer", () => {
    const { result } = renderHook(() => useMicrofeedback());
    act(() => {
      result.current.trigger();
    });
    act(() => {
      result.current.succeed();
    });
    expect(result.current.state).toBe("success");

    act(() => {
      result.current.reset();
    });
    expect(result.current.state).toBe("idle");

    // 推进 5s 后仍应保持 idle（说明 timer 已被清理，没有再次 setState）
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(result.current.state).toBe("idle");
  });

  it("run 成功路径：trigger → succeed → 自动复位", async () => {
    const { result } = renderHook(() => useMicrofeedback());
    const value = "ok";
    const promise = Promise.resolve(value);

    let resolved: unknown = undefined;
    await act(async () => {
      resolved = await result.current.run(promise);
    });

    expect(resolved).toBe(value);
    expect(result.current.state).toBe("success");
    expect(result.current.isSuccess).toBe(true);

    act(() => {
      vi.advanceTimersByTime(1500);
    });
    expect(result.current.state).toBe("idle");
  });

  it("run 失败路径：trigger → fail（promise reject 仍 throw）", async () => {
    const { result } = renderHook(() => useMicrofeedback());
    const error = new Error("boom");

    await act(async () => {
      await expect(result.current.run(Promise.reject(error))).rejects.toThrow("boom");
    });

    expect(result.current.state).toBe("error");
    expect(result.current.isError).toBe(true);
  });

  it("组件卸载时应清理 timer，不报错", () => {
    const { result, unmount } = renderHook(() => useMicrofeedback());
    act(() => {
      result.current.trigger();
    });
    act(() => {
      result.current.succeed();
    });
    // 此时 timer 已计划但未触发
    expect(result.current.state).toBe("success");

    expect(() => {
      unmount();
    }).not.toThrow();

    // 推进时间，timer 应已被清理，不会触发任何 setState（不报错）
    expect(() => {
      act(() => {
        vi.advanceTimersByTime(5000);
      });
    }).not.toThrow();
  });

  it("自定义 resetMs 应生效", () => {
    const { result } = renderHook(() =>
      useMicrofeedback({ resetMs: 3000 }),
    );
    act(() => {
      result.current.trigger();
    });
    act(() => {
      result.current.succeed();
    });
    expect(result.current.state).toBe("success");

    // 1.5s 不应复位（默认值已失效）
    act(() => {
      vi.advanceTimersByTime(1500);
    });
    expect(result.current.state).toBe("success");

    // 再推进 1.5s（共 3s）应复位
    act(() => {
      vi.advanceTimersByTime(1500);
    });
    expect(result.current.state).toBe("idle");
  });
});

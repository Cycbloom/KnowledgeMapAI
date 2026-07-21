// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { usePersistedListState } from "../usePersistedListState";

describe("usePersistedListState", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // 固定系统时间，便于 TTL 测试断言
    vi.setSystemTime(new Date("2024-01-01T00:00:00Z"));
    // sessionStorage 是 jsdom 原生实现，需手动清理
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("初始无存储值时应该返回 defaultValue", () => {
    // localStorage 已被 setupTests.ts mock 为返回 null
    const { result } = renderHook(() =>
      usePersistedListState("empty-key", "default-value"),
    );

    expect(result.current[0]).toBe("default-value");
  });

  it("持久化读取：storage 中有值时应该返回存储的值", () => {
    // 用 sessionStorage（jsdom 原生）模拟 A 会话写入的数据
    const storedEntry = JSON.stringify({
      value: "stored-by-session-a",
      ts: Date.now(),
    });
    sessionStorage.setItem("persist-key", storedEntry);

    // 模拟 B 会话：新 hook 实例从 storage 读取
    const { result } = renderHook(() =>
      usePersistedListState("persist-key", "default-value", {
        storage: "sessionStorage",
      }),
    );

    expect(result.current[0]).toBe("stored-by-session-a");
  });

  it("TTL 过期时应该返回 defaultValue 并清除存储", () => {
    // 预置 10 秒前的过期记录
    const expiredTs = Date.now() - 10_000;
    sessionStorage.setItem(
      "ttl-key",
      JSON.stringify({ value: "expired", ts: expiredTs }),
    );

    const { result } = renderHook(() =>
      usePersistedListState("ttl-key", "default-value", {
        storage: "sessionStorage",
        ttlMs: 5_000,
      }),
    );

    expect(result.current[0]).toBe("default-value");
    // 验证过期条目已被清除（readStored 检测到过期时调用 removeItem）
    expect(sessionStorage.getItem("ttl-key")).toBeNull();
  });

  it("写入 debounce：100ms 内 3 次写入只触发 1 次 storage 写入", () => {
    const setItemSpy = window.localStorage.setItem as ReturnType<typeof vi.fn>;

    const { result } = renderHook(() =>
      usePersistedListState("debounce-key", "default"),
    );

    // 初始 mount 不应有写入
    expect(setItemSpy).not.toHaveBeenCalled();

    // 100ms 内连续 3 次写入
    act(() => {
      result.current[1]("a");
    });
    act(() => {
      vi.advanceTimersByTime(50);
      result.current[1]("b");
    });
    act(() => {
      vi.advanceTimersByTime(50);
      result.current[1]("c");
    });

    // debounce 窗口内还未触发 storage 写入
    expect(setItemSpy).not.toHaveBeenCalled();

    // 推进至 debounce 结束（200ms），应只触发 1 次写入
    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(setItemSpy).toHaveBeenCalledTimes(1);
    const callArg = setItemSpy.mock.calls[0]?.[1] as string;
    const parsed = JSON.parse(callArg) as { value: string; ts: number };
    expect(parsed.value).toBe("c");
  });

  it("跨 tab 同步：storage 事件触发后 state 应该自动更新", () => {
    const { result } = renderHook(() =>
      usePersistedListState("sync-key", "default"),
    );

    expect(result.current[0]).toBe("default");

    act(() => {
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: "sync-key",
          newValue: JSON.stringify({
            value: "from-other-tab",
            ts: Date.now(),
          }),
        }),
      );
    });

    expect(result.current[0]).toBe("from-other-tab");
  });

  it("跨 tab 同步：不匹配的 key 不应该更新 state", () => {
    const { result } = renderHook(() =>
      usePersistedListState("sync-key-a", "default"),
    );

    act(() => {
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: "sync-key-b",
          newValue: JSON.stringify({
            value: "other-key-value",
            ts: Date.now(),
          }),
        }),
      );
    });

    expect(result.current[0]).toBe("default");
  });

  it("跨 tab 同步：sessionStorage 不应该监听 storage 事件", () => {
    const { result } = renderHook(() =>
      usePersistedListState("session-sync-key", "default", {
        storage: "sessionStorage",
      }),
    );

    act(() => {
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: "session-sync-key",
          newValue: JSON.stringify({
            value: "should-not-sync",
            ts: Date.now(),
          }),
        }),
      );
    });

    expect(result.current[0]).toBe("default");
  });

  it("SSR 环境下（window 未定义）不应该抛错并返回 defaultValue", () => {
    // 模拟 SSR：临时移除 window。
    // SSR 中 useEffect 不会执行，但 useState 的 lazy initializer 会运行，
    // hook body 通过 typeof window === "undefined" 守卫避免访问 window，
    // 因此不会抛错，且 lazy initializer 返回 defaultValue。
    vi.stubGlobal("window", undefined);

    function TestSSR(): null {
      usePersistedListState<string>("ssr-key", "ssr-default");
      return null;
    }

    expect(() => {
      renderToString(createElement(TestSSR));
    }).not.toThrow();

    // 恢复 window 供后续测试使用
    vi.unstubAllGlobals();
  });

  it("clear() 应该清除存储并重置为 defaultValue", () => {
    const removeItemSpy = window.localStorage
      .removeItem as ReturnType<typeof vi.fn>;

    const { result } = renderHook(() =>
      usePersistedListState("clear-key", "default-value"),
    );

    // 用户设置一个值（触发 debounced 写入）
    act(() => {
      result.current[1]("user-set");
    });
    act(() => {
      vi.advanceTimersByTime(200);
    });

    // 调用 clear
    act(() => {
      result.current[2].clear();
    });

    expect(result.current[0]).toBe("default-value");
    expect(removeItemSpy).toHaveBeenCalledWith("clear-key");
  });

  it("clear() 后不应该把 defaultValue 写回 storage", () => {
    const setItemSpy = window.localStorage.setItem as ReturnType<typeof vi.fn>;

    const { result } = renderHook(() =>
      usePersistedListState("clear-no-write-key", "default-value"),
    );

    act(() => {
      result.current[1]("user-set");
    });
    act(() => {
      vi.advanceTimersByTime(200);
    });
    setItemSpy.mockClear();

    act(() => {
      result.current[2].clear();
    });
    // 推进时间，确认 clear 触发的 setState 没有引发回写
    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(setItemSpy).not.toHaveBeenCalled();
  });

  it("sessionStorage 选项生效时应该写入 sessionStorage 而非 localStorage", () => {
    const localStorageSetItemSpy = window.localStorage
      .setItem as ReturnType<typeof vi.fn>;

    const { result } = renderHook(() =>
      usePersistedListState("session-option-key", "default", {
        storage: "sessionStorage",
      }),
    );

    act(() => {
      result.current[1]("session-value");
    });
    act(() => {
      vi.advanceTimersByTime(200);
    });

    // sessionStorage 应该被写入
    const raw = sessionStorage.getItem("session-option-key");
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw ?? "{}") as { value: string; ts: number };
    expect(parsed.value).toBe("session-value");

    // localStorage 不应该被写入
    expect(localStorageSetItemSpy).not.toHaveBeenCalled();
  });

  it("setValue 支持函数式更新", () => {
    const { result } = renderHook(() =>
      usePersistedListState("fn-key", 0),
    );

    act(() => {
      result.current[1]((prev) => prev + 1);
    });
    act(() => {
      result.current[1]((prev) => prev + 1);
    });

    expect(result.current[0]).toBe(2);
  });

  it("存储损坏（非法 JSON）时不应抛错并返回 defaultValue", () => {
    sessionStorage.setItem("corrupt-key", "{invalid json");

    const { result } = renderHook(() =>
      usePersistedListState("corrupt-key", "default-value", {
        storage: "sessionStorage",
      }),
    );

    expect(result.current[0]).toBe("default-value");
  });

  it("组件卸载时应该清理 debounce timer 不抛错", () => {
    const { result, unmount } = renderHook(() =>
      usePersistedListState("unmount-key", "default"),
    );

    // 触发一次 setValue 但不推进时间（debounce timer 在等待中）
    act(() => {
      result.current[1]("pending-value");
    });

    expect(() => {
      unmount();
    }).not.toThrow();

    // 卸载后推进时间不应抛错（timer 已被清理）
    expect(() => {
      act(() => {
        vi.advanceTimersByTime(500);
      });
    }).not.toThrow();
  });
});

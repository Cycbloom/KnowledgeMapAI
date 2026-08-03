// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { createElement, type MutableRefObject, type RefObject } from "react";
import { renderToString } from "react-dom/server";
import { useScrollRestoration } from "../useScrollRestoration";

/**
 * 创建模拟的滚动容器：scrollTop 通过 getter/setter 持久化到闭包变量，
 * scrollTo mock 会同步更新 scrollTop，便于断言调用参数与最终状态。
 */
function createMockContainer(initialScrollTop = 0): HTMLDivElement {
  const div = document.createElement("div");
  let scrollTop = initialScrollTop;
  Object.defineProperty(div, "scrollTop", {
    get: () => scrollTop,
    set: (v: number) => {
      scrollTop = v;
    },
    configurable: true,
  });
  const scrollToMock = vi.fn(({ top }: ScrollToOptions) => {
    scrollTop = top;
  });
  Object.defineProperty(div, "scrollTo", {
    value: scrollToMock,
    writable: true,
    configurable: true,
  });
  return div;
}

/**
 * 在 renderHook 回调中（effects 之前）将容器附加到 ref。
 * 模拟 React 在 commit 阶段将 DOM 元素赋值给 ref 的行为，
 * 确保 useEffect 运行时 ref.current 已就绪。
 */
function attachContainer(
  ref: RefObject<HTMLDivElement>,
  container: HTMLDivElement,
): void {
  (ref as MutableRefObject<HTMLDivElement | null>).current = container;
}

describe("useScrollRestoration", () => {
  beforeEach(() => {
    // rAF 同步执行：effect 内 schedule 后立即触发 scrollTo，便于断言
    vi.stubGlobal(
      "requestAnimationFrame",
      (cb: FrameRequestCallback): number => {
        cb(0);
        return 0;
      },
    );
    vi.stubGlobal("cancelAnimationFrame", (_id: number): void => {
      // no-op：rAF 已同步执行，无需取消
    });
    sessionStorage.clear();
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("无存储值时应该从顶部开始", () => {
    const container = createMockContainer();
    renderHook(() => {
      const ref = useScrollRestoration<HTMLDivElement>("test-key");
      attachContainer(ref, container);
      return ref;
    });

    expect(container.scrollTo).not.toHaveBeenCalled();
    expect(container.scrollTop).toBe(0);
  });

  it("卸载时应该保存 scrollTop 到 storage", () => {
    const container = createMockContainer();
    const { unmount } = renderHook(() => {
      const ref = useScrollRestoration<HTMLDivElement>("test-key");
      attachContainer(ref, container);
      return ref;
    });

    // 模拟用户滚动
    container.scrollTop = 500;

    unmount();

    const stored = sessionStorage.getItem("test-key");
    expect(stored).not.toBeNull();
    const parsed = JSON.parse(stored ?? "{}") as {
      scrollTop: number;
      ts: number;
    };
    expect(parsed.scrollTop).toBe(500);
    expect(typeof parsed.ts).toBe("number");
  });

  it("重新挂载时应该恢复 scrollTop", () => {
    // 预填充 storage（模拟上次会话保存的位置）
    sessionStorage.setItem(
      "test-key",
      JSON.stringify({ scrollTop: 500, ts: Date.now() }),
    );

    const container = createMockContainer();
    renderHook(() => {
      const ref = useScrollRestoration<HTMLDivElement>("test-key");
      attachContainer(ref, container);
      return ref;
    });

    // rAF 同步执行后应已调用 scrollTo 恢复到 500
    expect(container.scrollTo).toHaveBeenCalledWith({ top: 500 });
    expect(container.scrollTop).toBe(500);
  });

  it("TTL 过期时不应该恢复，应该从顶部开始", () => {
    // 设置 10 分钟前的过期记录（默认 TTL 为 5 分钟）
    const expiredTs = Date.now() - 10 * 60 * 1000;
    sessionStorage.setItem(
      "test-key",
      JSON.stringify({ scrollTop: 500, ts: expiredTs }),
    );

    const container = createMockContainer();
    renderHook(() => {
      const ref = useScrollRestoration<HTMLDivElement>("test-key", {
        ttlMs: 5 * 60 * 1000,
      });
      attachContainer(ref, container);
      return ref;
    });

    expect(container.scrollTo).not.toHaveBeenCalled();
    expect(container.scrollTop).toBe(0);
  });

  it("deps 变化时不应该恢复，应该回到顶部", () => {
    // 预填充 storage（确保首次挂载会尝试恢复）
    sessionStorage.setItem(
      "test-key",
      JSON.stringify({ scrollTop: 500, ts: Date.now() }),
    );

    const container = createMockContainer();
    const { rerender } = renderHook(
      ({ deps }) => {
        const ref = useScrollRestoration<HTMLDivElement>("test-key", { deps });
        attachContainer(ref, container);
        return ref;
      },
      { initialProps: { deps: ["a"] as unknown[] } },
    );

    // 初次挂载应该恢复到 500
    expect(container.scrollTo).toHaveBeenCalledWith({ top: 500 });

    // 清除初次挂载的调用记录
    (container.scrollTo as ReturnType<typeof vi.fn>).mockClear();

    // 用户随后滚动到其他位置
    container.scrollTop = 800;

    // 修改 deps → 不应恢复，应回到顶部
    rerender({ deps: ["b"] });

    expect(container.scrollTo).toHaveBeenCalledWith({ top: 0 });
    expect(container.scrollTo).toHaveBeenCalledTimes(1);
  });

  it("SSR 环境下不应该抛错", () => {
    // 使用 renderToString 模拟 SSR 渲染：useEffect 不会执行，
    // 但 hook body 会运行。hook body 不应访问 window/document，
    // 因此在 SSR 中不会抛错。
    function TestSSR(): null {
      useScrollRestoration<HTMLDivElement>("ssr-test-key");
      return null;
    }

    expect(() => {
      renderToString(createElement(TestSSR));
    }).not.toThrow();
  });

  it("支持通过 storage 选项指定 localStorage", () => {
    // setupTests.ts 将 window.localStorage 替换为 vi.fn mock，
    // 此处通过 mockReturnValueOnce 模拟已存在存储值
    const stored = JSON.stringify({ scrollTop: 300, ts: Date.now() });
    const mock = window.localStorage as unknown as {
      getItem: ReturnType<typeof vi.fn>;
    };
    mock.getItem.mockReturnValueOnce(stored);

    const container = createMockContainer();
    renderHook(() => {
      const ref = useScrollRestoration<HTMLDivElement>("local-key", {
        storage: "localStorage",
      });
      attachContainer(ref, container);
      return ref;
    });

    expect(container.scrollTo).toHaveBeenCalledWith({ top: 300 });
    expect(container.scrollTop).toBe(300);
  });

  it("storage 损坏（非法 JSON）时不应抛错，从顶部开始", () => {
    sessionStorage.setItem("test-key", "{invalid json");

    const container = createMockContainer();
    renderHook(() => {
      const ref = useScrollRestoration<HTMLDivElement>("test-key");
      attachContainer(ref, container);
      return ref;
    });

    expect(container.scrollTo).not.toHaveBeenCalled();
    expect(container.scrollTop).toBe(0);
  });

  it("空 deps 数组时仅在首次挂载恢复，不触发重置", () => {
    sessionStorage.setItem(
      "test-key",
      JSON.stringify({ scrollTop: 500, ts: Date.now() }),
    );

    const container = createMockContainer();
    const { rerender } = renderHook(
      ({ label: _label }: { label: string }) => {
        const ref = useScrollRestoration<HTMLDivElement>("test-key", {
          deps: [],
        });
        attachContainer(ref, container);
        return ref;
      },
      { initialProps: { label: "first" } },
    );

    // 首次挂载恢复
    expect(container.scrollTo).toHaveBeenCalledWith({ top: 500 });
    (container.scrollTo as ReturnType<typeof vi.fn>).mockClear();

    // rerender 但 deps 数组内容未变（始终为 []），不应触发重置
    rerender({ label: "second" });
    expect(container.scrollTo).not.toHaveBeenCalled();
  });
});

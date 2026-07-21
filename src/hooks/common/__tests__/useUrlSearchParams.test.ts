// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { useUrlSearchParams } from "../useUrlSearchParams";

interface TestState {
  view: string;
  sort: string;
}

/** 默认字段配置：'card' / 'updatedAt' 为默认值，serialize 返回 undefined 不写入 URL */
const defaultFields = [
  {
    key: "view" as const,
    urlParam: "view",
    serialize: (v: string) => (v === "card" ? undefined : v),
    deserialize: (s: string | null) => s ?? undefined,
  },
  {
    key: "sort" as const,
    urlParam: "sort",
    serialize: (v: string) => (v === "updatedAt" ? undefined : v),
    deserialize: (s: string | null) => s ?? undefined,
  },
];

describe("useUrlSearchParams", () => {
  beforeEach(() => {
    // 每个 test 开始前重置 URL，避免前一个 test 残留的查询参数影响
    window.history.replaceState({}, "", "/");
  });

  afterEach(() => {
    // 每个 test 结束后再次重置 URL
    window.history.replaceState({}, "", "/");
    // 恢复 spyOn 的原生方法，避免影响后续 test
    vi.restoreAllMocks();
  });

  it("state 变化时应该将非默认值同步到 URL", () => {
    let state: TestState = { view: "card", sort: "updatedAt" };
    const setState = vi.fn((updates: Partial<TestState>) => {
      state = { ...state, ...updates };
    });

    const { rerender } = renderHook(
      ({ s }) => useUrlSearchParams(s, setState, { fields: defaultFields }),
      { initialProps: { s: state } },
    );

    // 初始 URL 应为空（state 全为默认值）
    expect(window.location.search).toBe("");

    // 改变 view 为 'list'（非默认值）
    state = { ...state, view: "list" };
    rerender({ s: state });

    expect(window.location.search).toBe("?view=list");
  });

  it("默认值不应出现在 URL 中（serialize 返回 undefined 时删除参数）", () => {
    let state: TestState = { view: "list", sort: "title" };
    const setState = vi.fn();

    const { rerender } = renderHook(
      ({ s }) => useUrlSearchParams(s, setState, { fields: defaultFields }),
      { initialProps: { s: state } },
    );

    // 初始 state 全为非默认值，URL 应该包含两个参数
    expect(window.location.search).toBe("?view=list&sort=title");

    // 改回默认值
    state = { view: "card", sort: "updatedAt" };
    rerender({ s: state });

    // URL 应该被清空（默认值不出现在 URL）
    expect(window.location.search).toBe("");
  });

  it("popstate 事件应该反向更新 state（浏览器前进/后退）", () => {
    const state: TestState = { view: "card", sort: "updatedAt" };
    const setState = vi.fn();

    renderHook(() =>
      useUrlSearchParams(state, setState, { fields: defaultFields }),
    );

    // 推入一个新 URL（pushState 不会自动触发 popstate）
    window.history.pushState({}, "", "/?view=list");

    // 手动触发 popstate 事件（模拟浏览器后退按钮）
    act(() => {
      window.dispatchEvent(new PopStateEvent("popstate"));
    });

    expect(setState).toHaveBeenCalledWith({ view: "list" });
  });

  it("replace=true（默认）时应该使用 replaceState 而非 pushState", () => {
    const pushStateSpy = vi.spyOn(window.history, "pushState");
    const replaceStateSpy = vi.spyOn(window.history, "replaceState");

    let state: TestState = { view: "card", sort: "updatedAt" };
    const setState = vi.fn();

    const { rerender } = renderHook(
      ({ s }) =>
        useUrlSearchParams(s, setState, {
          fields: defaultFields,
          replace: true,
        }),
      { initialProps: { s: state } },
    );

    // 改变 state 触发 URL 更新
    state = { ...state, view: "list" };
    rerender({ s: state });

    expect(pushStateSpy).not.toHaveBeenCalled();
    expect(replaceStateSpy).toHaveBeenCalled();
  });

  it("replace=false 时应该使用 pushState", () => {
    const pushStateSpy = vi.spyOn(window.history, "pushState");

    let state: TestState = { view: "card", sort: "updatedAt" };
    const setState = vi.fn();

    const { rerender } = renderHook(
      ({ s }) =>
        useUrlSearchParams(s, setState, {
          fields: defaultFields,
          replace: false,
        }),
      { initialProps: { s: state } },
    );

    state = { ...state, view: "list" };
    rerender({ s: state });

    expect(pushStateSpy).toHaveBeenCalled();
  });

  it("deserialize 返回 undefined 时应该保留原 state 不变", () => {
    const state: TestState = { view: "card", sort: "updatedAt" };
    const setState = vi.fn();

    // 字段配置：deserialize 总是返回 undefined（表示无法解析）
    const fields = [
      {
        key: "view" as const,
        urlParam: "view",
        serialize: (v: string) => (v === "card" ? undefined : v),
        deserialize: () => undefined,
      },
    ];

    renderHook(() => useUrlSearchParams(state, setState, { fields }));

    // 推入 URL 并触发 popstate
    window.history.pushState({}, "", "/?view=invalid");
    act(() => {
      window.dispatchEvent(new PopStateEvent("popstate"));
    });

    // setState 不应被调用（因为 deserialize 返回 undefined，无可应用的更新）
    expect(setState).not.toHaveBeenCalled();
  });

  it("SSR 安全：服务端渲染时不抛错", () => {
    // 使用 react-dom/server 的 renderToString 模拟 SSR：
    // SSR 中 useEffect 不会执行，hook 函数体也不应同步访问 window
    function TestComponent() {
      useUrlSearchParams(
        { view: "card" },
        () => {},
        {
          fields: [
            {
              key: "view" as const,
              urlParam: "view",
              serialize: () => undefined,
              deserialize: () => undefined,
            },
          ],
        },
      );
      return null;
    }

    expect(() => {
      renderToString(createElement(TestComponent));
    }).not.toThrow();
  });

  it("避免循环：state 变化触发 URL 更新不应再次触发 state 变化", () => {
    let state: TestState = { view: "card", sort: "updatedAt" };
    const setState = vi.fn((updates: Partial<TestState>) => {
      state = { ...state, ...updates };
    });

    const { rerender } = renderHook(
      ({ s }) => useUrlSearchParams(s, setState, { fields: defaultFields }),
      { initialProps: { s: state } },
    );

    // 清除 mount 期间的任何调用（init sync 无 URL 参数时不会调用）
    setState.mockClear();

    // 改变 state 触发 URL 更新
    state = { ...state, view: "list" };
    rerender({ s: state });

    // URL 应该已更新
    expect(window.location.search).toBe("?view=list");

    // setState 不应被 hook 自身调用（replaceState 不会触发 popstate，
    // 因此没有反向 state 更新，无循环）
    expect(setState).not.toHaveBeenCalled();
  });

  it("初始化时若 URL 有参数应优先用 URL 值更新 state", () => {
    // 在渲染前预设 URL
    window.history.replaceState({}, "", "/?view=list&sort=title");

    const state: TestState = { view: "card", sort: "updatedAt" };
    const setState = vi.fn();

    renderHook(() =>
      useUrlSearchParams(state, setState, { fields: defaultFields }),
    );

    // mount 时 URL 参数应覆盖初始 state
    expect(setState).toHaveBeenCalledWith({
      view: "list",
      sort: "title",
    });
  });

  it("URL 无参数时不应在 mount 调用 setState", () => {
    const state: TestState = { view: "card", sort: "updatedAt" };
    const setState = vi.fn();

    renderHook(() =>
      useUrlSearchParams(state, setState, { fields: defaultFields }),
    );

    // URL 为空，无需 setState
    expect(setState).not.toHaveBeenCalled();
  });

  it("URL 中未在 fields 配置的参数应被忽略", () => {
    // URL 包含未配置的 unknownParam，应被忽略
    window.history.replaceState({}, "", "/?view=list&unknownParam=ignored");

    const state: TestState = { view: "card", sort: "updatedAt" };
    const setState = vi.fn();

    renderHook(() =>
      useUrlSearchParams(state, setState, { fields: defaultFields }),
    );

    // 只应同步 view 字段，unknownParam 被忽略
    expect(setState).toHaveBeenCalledWith({ view: "list" });
    expect(setState).not.toHaveBeenCalledWith({
      view: "list",
      unknownParam: "ignored",
    });
  });
});

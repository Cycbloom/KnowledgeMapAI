// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { useState, useEffect } from "react";
import type { ReactNode } from "react";
import toast from "react-hot-toast";
import { UpdatePrompt } from "../UpdatePrompt";

// 共享 mock 状态：通过 vi.hoisted 确保 vi.mock 工厂可访问
const swState = vi.hoisted(() => ({
  needRefresh: false,
  setNeedRefresh: vi.fn(),
  updateServiceWorker: vi.fn().mockResolvedValue(undefined),
}));

// toast 共享状态：捕获 toast 回调内容并通知 ToastContainer 重渲染
const toastShared = vi.hoisted(() => ({
  currentContent: null as ReactNode | null,
  listeners: new Set<() => void>(),
}));

vi.mock("virtual:pwa-register/react", () => ({
  useRegisterSW: () => ({
    needRefresh: [swState.needRefresh, swState.setNeedRefresh],
    updateServiceWorker: swState.updateServiceWorker,
  }),
}));

vi.mock("react-hot-toast", () => {
  const defaultFn = Object.assign(
    vi.fn((content: unknown, options?: { id?: string }) => {
      const id = options?.id ?? "test-toast-id";
      if (typeof content === "function") {
        toastShared.currentContent = (
          content as (t: { id: string; visible: boolean }) => ReactNode
        )({ id, visible: true });
      } else {
        toastShared.currentContent = content as ReactNode;
      }
      toastShared.listeners.forEach((l) => l());
      return id;
    }),
    {
      dismiss: vi.fn(() => {
        toastShared.currentContent = null;
        toastShared.listeners.forEach((l) => l());
      }),
    },
  );
  return { default: defaultFn };
});

// 辅助组件：将 mock 捕获的 toast 内容渲染到 DOM 以便测试交互
function ToastContainer() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const listener = () => setTick((t) => t + 1);
    toastShared.listeners.add(listener);
    // 若 UpdatePrompt 的 useEffect 已先于本组件注册监听器而调用 toast，
    // currentContent 已被设置但本组件尚未收到通知，这里主动触发一次重渲染。
    if (toastShared.currentContent !== null) {
      listener();
    }
    return () => {
      toastShared.listeners.delete(listener);
    };
  }, []);
  if (!toastShared.currentContent) return null;
  return <>{toastShared.currentContent}</>;
}

describe("UpdatePrompt", () => {
  beforeEach(() => {
    swState.needRefresh = false;
    swState.setNeedRefresh = vi.fn();
    swState.updateServiceWorker = vi.fn().mockResolvedValue(undefined);
    toastShared.currentContent = null;
    toastShared.listeners.clear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("应该 needRefresh 为 false 时不显示 toast", () => {
    swState.needRefresh = false;

    render(
      <>
        <UpdatePrompt />
        <ToastContainer />
      </>,
    );

    expect(screen.queryByTestId("update-prompt-toast")).not.toBeInTheDocument();
    expect(toast).not.toHaveBeenCalled();
  });

  it("应该 needRefresh 为 true 时显示含新版本可用文本的 toast", async () => {
    swState.needRefresh = true;

    render(
      <>
        <UpdatePrompt />
        <ToastContainer />
      </>,
    );

    const toastEl = await screen.findByTestId("update-prompt-toast");
    expect(toastEl).toBeVisible();
    expect(screen.getByText("新版本可用")).toBeVisible();
  });

  it("应该点击立即刷新后调用 updateServiceWorker(true)", async () => {
    swState.needRefresh = true;

    render(
      <>
        <UpdatePrompt />
        <ToastContainer />
      </>,
    );

    const refreshButton = await screen.findByTestId("update-prompt-refresh");
    fireEvent.click(refreshButton);

    await waitFor(() => {
      expect(swState.updateServiceWorker).toHaveBeenCalledWith(true);
    });
  });

  it("应该点击稍后后 toast 消失", async () => {
    swState.needRefresh = true;

    render(
      <>
        <UpdatePrompt />
        <ToastContainer />
      </>,
    );

    // 等待 toast 显示
    await screen.findByTestId("update-prompt-toast");

    // 点击"稍后"
    const dismissButton = screen.getByTestId("update-prompt-dismiss");
    fireEvent.click(dismissButton);

    // toast 应消失
    await waitFor(() => {
      expect(
        screen.queryByTestId("update-prompt-toast"),
      ).not.toBeInTheDocument();
    });

    // 应调用 setNeedRefresh(false)
    expect(swState.setNeedRefresh).toHaveBeenCalledWith(false);
  });
});

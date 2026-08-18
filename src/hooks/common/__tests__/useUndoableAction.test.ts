// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";

import { useUndoableAction } from "../useUndoableAction";

const mocks = vi.hoisted(() => ({
  messageSuccess: vi.fn(),
  messageError: vi.fn(),
  messageDismiss: vi.fn(),
}));

vi.mock("../../../utils/messageHelper", () => ({
  message: {
    success: mocks.messageSuccess,
    error: mocks.messageError,
    dismiss: mocks.messageDismiss,
    info: vi.fn(),
    warning: vi.fn(),
  },
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "zh-CN" },
  }),
}));

interface ToastOptions {
  duration: number;
  action: {
    label: string;
    onClick: () => void;
  };
}

function getLastSuccessCall(): { content: string; options: ToastOptions } {
  const calls = mocks.messageSuccess.mock.calls;
  const last = calls[calls.length - 1];
  return {
    content: last[0] as string,
    options: last[1] as ToastOptions,
  };
}

describe("useUndoableAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("executeDelete 调用 deleteFn 并显示带撤销按钮的 toast（默认 6 秒）", async () => {
    const deleteFn = vi.fn().mockResolvedValue("resource-1");
    const restoreFn = vi.fn();
    const { result } = renderHook(() =>
      useUndoableAction({
        deleteFn,
        restoreFn,
        deletedMessage: "已删除",
      }),
    );

    await act(async () => {
      await result.current.executeDelete("payload-1");
    });

    expect(deleteFn).toHaveBeenCalledWith("payload-1");
    expect(mocks.messageSuccess).toHaveBeenCalledTimes(1);
    const { content, options } = getLastSuccessCall();
    expect(content).toBe("已删除");
    expect(options.duration).toBe(6000);
    expect(options.action.label).toBe("common.undo");
    expect(options.action.onClick).toBeTypeOf("function");
  });

  it("点击撤销调用 restoreFn，显示 restoredMessage（默认）", async () => {
    const deleteFn = vi.fn().mockResolvedValue("resource-1");
    const restoreFn = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useUndoableAction({
        deleteFn,
        restoreFn,
        deletedMessage: "已删除",
      }),
    );

    await act(async () => {
      await result.current.executeDelete("payload-1");
    });

    const { options } = getLastSuccessCall();
    await act(async () => {
      options.action.onClick();
      // 等待 fire-and-forget 的 handleRestore 异步链完成
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(restoreFn).toHaveBeenCalledWith("resource-1");
    expect(mocks.messageSuccess).toHaveBeenCalledTimes(2);
    const restored = getLastSuccessCall();
    expect(restored.content).toBe("common.restored");
  });

  it("恢复失败显示 restoreFailedMessage + 调 onRestoreFailed", async () => {
    const deleteFn = vi.fn().mockResolvedValue("resource-1");
    const restoreFn = vi.fn().mockRejectedValue(new Error("boom"));
    const onRestoreFailed = vi.fn();
    const { result } = renderHook(() =>
      useUndoableAction({
        deleteFn,
        restoreFn,
        deletedMessage: "已删除",
        onRestoreFailed,
      }),
    );

    await act(async () => {
      await result.current.executeDelete("payload-1");
    });

    const { options } = getLastSuccessCall();
    await act(async () => {
      options.action.onClick();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(restoreFn).toHaveBeenCalledWith("resource-1");
    expect(mocks.messageError).toHaveBeenCalledTimes(1);
    expect(mocks.messageError.mock.calls[0][0]).toBe("common.restoreFailed");
    expect(onRestoreFailed).toHaveBeenCalledTimes(1);
  });

  it("自定义 toastDuration 生效（默认为 6000）", async () => {
    const deleteFn = vi.fn().mockResolvedValue("resource-1");
    const restoreFn = vi.fn();
    const { result } = renderHook(() =>
      useUndoableAction({
        deleteFn,
        restoreFn,
        deletedMessage: "已删除",
        toastDuration: 10000,
      }),
    );

    await act(async () => {
      await result.current.executeDelete("payload-1");
    });

    const { options } = getLastSuccessCall();
    expect(options.duration).toBe(10000);
  });

  it("自定义 undoLabel 生效", async () => {
    const deleteFn = vi.fn().mockResolvedValue("resource-1");
    const restoreFn = vi.fn();
    const { result } = renderHook(() =>
      useUndoableAction({
        deleteFn,
        restoreFn,
        deletedMessage: "已删除",
        undoLabel: "恢复",
      }),
    );

    await act(async () => {
      await result.current.executeDelete("payload-1");
    });

    const { options } = getLastSuccessCall();
    expect(options.action.label).toBe("恢复");
  });

  it("onRestored 在恢复成功后被调用", async () => {
    const deleteFn = vi.fn().mockResolvedValue("resource-1");
    const restoreFn = vi.fn().mockResolvedValue(undefined);
    const onRestored = vi.fn();
    const { result } = renderHook(() =>
      useUndoableAction({
        deleteFn,
        restoreFn,
        deletedMessage: "已删除",
        onRestored,
      }),
    );

    await act(async () => {
      await result.current.executeDelete("payload-1");
    });

    const { options } = getLastSuccessCall();
    await act(async () => {
      options.action.onClick();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(onRestored).toHaveBeenCalledTimes(1);
  });

  it("getDeletedMessage 提供时覆盖 deletedMessage，基于 payload 动态渲染文案", async () => {
    const deleteFn = vi.fn().mockResolvedValue("resource-1");
    const restoreFn = vi.fn();
    const { result } = renderHook(() =>
      useUndoableAction<{ id: string; title: string }, string>({
        deleteFn,
        restoreFn,
        deletedMessage: "fallback",
        getDeletedMessage: ({ title }) => `已删除「${title}」`,
      }),
    );

    await act(async () => {
      await result.current.executeDelete({ id: "p-1", title: "数学" });
    });

    expect(deleteFn).toHaveBeenCalledWith({ id: "p-1", title: "数学" });
    expect(mocks.messageSuccess).toHaveBeenCalledTimes(1);
    const { content } = getLastSuccessCall();
    expect(content).toBe("已删除「数学」");
  });
});

// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import type { ReactNode, HTMLAttributes } from "react";

// Mock useTheme 以避免需要 ThemeProvider
vi.mock("@/hooks", () => ({
  useTheme: () => ({ isDark: false }),
}));

// Mock framer-motion 以避免 fake timers 与动画计时冲突
vi.mock("framer-motion", async () => {
  const React = await vi.importActual<typeof import("react")>("react");

  const MotionDiv = (props: Record<string, unknown>) => {
    const { children, ...rest } = props;
    delete rest.initial;
    delete rest.animate;
    delete rest.exit;
    delete rest.transition;
    return React.createElement(
      "div",
      rest as HTMLAttributes<HTMLDivElement>,
      children as ReactNode,
    );
  };

  return {
    AnimatePresence: (props: { children?: ReactNode }) =>
      React.createElement(React.Fragment, null, props.children),
    motion: {
      div: MotionDiv,
    },
  };
});

import { frontendEventBus } from "@/services/timer/FrontendEventBus";
import type { MessageShowPayload } from "@/services/FrontendEventTypes";
import { MessageBar } from "../MessageBar";

function publishMessage(payload: MessageShowPayload) {
  act(() => {
    frontendEventBus.publish("message_show", payload);
  });
}

function publishDismiss(id: string) {
  act(() => {
    frontendEventBus.publish("message_dismiss", { id });
  });
}

function publishDismissAll() {
  act(() => {
    frontendEventBus.publish("message_dismiss_all", {});
  });
}

describe("MessageBar", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("单条消息显示并在 duration 后自动关闭", () => {
    render(<MessageBar />);
    publishMessage({
      id: "msg-1",
      type: "info",
      content: "测试消息",
      duration: 3000,
    });

    expect(screen.getByText("测试消息")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(screen.queryByText("测试消息")).not.toBeInTheDocument();
  });

  it("三条消息同时显示", () => {
    render(<MessageBar />);
    publishMessage({ id: "msg-1", type: "info", content: "消息1", duration: 0 });
    publishMessage({ id: "msg-2", type: "info", content: "消息2", duration: 0 });
    publishMessage({ id: "msg-3", type: "info", content: "消息3", duration: 0 });

    expect(screen.getByText("消息1")).toBeInTheDocument();
    expect(screen.getByText("消息2")).toBeInTheDocument();
    expect(screen.getByText("消息3")).toBeInTheDocument();
  });

  it("第四条消息触发 FIFO（移除最早的）", () => {
    render(<MessageBar />);
    publishMessage({ id: "msg-1", type: "info", content: "消息1", duration: 0 });
    publishMessage({ id: "msg-2", type: "info", content: "消息2", duration: 0 });
    publishMessage({ id: "msg-3", type: "info", content: "消息3", duration: 0 });
    publishMessage({ id: "msg-4", type: "info", content: "消息4", duration: 0 });

    expect(screen.queryByText("消息1")).not.toBeInTheDocument();
    expect(screen.getByText("消息2")).toBeInTheDocument();
    expect(screen.getByText("消息3")).toBeInTheDocument();
    expect(screen.getByText("消息4")).toBeInTheDocument();
  });

  it("相同 id 的新消息替换旧消息（去重）", () => {
    render(<MessageBar />);
    publishMessage({ id: "msg-1", type: "info", content: "旧消息", duration: 0 });
    publishMessage({ id: "msg-1", type: "info", content: "新消息", duration: 0 });

    expect(screen.queryByText("旧消息")).not.toBeInTheDocument();
    expect(screen.getByText("新消息")).toBeInTheDocument();
  });

  it("duration: Infinity 不自动关闭", () => {
    render(<MessageBar />);
    publishMessage({
      id: "msg-1",
      type: "info",
      content: "持久消息",
      duration: Infinity,
    });

    expect(screen.getByText("持久消息")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(100000);
    });

    expect(screen.getByText("持久消息")).toBeInTheDocument();
  });

  it("loading 类型显示 Loader2 旋转图标", () => {
    render(<MessageBar />);
    publishMessage({
      id: "msg-1",
      type: "loading",
      content: "加载中...",
      duration: Infinity,
    });

    expect(screen.getByText("加载中...")).toBeInTheDocument();
    expect(screen.getByTestId("loading-spinner")).toBeInTheDocument();
    expect(screen.queryByLabelText("关闭")).not.toBeInTheDocument();
  });

  it("dismiss(id) 移除指定消息", () => {
    render(<MessageBar />);
    publishMessage({ id: "msg-1", type: "info", content: "消息1", duration: 0 });
    publishMessage({ id: "msg-2", type: "info", content: "消息2", duration: 0 });

    publishDismiss("msg-1");

    expect(screen.queryByText("消息1")).not.toBeInTheDocument();
    expect(screen.getByText("消息2")).toBeInTheDocument();
  });

  it("dismiss() 清除所有消息", () => {
    render(<MessageBar />);
    publishMessage({ id: "msg-1", type: "info", content: "消息1", duration: 0 });
    publishMessage({ id: "msg-2", type: "info", content: "消息2", duration: 0 });

    publishDismissAll();

    expect(screen.queryByText("消息1")).not.toBeInTheDocument();
    expect(screen.queryByText("消息2")).not.toBeInTheDocument();
  });
});

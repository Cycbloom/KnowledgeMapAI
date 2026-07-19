// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SyncStatusBadge } from "../SyncStatusBadge";
import type { QueuedMutation } from "@/utils/offlineMutations";

// 共享 mock 状态：通过 vi.hoisted 确保 vi.mock 工厂可访问
const mockState = vi.hoisted(() => ({
  queue: [] as QueuedMutation[],
  listener: null as ((queue: QueuedMutation[]) => void) | null,
}));

vi.mock("@/utils/offlineMutations", () => ({
  offlineMutationQueue: {
    subscribe: (listener: (queue: QueuedMutation[]) => void) => {
      mockState.listener = listener;
      // 模拟真实 subscribe 的立即触发行为
      listener(mockState.queue);
      return () => {
        mockState.listener = null;
      };
    },
  },
}));

function buildQueuedMutation(
  overrides: Partial<QueuedMutation> = {},
): QueuedMutation {
  return {
    id: `mutation-${Math.random().toString(36).slice(2, 9)}`,
    mutationKey: ["test", "action"],
    variables: {},
    context: undefined,
    meta: undefined,
    timestamp: Date.now(),
    retryCount: 0,
    ...overrides,
  };
}

describe("SyncStatusBadge", () => {
  beforeEach(() => {
    mockState.queue = [];
    mockState.listener = null;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("应该 pending 为 0 时不渲染徽章", () => {
    mockState.queue = [];

    render(<SyncStatusBadge />);

    expect(screen.queryByTestId("sync-status-badge")).not.toBeInTheDocument();
  });

  it("应该 pending 1-10 时渲染黄色徽章并显示计数", () => {
    mockState.queue = [
      buildQueuedMutation({ id: "m1" }),
      buildQueuedMutation({ id: "m2" }),
      buildQueuedMutation({ id: "m3" }),
    ];

    render(<SyncStatusBadge />);

    const badge = screen.getByTestId("sync-status-badge");
    expect(badge).toBeVisible();

    const count = screen.getByTestId("sync-status-badge-count");
    expect(count).toHaveTextContent("3");

    // 按钮应包含黄色 class
    const button = screen.getByRole("button", { name: "同步状态" });
    expect(button.className).toContain("bg-yellow-500");
  });

  it("应该 pending 大于 10 时渲染红色徽章", () => {
    mockState.queue = Array.from({ length: 11 }, (_, i) =>
      buildQueuedMutation({ id: `m${i}` }),
    );

    render(<SyncStatusBadge />);

    const badge = screen.getByTestId("sync-status-badge");
    expect(badge).toBeVisible();

    const count = screen.getByTestId("sync-status-badge-count");
    expect(count).toHaveTextContent("11");

    const button = screen.getByRole("button", { name: "同步状态" });
    expect(button.className).toContain("bg-red-500");
  });

  it("应该点击徽章后弹出 popover 显示最近 5 项", () => {
    mockState.queue = Array.from({ length: 7 }, (_, i) =>
      buildQueuedMutation({
        id: `m${i}`,
        mutationKey: ["test", `action-${i}`],
      }),
    );

    render(<SyncStatusBadge />);

    // 初始 popover 不显示
    expect(screen.queryByTestId("sync-status-badge-popover")).not.toBeInTheDocument();

    // 点击徽章按钮
    const button = screen.getByRole("button", { name: "同步状态" });
    fireEvent.click(button);

    // popover 应显示
    const popover = screen.getByTestId("sync-status-badge-popover");
    expect(popover).toBeVisible();

    // popover 标题应显示总数
    expect(popover).toHaveTextContent("待同步操作 (7)");

    // 应只显示最近 5 项（slice(0, 5)）
    // 每项的 mutationKey 格式化为 "test / action-N"
    expect(popover).toHaveTextContent("action-0");
    expect(popover).toHaveTextContent("action-4");
    // 第 6、7 项不应显示
    expect(popover).not.toHaveTextContent("action-5");
    expect(popover).not.toHaveTextContent("action-6");
  });

  it("应该点击 popover 外部时关闭 popover", () => {
    mockState.queue = [buildQueuedMutation({ id: "m1" })];

    render(<SyncStatusBadge />);

    // 打开 popover
    const button = screen.getByRole("button", { name: "同步状态" });
    fireEvent.click(button);
    expect(screen.getByTestId("sync-status-badge-popover")).toBeVisible();

    // 点击 popover 外部（document.body）
    fireEvent.mouseDown(document.body);

    // popover 应关闭
    expect(screen.queryByTestId("sync-status-badge-popover")).not.toBeInTheDocument();
  });
});

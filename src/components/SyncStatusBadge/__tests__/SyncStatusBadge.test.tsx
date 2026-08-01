// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { SyncStatusBadge } from "../SyncStatusBadge";
import { offlineMutationQueue, type QueuedMutation } from "../../../utils/offlineMutations";

// 共享 mock 状态：通过 vi.hoisted 确保 vi.mock 工厂可访问
const { mockState, subscribeSpy } = vi.hoisted(() => {
  const state = {
    queue: [] as QueuedMutation[],
    listener: null as ((queue: QueuedMutation[]) => void) | null,
  };
  return {
    mockState: state,
    subscribeSpy: vi.fn((listener: (queue: QueuedMutation[]) => void) => {
      state.listener = listener;
      listener(state.queue);
      return () => {
        state.listener = null;
      };
    }),
  };
});

vi.mock("../../../utils/offlineMutations", () => ({
  offlineMutationQueue: {
    subscribe: subscribeSpy,
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
    subscribeSpy.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("debug - mock 应该被正确应用", () => {
    // 验证 mock 是否生效
    expect(vi.isMockFunction(offlineMutationQueue.subscribe)).toBe(true);
  });

  it("debug - useEffect 应该调用 subscribe", () => {
    mockState.queue = [buildQueuedMutation({ id: "m1" })];
    render(<SyncStatusBadge />);
    expect(subscribeSpy).toHaveBeenCalled();
  });

  it("应该 pending 为 0 时不渲染徽章", () => {
    mockState.queue = [];

    render(<SyncStatusBadge />);

    expect(screen.queryByTestId("sync-status-badge")).not.toBeInTheDocument();
  });

  it("应该 pending 1-10 时渲染黄色徽章并显示计数", async () => {
    mockState.queue = [
      buildQueuedMutation({ id: "m1" }),
      buildQueuedMutation({ id: "m2" }),
      buildQueuedMutation({ id: "m3" }),
    ];

    render(<SyncStatusBadge />);

    await waitFor(() => {
      expect(screen.getByTestId("sync-status-badge")).toBeVisible();
    });

    const count = screen.getByTestId("sync-status-badge-count");
    expect(count).toHaveTextContent("3");

    const button = screen.getByRole("button", { name: /同步状态/ });
    expect(button.className).toContain("bg-yellow-500");
  });

  it("应该 pending 大于 10 时渲染红色徽章", async () => {
    mockState.queue = Array.from({ length: 11 }, (_, i) =>
      buildQueuedMutation({ id: `m${i}` }),
    );

    render(<SyncStatusBadge />);

    await waitFor(() => {
      expect(screen.getByTestId("sync-status-badge")).toBeVisible();
    });

    const count = screen.getByTestId("sync-status-badge-count");
    expect(count).toHaveTextContent("11");

    const button = screen.getByRole("button", { name: /同步状态/ });
    expect(button.className).toContain("bg-red-500");
  });

  it("应该点击徽章后弹出 popover 显示最近 5 项", async () => {
    mockState.queue = Array.from({ length: 7 }, (_, i) =>
      buildQueuedMutation({
        id: `m${i}`,
        mutationKey: ["test", `action-${i}`],
      }),
    );

    render(<SyncStatusBadge />);

    await waitFor(() => {
      expect(screen.getByTestId("sync-status-badge")).toBeVisible();
    });

    expect(screen.queryByTestId("sync-status-badge-popover")).not.toBeInTheDocument();

    const button = screen.getByRole("button", { name: /同步状态/ });
    fireEvent.click(button);

    const popover = screen.getByTestId("sync-status-badge-popover");
    expect(popover).toBeVisible();

    expect(popover).toHaveTextContent("待同步操作 (7)");

    expect(popover).toHaveTextContent("action-0");
    expect(popover).toHaveTextContent("action-4");
    expect(popover).not.toHaveTextContent("action-5");
    expect(popover).not.toHaveTextContent("action-6");
  });

  it("应该点击 popover 外部时关闭 popover", async () => {
    mockState.queue = [buildQueuedMutation({ id: "m1" })];

    render(<SyncStatusBadge />);

    await waitFor(() => {
      expect(screen.getByTestId("sync-status-badge")).toBeVisible();
    });

    const button = screen.getByRole("button", { name: /同步状态/ });
    fireEvent.click(button);
    expect(screen.getByTestId("sync-status-badge-popover")).toBeVisible();

    fireEvent.mouseDown(document.body);

    expect(screen.queryByTestId("sync-status-badge-popover")).not.toBeInTheDocument();
  });
});
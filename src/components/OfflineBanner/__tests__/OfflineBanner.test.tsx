// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import type { ReactNode, ComponentPropsWithoutRef } from "react";
import { OfflineBanner } from "../OfflineBanner";
import type { QueuedMutation } from "@/utils/offlineMutations";

// Use a shared object for mutable state accessed in vi.mock factories
const mockState = vi.hoisted(() => ({
  online: true,
  queue: [] as QueuedMutation[],
  listener: null as ((queue: QueuedMutation[]) => void) | null,
}));

vi.mock("../../../hooks/common/useNetworkStatus", () => ({
  useNetworkStatus: () => ({ online: mockState.online }),
}));

vi.mock("../../../utils/offlineMutations", () => ({
  offlineMutationQueue: {
    subscribe: (listener: (queue: QueuedMutation[]) => void) => {
      mockState.listener = listener;
      listener(mockState.queue);
      return () => {
        mockState.listener = null;
      };
    },
  },
}));

// mock framer-motion
vi.mock("framer-motion", () => ({
  AnimatePresence: ({ children }: { children: ReactNode }) => <>{children}</>,
  motion: {
    div: ({
      initial,
      animate,
      exit,
      transition,
      ...rest
    }: Record<string, unknown>) => {
      void [initial, animate, exit, transition];
      return <div {...(rest as ComponentPropsWithoutRef<"div">)} />;
    },
  },
}));

function buildQueuedMutation(
  overrides: Partial<QueuedMutation> = {},
): QueuedMutation {
  return {
    id: `mutation-${Math.random().toString(36).slice(2, 9)}`,
    mutationKey: ["test"],
    variables: {},
    context: undefined,
    meta: undefined,
    timestamp: Date.now(),
    retryCount: 0,
    ...overrides,
  };
}

describe("OfflineBanner", () => {
  beforeEach(() => {
    mockState.online = true;
    mockState.queue = [];
    mockState.listener = null;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("应该在线且无 pending 时不渲染横幅", () => {
    mockState.online = true;
    mockState.queue = [];

    render(<OfflineBanner />);

    expect(screen.queryByTestId("offline-banner")).not.toBeInTheDocument();
  });

  it("应该离线时渲染横幅并显示当前离线文本", async () => {
    mockState.online = false;
    mockState.queue = [];

    render(<OfflineBanner />);

    const banner = await screen.findByTestId("offline-banner");
    expect(banner).toBeVisible();
    expect(banner).toHaveTextContent("当前离线");
  });

  it("应该离线且有 pending 时显示待同步计数", async () => {
    mockState.online = false;
    mockState.queue = [
      buildQueuedMutation({ id: "m1" }),
      buildQueuedMutation({ id: "m2" }),
      buildQueuedMutation({ id: "m3" }),
    ];

    render(<OfflineBanner />);

    const banner = await screen.findByTestId("offline-banner");
    expect(banner).toBeVisible();

    const pendingBadge = screen.getByTestId("offline-banner-pending");
    expect(pendingBadge).toBeVisible();
    expect(pendingBadge).toHaveTextContent("3 项待同步");
  });

  it("应该网络恢复后切换为同步中状态", async () => {
    mockState.online = false;
    mockState.queue = [];

    const { rerender } = render(<OfflineBanner />);

    // 离线时显示当前离线（使用真实定时器，确保 findByTestId 正常工作）
    const banner = await screen.findByTestId("offline-banner");
    expect(banner).toHaveTextContent("当前离线");

    // 切换到 fake timers 用于控制 setTimeout
    vi.useFakeTimers();

    // 模拟网络恢复
    mockState.online = true;
    act(() => {
      rerender(<OfflineBanner />);
    });

    // 网络恢复后应显示同步中（act 已同步刷新所有 effect）
    expect(screen.getByTestId("offline-banner")).toHaveTextContent("同步中");

    // 2 秒后同步完成且无 pending，横幅应消失
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(screen.queryByTestId("offline-banner")).not.toBeInTheDocument();
  });
});

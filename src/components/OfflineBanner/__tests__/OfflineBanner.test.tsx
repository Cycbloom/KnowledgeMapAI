// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import type { ReactNode, ComponentPropsWithoutRef } from "react";
import { OfflineBanner } from "../OfflineBanner";
import type { QueuedMutation } from "@/utils/offlineMutations";

// 共享 mock 状态：通过 vi.hoisted 确保 vi.mock 工厂可访问
const mockState = vi.hoisted(() => ({
  networkStatus: { online: true },
  queue: [] as QueuedMutation[],
  listener: null as ((queue: QueuedMutation[]) => void) | null,
}));

vi.mock("@/hooks/common/useNetworkStatus", () => ({
  useNetworkStatus: () => mockState.networkStatus,
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

// mock framer-motion：jsdom 环境下 framer-motion 会给 motion.div 设置
// opacity:0 / transform 等内联样式，导致 toBeVisible() 失败。
// 这里将 motion.div 渲染为普通 div，过滤掉动画相关 props。
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
    vi.useFakeTimers();
    mockState.networkStatus.online = true;
    mockState.queue = [];
    mockState.listener = null;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("应该在线且无 pending 时不渲染横幅", () => {
    mockState.networkStatus.online = true;
    mockState.queue = [];

    render(<OfflineBanner />);

    expect(screen.queryByTestId("offline-banner")).not.toBeInTheDocument();
  });

  it("应该离线时渲染横幅并显示当前离线文本", () => {
    mockState.networkStatus.online = false;
    mockState.queue = [];

    render(<OfflineBanner />);

    const banner = screen.getByTestId("offline-banner");
    expect(banner).toBeVisible();
    expect(banner).toHaveTextContent("当前离线");
  });

  it("应该离线且有 pending 时显示待同步计数", () => {
    mockState.networkStatus.online = false;
    mockState.queue = [
      buildQueuedMutation({ id: "m1" }),
      buildQueuedMutation({ id: "m2" }),
      buildQueuedMutation({ id: "m3" }),
    ];

    render(<OfflineBanner />);

    const pendingBadge = screen.getByTestId("offline-banner-pending");
    expect(pendingBadge).toBeVisible();
    expect(pendingBadge).toHaveTextContent("3 项待同步");
  });

  it("应该网络恢复后切换为同步中状态", () => {
    mockState.networkStatus.online = false;
    mockState.queue = [];

    const { rerender } = render(<OfflineBanner />);

    // 离线时显示当前离线
    expect(screen.getByTestId("offline-banner")).toHaveTextContent("当前离线");

    // 模拟网络恢复
    mockState.networkStatus.online = true;
    rerender(<OfflineBanner />);

    // 网络恢复后应显示同步中
    const banner = screen.getByTestId("offline-banner");
    expect(banner).toBeVisible();
    expect(banner).toHaveTextContent("同步中");

    // 2 秒后同步完成且无 pending，横幅应消失
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(screen.queryByTestId("offline-banner")).not.toBeInTheDocument();
  });
});

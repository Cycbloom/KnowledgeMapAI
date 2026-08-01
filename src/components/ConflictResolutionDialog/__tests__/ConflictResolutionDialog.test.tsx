// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { ConflictResolutionDialog } from "../ConflictResolutionDialog";
import type { SyncConflictDetectedPayload } from "@/services/FrontendEventTypes";

// 共享 mock 状态
const mocks = vi.hoisted(() => {
  return {
    enqueue: vi.fn<() => Promise<string>>().mockResolvedValue("test-queue-id"),
    subscribeWasCalled: false,
    eventHandler: null as ((payload: SyncConflictDetectedPayload) => void) | null,
  };
});

// Use relative path for vi.mock to avoid alias resolution issues
vi.mock("../../../utils/offlineMutations", () => ({
  offlineMutationQueue: {
    enqueue: mocks.enqueue,
  },
}));

// 使用相对路径 mock（与组件导入路径一致）
vi.mock("../../../services/timer/FrontendEventBus", () => ({
  frontendEventBus: {
    subscribe: (eventType: string, handler: (payload: SyncConflictDetectedPayload) => void) => {
      mocks.subscribeWasCalled = true;
      if (eventType === "sync_conflict_detected") {
        mocks.eventHandler = handler;
      }
      return () => {
        if (eventType === "sync_conflict_detected") {
          mocks.eventHandler = null;
        }
      };
    },
  },
}));

function buildConflictPayload(
  overrides: Partial<SyncConflictDetectedPayload> = {},
): SyncConflictDetectedPayload {
  return {
    entity: "graphs",
    id: "test-id-123",
    localData: { title: "Local Version", updatedAt: "2026-01-01" },
    remoteData: { title: "Remote Version", updatedAt: "2026-06-01" },
    ...overrides,
  };
}

describe("ConflictResolutionDialog", () => {
  beforeEach(() => {
    mocks.enqueue.mockClear();
    mocks.enqueue.mockResolvedValue("test-queue-id");
    mocks.eventHandler = null;
    mocks.subscribeWasCalled = false;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("应该触发 sync_conflict_detected 事件后弹出对话框显示本地与远端版本", async () => {
    render(<ConflictResolutionDialog />);
    // 等待 useEffect 完成订阅
    await waitFor(() => {
      expect(mocks.subscribeWasCalled).toBe(true);
    });
    // 触发冲突事件
    const payload = buildConflictPayload();
    act(() => {
      mocks.eventHandler?.(payload);
    });
    // 对话框应显示
    await waitFor(() => {
      const dialog = screen.getByTestId("conflict-resolution-dialog");
      expect(dialog).toBeVisible();
    });
    // 显示本地和远端版本
    expect(screen.getByTestId("conflict-local-version")).toBeVisible();
    expect(screen.getByTestId("conflict-remote-version")).toBeVisible();
  });

  it("应该无冲突时不渲染对话框", async () => {
    render(<ConflictResolutionDialog />);
    // 等待 useEffect 完成订阅
    await waitFor(() => {
      expect(mocks.subscribeWasCalled).toBe(true);
    });
    // 对话框不应存在
    expect(screen.queryByTestId("conflict-resolution-dialog")).not.toBeInTheDocument();
  });

  it("应该点击'使用本地版本'后调用 enqueue 并关闭对话框", async () => {
    render(<ConflictResolutionDialog />);
    // 等待 useEffect 完成订阅
    await waitFor(() => {
      expect(mocks.subscribeWasCalled).toBe(true);
    });
    // 触发冲突事件
    const payload = buildConflictPayload();
    act(() => {
      mocks.eventHandler?.(payload);
    });
    // 等待对话框显示
    await waitFor(() => {
      expect(screen.getByTestId("conflict-resolution-dialog")).toBeVisible();
    });
    // 点击"使用本地版本"
    await act(async () => {
      fireEvent.click(screen.getByTestId("conflict-use-local"));
    });
    // 验证 enqueue 被调用
    await waitFor(() => {
      expect(mocks.enqueue).toHaveBeenCalledTimes(1);
    });
    expect(mocks.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        mutationKey: expect.arrayContaining(["conflict-resolution", "graphs", "test-id-123"]),
        variables: expect.objectContaining({
          strategy: "local",
          entityType: "graphs",
          entityId: "test-id-123",
        }),
      }),
    );
    // 对话框应关闭
    await waitFor(() => {
      expect(screen.queryByTestId("conflict-resolution-dialog")).not.toBeInTheDocument();
    });
  });

  it("应该点击'使用远端版本'和'合并'也正确工作", async () => {
    render(<ConflictResolutionDialog />);
    // 等待 useEffect 完成订阅
    await waitFor(() => {
      expect(mocks.subscribeWasCalled).toBe(true);
    });
    // 触发冲突事件
    const payload = buildConflictPayload();
    act(() => {
      mocks.eventHandler?.(payload);
    });
    // 等待对话框显示
    await waitFor(() => {
      expect(screen.getByTestId("conflict-resolution-dialog")).toBeVisible();
    });
    // 点击"使用远端版本"
    await act(async () => {
      fireEvent.click(screen.getByTestId("conflict-use-remote"));
    });
    await waitFor(() => {
      expect(mocks.enqueue).toHaveBeenCalledTimes(1);
    });
    expect(mocks.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        variables: expect.objectContaining({ strategy: "remote" }),
      }),
    );

    // 再次触发冲突事件
    mocks.enqueue.mockClear();
    act(() => {
      mocks.eventHandler?.(payload);
    });
    await waitFor(() => {
      expect(screen.getByTestId("conflict-resolution-dialog")).toBeVisible();
    });
    // 点击"合并"
    await act(async () => {
      fireEvent.click(screen.getByTestId("conflict-merge"));
    });
    await waitFor(() => {
      expect(mocks.enqueue).toHaveBeenCalledTimes(1);
    });
    expect(mocks.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        variables: expect.objectContaining({ strategy: "merge" }),
      }),
    );
  });
});
// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { ConflictResolutionDialog } from "../ConflictResolutionDialog";
import type { SyncConflictDetectedPayload } from "@/services/FrontendEventTypes";

// 共享 mock 状态：通过 vi.hoisted 确保 vi.mock 工厂可访问
const mocks = vi.hoisted(() => ({
  enqueue: vi.fn().mockResolvedValue("test-queue-id"),
  eventHandler: null as ((payload: SyncConflictDetectedPayload) => void) | null,
}));

vi.mock("@/utils/offlineMutations", () => ({
  offlineMutationQueue: {
    enqueue: mocks.enqueue,
  },
}));

vi.mock("@/services/timer/FrontendEventBus", () => ({
  frontendEventBus: {
    subscribe: (
      eventType: string,
      handler: (payload: SyncConflictDetectedPayload) => void,
    ) => {
      // 仅捕获 sync_conflict_detected 事件的 handler
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
    id: "conflict-1",
    entity: "graph",
    localData: { title: "本地标题", content: "本地内容" },
    remoteData: { title: "远端标题", content: "远端内容" },
    timestamp: Date.now(),
    ...overrides,
  };
}

describe("ConflictResolutionDialog", () => {
  beforeEach(() => {
    mocks.enqueue.mockClear();
    mocks.enqueue.mockResolvedValue("test-queue-id");
    mocks.eventHandler = null;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("应该无冲突事件时不渲染对话框", () => {
    render(<ConflictResolutionDialog />);

    expect(
      screen.queryByTestId("conflict-resolution-dialog"),
    ).not.toBeInTheDocument();
  });

  it("应该触发 sync_conflict_detected 事件后弹出对话框显示本地与远端版本", () => {
    render(<ConflictResolutionDialog />);

    // 触发冲突事件
    const payload = buildConflictPayload();
    act(() => {
      mocks.eventHandler?.(payload);
    });

    // 对话框应显示
    const dialog = screen.getByTestId("conflict-resolution-dialog");
    expect(dialog).toBeVisible();

    // 应显示本地版本
    const localVersion = screen.getByTestId("conflict-local-version");
    expect(localVersion).toBeVisible();
    expect(localVersion).toHaveTextContent("本地标题");
    expect(localVersion).toHaveTextContent("本地内容");

    // 应显示远端版本
    const remoteVersion = screen.getByTestId("conflict-remote-version");
    expect(remoteVersion).toBeVisible();
    expect(remoteVersion).toHaveTextContent("远端标题");
    expect(remoteVersion).toHaveTextContent("远端内容");
  });

  it("应该点击使用本地版本后调用 enqueue 并关闭对话框", async () => {
    render(<ConflictResolutionDialog />);

    const payload = buildConflictPayload();
    act(() => {
      mocks.eventHandler?.(payload);
    });

    // 点击"使用本地版本"
    const useLocalButton = screen.getByTestId("conflict-use-local");
    fireEvent.click(useLocalButton);

    // 应调用 enqueue，strategy 为 'local'
    await waitFor(() => {
      expect(mocks.enqueue).toHaveBeenCalledTimes(1);
    });
    const enqueueCall = mocks.enqueue.mock.calls[0];
    expect(enqueueCall[0]).toMatchObject({
      mutationKey: ["conflict-resolution", "graph", "conflict-1"],
      variables: {
        strategy: "local",
        entityType: "graph",
        entityId: "conflict-1",
        local: payload.localData,
        remote: payload.remoteData,
      },
      meta: { conflictResolution: true },
    });

    // 对话框应关闭
    await waitFor(() => {
      expect(
        screen.queryByTestId("conflict-resolution-dialog"),
      ).not.toBeInTheDocument();
    });
  });

  it("应该点击使用远端版本后调用 enqueue 并关闭对话框", async () => {
    render(<ConflictResolutionDialog />);

    const payload = buildConflictPayload();
    act(() => {
      mocks.eventHandler?.(payload);
    });

    // 点击"使用远端版本"
    const useRemoteButton = screen.getByTestId("conflict-use-remote");
    fireEvent.click(useRemoteButton);

    // 应调用 enqueue，strategy 为 'remote'
    await waitFor(() => {
      expect(mocks.enqueue).toHaveBeenCalledTimes(1);
    });
    const enqueueCall = mocks.enqueue.mock.calls[0];
    expect(enqueueCall[0]).toMatchObject({
      mutationKey: ["conflict-resolution", "graph", "conflict-1"],
      variables: {
        strategy: "remote",
        entityType: "graph",
        entityId: "conflict-1",
        local: payload.localData,
        remote: payload.remoteData,
      },
      meta: { conflictResolution: true },
    });

    // 对话框应关闭
    await waitFor(() => {
      expect(
        screen.queryByTestId("conflict-resolution-dialog"),
      ).not.toBeInTheDocument();
    });
  });

  it("应该点击合并后调用 enqueue 并关闭对话框", async () => {
    render(<ConflictResolutionDialog />);

    const payload = buildConflictPayload();
    act(() => {
      mocks.eventHandler?.(payload);
    });

    // 点击"合并"
    const mergeButton = screen.getByTestId("conflict-merge");
    fireEvent.click(mergeButton);

    // 应调用 enqueue，strategy 为 'merge'
    await waitFor(() => {
      expect(mocks.enqueue).toHaveBeenCalledTimes(1);
    });
    const enqueueCall = mocks.enqueue.mock.calls[0];
    expect(enqueueCall[0]).toMatchObject({
      mutationKey: ["conflict-resolution", "graph", "conflict-1"],
      variables: {
        strategy: "merge",
        entityType: "graph",
        entityId: "conflict-1",
        local: payload.localData,
        remote: payload.remoteData,
      },
      meta: { conflictResolution: true },
    });

    // 对话框应关闭
    await waitFor(() => {
      expect(
        screen.queryByTestId("conflict-resolution-dialog"),
      ).not.toBeInTheDocument();
    });
  });
});

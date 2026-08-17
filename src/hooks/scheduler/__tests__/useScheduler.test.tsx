// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import type { UserTask, UserTaskStatus } from "@shared/types";
import {
  useStartUserTaskMutation,
  usePauseUserTaskMutation,
  useCompleteUserTaskMutation,
} from "../useScheduler";
import { queryKeys } from "../../queries/config";

const mocks = vi.hoisted(() => ({
  messageSuccess: vi.fn(),
  messageError: vi.fn(),
  start: vi.fn(),
  pause: vi.fn(),
  complete: vi.fn(),
}));

// Mock messageHelper — useOptimisticMutation onError 固定调用 message.error
vi.mock("../../../utils/messageHelper", () => ({
  message: {
    success: mocks.messageSuccess,
    error: mocks.messageError,
    info: vi.fn(),
    warning: vi.fn(),
  },
}));

// Mock react-i18next — mutationFactory 顶层 import 依赖
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: "zh-CN" } }),
}));

// Mock FrontendEventBus — mutationFactory 顶层 import 依赖
vi.mock("../../../services/timer/FrontendEventBus", () => ({
  frontendEventBus: { publish: vi.fn() },
}));

// Mock api — 隔离真实网络请求
vi.mock("../../../services/api", () => ({
  api: {
    scheduler: {
      start: mocks.start,
      pause: mocks.pause,
      complete: mocks.complete,
    },
  },
}));

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }): ReactNode {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

function makeTask(id: string, status: UserTaskStatus): UserTask {
  return {
    id,
    user_id: "u1",
    title: `task ${id}`,
    queue_level: 1,
    position: 0,
    status,
    tags: [],
    priority: 2,
    created_at: "2026-08-17T00:00:00Z",
    updated_at: "2026-08-17T00:00:00Z",
  };
}

describe("useScheduler 状态 mutation 乐观更新与失效", () => {
  let queryClient: QueryClient;

  const tasksAllKey = queryKeys.schedulerTasks();
  const tasksFilteredKey = queryKeys.schedulerTasks({ status: "pending" });
  const detailKey = queryKeys.schedulerTask("task-1");
  const queuesKey = queryKeys.queues();
  const statsKey = queryKeys.stats();
  const heatmapKey = queryKeys.heatmap();

  const seedCaches = (tasks: UserTask[]) => {
    queryClient.setQueryData<UserTask[]>(tasksAllKey, tasks);
    queryClient.setQueryData<UserTask[]>(tasksFilteredKey, tasks);
    queryClient.setQueryData<UserTask>(detailKey, tasks[0]);
    queryClient.setQueryData<unknown>(queuesKey, { queues: [] });
    queryClient.setQueryData<unknown>(statsKey, { total: 0 });
    queryClient.setQueryData<unknown>(heatmapKey, []);
  };

  const getStatus = (key: readonly unknown[], id: string): UserTaskStatus | undefined =>
    queryClient
      .getQueryData<UserTask[]>(key as never)
      ?.find((t) => t.id === id)
      ?.status;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
  });

  describe("useStartUserTaskMutation", () => {
    it("成功：乐观置为 in_progress，settle 后失效任务/队列/详情缓存", async () => {
      seedCaches([makeTask("task-1", "pending"), makeTask("task-2", "pending")]);

      // 受控 Promise 捕获乐观中间态
      const deferred: { resolve: () => void } = { resolve: () => undefined };
      mocks.start.mockImplementation(
        () =>
          new Promise<{ task: UserTask }>((resolve) => {
            deferred.resolve = () => resolve({ task: makeTask("task-1", "in_progress") });
          }),
      );

      const { result } = renderHook(() => useStartUserTaskMutation(), {
        wrapper: createWrapper(queryClient),
      });

      let promise: Promise<unknown> | undefined;
      act(() => {
        promise = result.current.mutateAsync("task-1");
      });

      // 乐观中间态：未过滤与过滤列表键（前缀匹配）均被更新
      await waitFor(() => {
        expect(getStatus(tasksAllKey, "task-1")).toBe("in_progress");
        expect(getStatus(tasksFilteredKey, "task-1")).toBe("in_progress");
      });
      expect(getStatus(tasksAllKey, "task-2")).toBe("pending");

      await act(async () => {
        deferred.resolve();
        await promise;
      });

      // settle 后：相关查询全部失效
      await waitFor(() => {
        expect(queryClient.getQueryState(detailKey)?.isInvalidated).toBe(true);
        expect(queryClient.getQueryState(queuesKey)?.isInvalidated).toBe(true);
        expect(
          queryClient.getQueryState(tasksAllKey)?.isInvalidated,
        ).toBe(true);
      });
      expect(mocks.start).toHaveBeenCalledWith("task-1");
    });

    it("失败：回滚 status 并提示错误，缓存仍失效", async () => {
      seedCaches([makeTask("task-1", "pending")]);
      mocks.start.mockRejectedValue(new Error("start failed"));

      const { result } = renderHook(() => useStartUserTaskMutation(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        await expect(result.current.mutateAsync("task-1")).rejects.toThrow(
          "start failed",
        );
      });

      await waitFor(() => {
        expect(getStatus(tasksAllKey, "task-1")).toBe("pending");
      });
      expect(mocks.messageError).toHaveBeenCalled();
      expect(queryClient.getQueryState(detailKey)?.isInvalidated).toBe(true);
    });
  });

  describe("usePauseUserTaskMutation", () => {
    it("成功：乐观置为 paused", async () => {
      seedCaches([makeTask("task-1", "in_progress")]);
      mocks.pause.mockResolvedValue({ task: makeTask("task-1", "paused") });

      const { result } = renderHook(() => usePauseUserTaskMutation(), {
        wrapper: createWrapper(queryClient),
      });

      const promise = result.current.mutateAsync("task-1");

      await waitFor(() => {
        expect(getStatus(tasksAllKey, "task-1")).toBe("paused");
      });

      await promise;
      expect(mocks.pause).toHaveBeenCalledWith("task-1");
      await waitFor(() => {
        expect(queryClient.getQueryState(detailKey)?.isInvalidated).toBe(true);
      });
    });

    it("失败：回滚为 in_progress", async () => {
      seedCaches([makeTask("task-1", "in_progress")]);
      mocks.pause.mockRejectedValue(new Error("pause failed"));

      const { result } = renderHook(() => usePauseUserTaskMutation(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        await expect(result.current.mutateAsync("task-1")).rejects.toThrow(
          "pause failed",
        );
      });

      await waitFor(() => {
        expect(getStatus(tasksAllKey, "task-1")).toBe("in_progress");
      });
      expect(mocks.messageError).toHaveBeenCalled();
    });
  });

  describe("useCompleteUserTaskMutation", () => {
    it("成功：乐观置为 completed，额外失效 stats/heatmap", async () => {
      seedCaches([makeTask("task-1", "in_progress")]);
      mocks.complete.mockResolvedValue(makeTask("task-1", "completed"));

      const { result } = renderHook(() => useCompleteUserTaskMutation(), {
        wrapper: createWrapper(queryClient),
      });

      await result.current.mutateAsync("task-1");

      await waitFor(() => {
        expect(getStatus(tasksAllKey, "task-1")).toBe("completed");
        expect(queryClient.getQueryState(statsKey)?.isInvalidated).toBe(true);
        expect(queryClient.getQueryState(heatmapKey)?.isInvalidated).toBe(true);
        expect(queryClient.getQueryState(detailKey)?.isInvalidated).toBe(true);
      });
      expect(mocks.complete).toHaveBeenCalledWith("task-1");
    });
  });
});

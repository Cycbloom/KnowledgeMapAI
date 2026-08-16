// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import * as React from "react";
import { useTaskEvents } from "../useTaskEvents";
import { queryKeys } from "../../queries/config";
import { frontendEventBus } from "../../../services/timer/FrontendEventBus";
import type { Task } from "@shared/types";

type MessageHandler = (event: { data: string }) => void;

const messageHandlerRef: { current: MessageHandler | null } = { current: null };
const esInstances: Array<{ onmessage: MessageHandler | null; close: ReturnType<typeof vi.fn> }> = [];

vi.mock("event-source-polyfill", () => {
  class MockEventSource {
    onmessage: MessageHandler | null = null;
    onerror: ((err: unknown) => void) | null = null;
    onopen: (() => void) | null = null;
    close = vi.fn();
    constructor() {
      messageHandlerRef.current = (event) => this.onmessage?.(event);
      esInstances.push(this);
    }
  }
  return { EventSourcePolyfill: MockEventSource };
});

vi.mock("../../../services/timer/FrontendEventBus", () => ({
  frontendEventBus: {
    publish: vi.fn(),
    subscribe: vi.fn(),
  },
}));

const useStoreState = { token: "test-token" } as { token: string | null };
vi.mock("../../../store/useStore", () => ({
  useStore: <T,>(selector: (state: typeof useStoreState) => T) => selector(useStoreState),
}));

vi.mock("../../../config/electronConfig", () => ({
  isElectronProduction: () => false,
  getElectronApiUrl: async () => "/api",
}));

vi.mock("../../../config/mobileApiConfig", () => ({
  isCapacitorMobile: () => false,
}));

function makeTasksPage(tasks: Task[]): { tasks: Task[]; total: number; offset: number; limit: number } {
  return { tasks, total: tasks.length, offset: 0, limit: 20 };
}

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: "t-1",
    user_id: "u-1",
    title: "T1",
    description: "",
    queue_id: "q-1",
    queue_level: 1,
    position: 0,
    estimated_duration: 0,
    actual_duration: 0,
    deadline: "",
    status: "in_progress",
    tags: [],
    knowledge_point_id: "",
    priority: 0,
    task_type: "ai_generation",
    total_duration: 0,
    progress_mode: "average",
    progress_percentage: 0,
    parent_task_id: "",
    context: "",
    scheduled_start: "",
    scheduled_end: "",
    notes: "",
    completed_at: "",
    created_at: "",
    updated_at: "",
    deleted_at: "",
    ...overrides,
  } as Task;
}

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe("useTaskEvents - task_update handler", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    messageHandlerRef.current = null;
    esInstances.length = 0;
    useStoreState.token = "test-token";
    vi.mocked(frontendEventBus.publish).mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  function mountAndWaitForConnection() {
    const wrapper = createWrapper(queryClient);
    renderHook(() => useTaskEvents(), { wrapper });
    return messageHandlerRef.current;
  }

  it("写入 runtime_progress 到所有匹配的 tasks 列表分页缓存", () => {
    // 两个分页变体（不同 status/limit/offset），都应被更新
    queryClient.setQueryData(queryKeys.tasks("all", 20, 0), makeTasksPage([makeTask({ id: "t-1" })]));
    queryClient.setQueryData(queryKeys.tasks("in_progress", 50, 0), makeTasksPage([makeTask({ id: "t-1" })]));

    const handler = mountAndWaitForConnection();
    expect(handler).not.toBeNull();

    act(() => {
      handler!({ data: JSON.stringify({
        type: "task_update",
        taskId: "t-1",
        status: "in_progress",
        progress: { stage: "generating", progress: 42, processed: 5, total: 10, current_node: "nodeA" },
      }) });
    });

    const page1 = queryClient.getQueryData<ReturnType<typeof makeTasksPage>>(queryKeys.tasks("all", 20, 0));
    const page2 = queryClient.getQueryData<ReturnType<typeof makeTasksPage>>(queryKeys.tasks("in_progress", 50, 0));
    expect(page1?.tasks[0]?.runtime_progress).toEqual({
      stage: "generating",
      percent: 42,
      completed: 5,
      total: 10,
      current: "nodeA",
    });
    expect(page2?.tasks[0]?.runtime_progress).toEqual({
      stage: "generating",
      percent: 42,
      completed: 5,
      total: 10,
      current: "nodeA",
    });
  });

  it("不命中不匹配的任务 ID 时不动其他任务的 runtime_progress", () => {
    const other = makeTask({ id: "t-other" });
    queryClient.setQueryData(queryKeys.tasks("all", 20, 0), makeTasksPage([other]));

    const handler = mountAndWaitForConnection();

    act(() => {
      handler!({ data: JSON.stringify({
        type: "task_update",
        taskId: "t-1",
        status: "in_progress",
        progress: { stage: "x", progress: 10 },
      }) });
    });

    const page = queryClient.getQueryData<ReturnType<typeof makeTasksPage>>(queryKeys.tasks("all", 20, 0));
    expect(page?.tasks[0]?.id).toBe("t-other");
    expect(page?.tasks[0]?.runtime_progress).toBeUndefined();
  });

  it("progress 字段缺失时不写入 runtime_progress", () => {
    queryClient.setQueryData(queryKeys.tasks("all", 20, 0), makeTasksPage([makeTask({ id: "t-1" })]));

    const handler = mountAndWaitForConnection();

    act(() => {
      handler!({ data: JSON.stringify({
        type: "task_update",
        taskId: "t-1",
        status: "in_progress",
        // progress 字段不存在
      }) });
    });

    const page = queryClient.getQueryData<ReturnType<typeof makeTasksPage>>(queryKeys.tasks("all", 20, 0));
    expect(page?.tasks[0]?.runtime_progress).toBeUndefined();
  });

  it("状态从 in_progress 变化时发布 scheduler_task_status_changed 事件", () => {
    queryClient.setQueryData(queryKeys.tasks("all", 20, 0), makeTasksPage([makeTask({ id: "t-1", status: "in_progress" })]));

    const handler = mountAndWaitForConnection();

    act(() => {
      handler!({ data: JSON.stringify({
        type: "task_update",
        taskId: "t-1",
        status: "completed",
        progress: { progress: 100 },
      }) });
    });

    const publishCalls = vi.mocked(frontendEventBus.publish).mock.calls;
    const statusChangeCalls = publishCalls.filter(
      (call) => call[0] === "scheduler_task_status_changed",
    );
    expect(statusChangeCalls.length).toBe(1);
    expect(statusChangeCalls[0]?.[1]).toEqual({
      taskId: "t-1",
      oldStatus: "in_progress",
      newStatus: "completed",
      taskType: undefined,
    });
  });

  it("缓存中找不到任务时不应发布状态变化事件", () => {
    // 缓存为空
    const handler = mountAndWaitForConnection();

    act(() => {
      handler!({ data: JSON.stringify({
        type: "task_update",
        taskId: "t-unknown",
        status: "completed",
      }) });
    });

    const publishCalls = vi.mocked(frontendEventBus.publish).mock.calls;
    const statusChangeCalls = publishCalls.filter(
      (call) => call[0] === "scheduler_task_status_changed",
    );
    expect(statusChangeCalls.length).toBe(0);
  });
});

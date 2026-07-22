// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useTaskActions } from "../useTaskActions";
import { message } from "../../utils/messageHelper";
import type { UserTask, CreateUserTaskData, KnowledgePoint } from "@shared/types";

const mocks = vi.hoisted(() => ({
  createMutate: vi.fn(),
  updateMutate: vi.fn(),
  deleteMutate: vi.fn(),
  startMutate: vi.fn(),
  pauseMutate: vi.fn(),
  completeMutate: vi.fn(),
  addTaskKnowledgePoint: vi.fn(),
  searchSimilar: vi.fn(),
  asyncConfirm: vi.fn(),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: "zh-CN" } }),
}));

vi.mock("../scheduler/useScheduler", () => ({
  useCreateUserTaskMutation: () => ({ mutateAsync: mocks.createMutate }),
  useUpdateUserTaskMutation: () => ({ mutateAsync: mocks.updateMutate }),
  useDeleteUserTaskMutation: () => ({ mutateAsync: mocks.deleteMutate }),
  useStartUserTaskMutation: () => ({ mutateAsync: mocks.startMutate }),
  usePauseUserTaskMutation: () => ({ mutateAsync: mocks.pauseMutate }),
  useCompleteUserTaskMutation: () => ({ mutateAsync: mocks.completeMutate }),
}));

vi.mock("../../services/api", () => ({
  api: {
    scheduler: { addTaskKnowledgePoint: mocks.addTaskKnowledgePoint },
    knowledgePoints: { searchSimilar: mocks.searchSimilar },
  },
}));

vi.mock("../../utils/asyncConfirm", () => ({
  asyncConfirm: mocks.asyncConfirm,
}));

function makeTask(overrides: Partial<UserTask> = {}): UserTask {
  return {
    id: "task-1",
    user_id: "user-1",
    title: "Task",
    queue_level: 1,
    position: 0,
    status: "pending",
    ...overrides,
  } as UserTask;
}

function makeCreateData(overrides: Partial<CreateUserTaskData> = {}): CreateUserTaskData {
  return { title: "New Task", queue_level: 1, ...overrides } as CreateUserTaskData;
}

describe("useTaskActions", () => {
  const refetchQueues = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(message, "success").mockReturnValue("test-id");
    vi.spyOn(message, "error").mockReturnValue("test-id");
    mocks.createMutate.mockResolvedValue(undefined);
    mocks.updateMutate.mockResolvedValue(undefined);
    mocks.deleteMutate.mockResolvedValue(undefined);
    mocks.startMutate.mockResolvedValue(undefined);
    mocks.pauseMutate.mockResolvedValue(undefined);
    mocks.completeMutate.mockResolvedValue(undefined);
    mocks.addTaskKnowledgePoint.mockResolvedValue(undefined);
    mocks.asyncConfirm.mockResolvedValue(true);
  });

  it("应该返回正确的初始状态", () => {
    const { result } = renderHook(() => useTaskActions(refetchQueues));
    expect(result.current.showTaskForm).toBe(false);
    expect(result.current.editingTask).toBeNull();
    expect(result.current.defaultQueueLevel).toBe(2);
    expect(result.current.linkingTaskId).toBeNull();
    expect(result.current.knowledgePointSearch).toBe("");
    expect(result.current.searchResults).toEqual([]);
  });

  it("openAddTaskForm 应该打开表单并设置默认队列级别", () => {
    const { result } = renderHook(() => useTaskActions(refetchQueues));
    act(() => { result.current.openAddTaskForm(3); });
    expect(result.current.showTaskForm).toBe(true);
    expect(result.current.defaultQueueLevel).toBe(3);
    expect(result.current.editingTask).toBeNull();
  });

  it("openAddTaskForm 不传参时默认队列级别为 2", () => {
    const { result } = renderHook(() => useTaskActions(refetchQueues));
    act(() => { result.current.openAddTaskForm(); });
    expect(result.current.defaultQueueLevel).toBe(2);
    expect(result.current.showTaskForm).toBe(true);
  });

  it("openEditTaskForm 应该设置 editingTask 并打开表单", () => {
    const { result } = renderHook(() => useTaskActions(refetchQueues));
    const task = makeTask({ id: "t-2" });
    act(() => { result.current.openEditTaskForm(task); });
    expect(result.current.editingTask).toEqual(task);
    expect(result.current.showTaskForm).toBe(true);
  });

  it("handleCreateTask 成功时应该调用 mutation、发布成功消息并关闭表单", async () => {
    const { result } = renderHook(() => useTaskActions(refetchQueues));
    act(() => { result.current.openAddTaskForm(); });
    const data = makeCreateData();
    await act(async () => { await result.current.handleCreateTask(data); });
    expect(mocks.createMutate).toHaveBeenCalledWith(data);
    expect(message.success).toHaveBeenCalledWith("toast.workbench.taskCreateSuccess");
    expect(result.current.showTaskForm).toBe(false);
  });

  it("handleCreateTask 失败时应该发布错误消息", async () => {
    mocks.createMutate.mockRejectedValueOnce(new Error("create failed"));
    const { result } = renderHook(() => useTaskActions(refetchQueues));
    const data = makeCreateData();
    await act(async () => { await result.current.handleCreateTask(data); });
    expect(message.error).toHaveBeenCalledWith("create failed");
  });

  it("handleCreateTask 失败时非 Error 对象应使用兜底消息", async () => {
    mocks.createMutate.mockRejectedValueOnce("string error");
    const { result } = renderHook(() => useTaskActions(refetchQueues));
    await act(async () => { await result.current.handleCreateTask(makeCreateData()); });
    expect(message.error).toHaveBeenCalledWith("toast.workbench.taskCreateFailed");
  });

  it("handleUpdateTask 应该使用 editingTask.id 调用 mutation", async () => {
    const { result } = renderHook(() => useTaskActions(refetchQueues));
    const task = makeTask({ id: "t-edit" });
    act(() => { result.current.openEditTaskForm(task); });
    const data = makeCreateData({ title: "Updated" });
    await act(async () => { await result.current.handleUpdateTask(data); });
    expect(mocks.updateMutate).toHaveBeenCalledWith({ id: "t-edit", data });
    expect(result.current.editingTask).toBeNull();
    expect(result.current.showTaskForm).toBe(false);
  });

  it("handleUpdateTask 没有 editingTask 时应直接返回", async () => {
    const { result } = renderHook(() => useTaskActions(refetchQueues));
    await act(async () => { await result.current.handleUpdateTask(makeCreateData()); });
    expect(mocks.updateMutate).not.toHaveBeenCalled();
  });

  it("handleUpdateTask 失败时应发布错误消息", async () => {
    mocks.updateMutate.mockRejectedValueOnce(new Error("update fail"));
    const { result } = renderHook(() => useTaskActions(refetchQueues));
    act(() => { result.current.openEditTaskForm(makeTask({ id: "t-1" })); });
    await act(async () => { await result.current.handleUpdateTask(makeCreateData()); });
    expect(message.error).toHaveBeenCalledWith("update fail");
  });

  it("handleDeleteTask 确认后应调用 delete mutation", async () => {
    const { result } = renderHook(() => useTaskActions(refetchQueues));
    const task = makeTask({ id: "t-del" });
    await act(async () => { await result.current.handleDeleteTask(task); });
    expect(mocks.asyncConfirm).toHaveBeenCalled();
    expect(mocks.deleteMutate).toHaveBeenCalledWith("t-del");
    expect(message.success).toHaveBeenCalledWith("toast.workbench.taskDeleted");
  });

  it("handleDeleteTask 取消确认时不应调用 delete mutation", async () => {
    mocks.asyncConfirm.mockResolvedValueOnce(false);
    const { result } = renderHook(() => useTaskActions(refetchQueues));
    await act(async () => { await result.current.handleDeleteTask(makeTask()); });
    expect(mocks.deleteMutate).not.toHaveBeenCalled();
  });

  it("handleStartTask 应该调用 start mutation 并发布成功", async () => {
    const { result } = renderHook(() => useTaskActions(refetchQueues));
    const task = makeTask({ id: "t-start" });
    await act(async () => { await result.current.handleStartTask(task); });
    expect(mocks.startMutate).toHaveBeenCalledWith("t-start");
    expect(message.success).toHaveBeenCalledWith("toast.workbench.taskStarted");
  });

  it("handlePauseTask 应该调用 pause mutation", async () => {
    const { result } = renderHook(() => useTaskActions(refetchQueues));
    await act(async () => { await result.current.handlePauseTask(makeTask({ id: "t-pause" })); });
    expect(mocks.pauseMutate).toHaveBeenCalledWith("t-pause");
    expect(message.success).toHaveBeenCalledWith("toast.workbench.taskPaused");
  });

  it("handleCompleteTask 应该调用 complete mutation", async () => {
    const { result } = renderHook(() => useTaskActions(refetchQueues));
    await act(async () => { await result.current.handleCompleteTask(makeTask({ id: "t-done" })); });
    expect(mocks.completeMutate).toHaveBeenCalledWith("t-done");
    expect(message.success).toHaveBeenCalledWith("toast.workbench.taskCompleted");
  });

  it("handleStartTask 失败时应发布错误消息", async () => {
    mocks.startMutate.mockRejectedValueOnce(new Error("start fail"));
    const { result } = renderHook(() => useTaskActions(refetchQueues));
    await act(async () => { await result.current.handleStartTask(makeTask()); });
    expect(message.error).toHaveBeenCalledWith("start fail");
  });

  it("handleLinkKnowledgePoint 成功时应调用 API、清理状态并 refetch", async () => {
    const { result } = renderHook(() => useTaskActions(refetchQueues));
    act(() => {
      result.current.setLinkingTaskId("t-link");
      result.current.setKnowledgePointSearch("keyword");
    });
    await act(async () => {
      await result.current.handleLinkKnowledgePoint("t-link", "kp-1");
    });
    expect(mocks.addTaskKnowledgePoint).toHaveBeenCalledWith("t-link", {
      knowledge_point_id: "kp-1",
    });
    expect(message.success).toHaveBeenCalledWith("toast.workbench.knowledgePointLinked");
    expect(result.current.linkingTaskId).toBeNull();
    expect(result.current.knowledgePointSearch).toBe("");
    expect(result.current.searchResults).toEqual([]);
    expect(refetchQueues).toHaveBeenCalled();
  });

  it("handleLinkKnowledgePoint 失败时应发布错误消息且不清理状态", async () => {
    mocks.addTaskKnowledgePoint.mockRejectedValueOnce(new Error("link fail"));
    const { result } = renderHook(() => useTaskActions(refetchQueues));
    act(() => { result.current.setLinkingTaskId("t-link"); });
    await act(async () => {
      await result.current.handleLinkKnowledgePoint("t-link", "kp-1");
    });
    expect(message.error).toHaveBeenCalledWith("link fail");
    expect(result.current.linkingTaskId).toBe("t-link");
  });

  it("searchKnowledgePoints 在空查询时应清空搜索结果", async () => {
    const { result } = renderHook(() => useTaskActions(refetchQueues));
    act(() => {
      result.current.setSearchResults([{ id: "kp-1" } as KnowledgePoint]);
    });
    await act(async () => { await result.current.searchKnowledgePoints("   "); });
    expect(mocks.searchSimilar).not.toHaveBeenCalled();
    expect(result.current.searchResults).toEqual([]);
  });

  it("searchKnowledgePoints 应调用 API 并设置结果", async () => {
    const fakeResults = [{ id: "kp-1" }, { id: "kp-2" }];
    mocks.searchSimilar.mockResolvedValueOnce(fakeResults);
    const { result } = renderHook(() => useTaskActions(refetchQueues));
    await act(async () => { await result.current.searchKnowledgePoints("test"); });
    expect(mocks.searchSimilar).toHaveBeenCalledWith({ query: "test", limit: 5 });
    expect(result.current.searchResults).toEqual(fakeResults);
  });

  it("searchKnowledgePoints 失败时不应抛出", async () => {
    mocks.searchSimilar.mockRejectedValueOnce(new Error("search fail"));
    const { result } = renderHook(() => useTaskActions(refetchQueues));
    await act(async () => { await result.current.searchKnowledgePoints("test"); });
    expect(result.current.searchResults).toEqual([]);
  });

  it("refetchQueues 应该透传为返回值的 refetchQueues", () => {
    const { result } = renderHook(() => useTaskActions(refetchQueues));
    expect(result.current.refetchQueues).toBe(refetchQueues);
  });
});

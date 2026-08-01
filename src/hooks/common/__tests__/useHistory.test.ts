// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useHistory, type HistoryAction } from "../useHistory";

function createMockMutations() {
  return {
    createNode: vi.fn().mockResolvedValue({ id: "mock-id" }),
    updateNode: vi.fn().mockResolvedValue({}),
    deleteNode: vi.fn().mockResolvedValue(undefined),
    createEdge: vi.fn().mockResolvedValue({ id: "mock-edge-id" }),
    deleteEdge: vi.fn().mockResolvedValue(undefined),
  };
}

describe("useHistory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("record 应该向历史栈添加记录并清空 future", () => {
    const mutations = createMockMutations();
    const { result } = renderHook(() => useHistory(mutations));

    const action: HistoryAction = {
      type: "CREATE_NODE",
      payload: { id: "1", title: "test", graph_id: "g1" } as any,
    };

    act(() => {
      result.current.record(action);
    });

    expect(result.current.past).toHaveLength(1);
    expect(result.current.past[0]).toEqual(action);
    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(false);
  });

  it("record 应在已有记录时正确追加到 past 并清空 future", () => {
    const mutations = createMockMutations();
    const { result } = renderHook(() => useHistory(mutations));

    const action1: HistoryAction = {
      type: "CREATE_NODE",
      payload: { id: "1", graph_id: "g1" } as any,
    };
    const action2: HistoryAction = {
      type: "UPDATE_NODE",
      payload: { id: "1", before: { title: "old" }, after: { title: "new" } } as any,
    };

    act(() => {
      result.current.record(action1);
    });
    act(() => {
      result.current.record(action2);
    });

    expect(result.current.past).toHaveLength(2);
    expect(result.current.canUndo).toBe(true);
  });

  it("undo 应该将最后一条记录移入 future 并调用对应的撤销函数", async () => {
    const mutations = createMockMutations();
    const { result } = renderHook(() => useHistory(mutations));

    const action: HistoryAction = {
      type: "CREATE_NODE",
      payload: { id: "node-1", graph_id: "g1" } as any,
    };

    act(() => {
      result.current.record(action);
    });

    await act(async () => {
      await result.current.undo();
    });

    expect(result.current.past).toHaveLength(0);
    expect(result.current.future).toHaveLength(1);
    expect(result.current.future[0]).toEqual(action);
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(true);
    expect(mutations.deleteNode).toHaveBeenCalledWith({
      id: "node-1",
      graphId: "g1",
    });
  });

  it("空历史栈时 undo 不应产生任何效果", async () => {
    const mutations = createMockMutations();
    const { result } = renderHook(() => useHistory(mutations));

    expect(result.current.past).toHaveLength(0);
    expect(result.current.canUndo).toBe(false);

    await act(async () => {
      await result.current.undo();
    });

    // undo 不应改变状态
    expect(result.current.past).toHaveLength(0);
    expect(result.current.future).toHaveLength(0);
    expect(mutations.deleteNode).not.toHaveBeenCalled();
    expect(mutations.createNode).not.toHaveBeenCalled();
  });

  it("redo 应该将 future 中的记录移回 past", async () => {
    const mutations = createMockMutations();
    const { result } = renderHook(() => useHistory(mutations));

    const action: HistoryAction = {
      type: "CREATE_NODE",
      payload: { id: "node-1", graph_id: "g1" } as any,
    };

    act(() => {
      result.current.record(action);
    });

    await act(async () => {
      await result.current.undo();
    });

    // 现在 future 有记录，past 为空
    expect(result.current.canRedo).toBe(true);

    await act(async () => {
      await result.current.redo();
    });

    // redo 后 past 应恢复记录，future 为空
    expect(result.current.past).toHaveLength(1);
    expect(result.current.past[0]).toEqual(action);
    expect(result.current.future).toHaveLength(0);
    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(false);
    expect(mutations.createNode).toHaveBeenCalledWith(action.payload);
  });

  it("空 future 时 redo 不应产生任何效果", async () => {
    const mutations = createMockMutations();
    const { result } = renderHook(() => useHistory(mutations));

    expect(result.current.canRedo).toBe(false);

    await act(async () => {
      await result.current.redo();
    });

    expect(result.current.past).toHaveLength(0);
    expect(result.current.future).toHaveLength(0);
  });

  it("clear 应清空 past 和 future 栈", () => {
    const mutations = createMockMutations();
    const { result } = renderHook(() => useHistory(mutations));

    const action: HistoryAction = {
      type: "CREATE_NODE",
      payload: { id: "1", graph_id: "g1" } as any,
    };

    act(() => {
      result.current.record(action);
    });

    expect(result.current.canUndo).toBe(true);

    act(() => {
      result.current.clear();
    });

    expect(result.current.past).toHaveLength(0);
    expect(result.current.future).toHaveLength(0);
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
  });

  it("canUndo 和 canRedo 应正确反映栈状态", () => {
    const mutations = createMockMutations();
    const { result } = renderHook(() => useHistory(mutations));

    // 初始状态：两个都是 false
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);

    const action: HistoryAction = {
      type: "CREATE_NODE",
      payload: { id: "1", graph_id: "g1" } as any,
    };

    // record 后：canUndo = true
    act(() => {
      result.current.record(action);
    });
    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(false);
  });
});
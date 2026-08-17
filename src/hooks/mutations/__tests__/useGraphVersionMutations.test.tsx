// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import {
  useCreateSnapshot,
  useRollback,
  useCreateBranch,
  useMergeBranch,
  useDeleteBranch,
} from "../useGraphVersionMutations";
import { queryKeys } from "../../queries/config";

const mocks = vi.hoisted(() => {
  const apiMock = {
    graphs: { delete: vi.fn() },
    graphVersions: {
      createSnapshot: vi.fn(),
      rollback: vi.fn(),
      createBranch: vi.fn(),
      merge: vi.fn(),
    },
  };
  return {
    apiMock,
    publish: vi.fn(),
    messageSuccess: vi.fn(),
    messageError: vi.fn(),
    createSnapshot: apiMock.graphVersions.createSnapshot,
    rollback: apiMock.graphVersions.rollback,
    createBranch: apiMock.graphVersions.createBranch,
    merge: apiMock.graphVersions.merge,
    graphsDelete: apiMock.graphs.delete,
  };
});

vi.mock("../../../utils/messageHelper", () => ({
  message: {
    success: mocks.messageSuccess,
    error: mocks.messageError,
    info: vi.fn(),
    warning: vi.fn(),
  },
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: "zh-CN" } }),
}));

vi.mock("../../../services/timer/FrontendEventBus", () => ({
  frontendEventBus: { publish: mocks.publish },
}));

vi.mock("../../../services/api/adapter", () => ({ api: mocks.apiMock }));

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }): ReactNode {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

const GRAPH_ID = "g1";

describe("Graph version mutations", () => {
  let queryClient: QueryClient;

  const isInvalidated = (key: readonly unknown[]) =>
    queryClient.getQueryState(key)?.isInvalidated;

  /** 向指定 key 播种最小缓存，使 invalidateQueries 能命中并标记 isInvalidated */
  const seedCache = (key: readonly unknown[], data: unknown) => {
    queryClient.setQueryData(key, data);
  };

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
  });

  describe("useCreateSnapshot", () => {
    it("成功：调用 API、显示成功 toast 并失效快照列表缓存", async () => {
      const snapshotsKey = queryKeys.graphSnapshots(GRAPH_ID);
      seedCache(snapshotsKey, { items: [], total: 0 });
      mocks.createSnapshot.mockResolvedValue({
        id: "snap-1",
        graph_id: GRAPH_ID,
        description: "手动快照",
        created_at: "2026-08-17T00:00:00Z",
        node_count: 0,
        edge_count: 0,
      });

      const { result } = renderHook(() => useCreateSnapshot(GRAPH_ID), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        await result.current.mutateAsync("手动快照");
      });

      expect(mocks.createSnapshot).toHaveBeenCalledWith(GRAPH_ID, "手动快照");
      expect(mocks.messageSuccess).toHaveBeenCalledWith(
        "toast.graph.snapshotCreated",
      );
      await waitFor(() => {
        expect(isInvalidated(snapshotsKey)).toBe(true);
      });
      expect(mocks.publish).not.toHaveBeenCalled();
    });

    it("失败：显示错误 toast 且不失效缓存", async () => {
      const snapshotsKey = queryKeys.graphSnapshots(GRAPH_ID);
      seedCache(snapshotsKey, { items: [], total: 0 });
      mocks.createSnapshot.mockRejectedValue(new Error("snapshot failed"));

      const { result } = renderHook(() => useCreateSnapshot(GRAPH_ID), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        await expect(result.current.mutateAsync()).rejects.toThrow(
          "snapshot failed",
        );
      });

      expect(mocks.messageError).toHaveBeenCalledWith(
        "toast.graph.snapshotCreateFailed",
      );
      expect(isInvalidated(snapshotsKey)).not.toBe(true);
    });
  });

  describe("useRollback", () => {
    const rollbackKeys = () => ({
      snapshots: queryKeys.graphSnapshots(GRAPH_ID),
      graphData: queryKeys.graphData(GRAPH_ID),
      graph: queryKeys.graph(GRAPH_ID),
      graphs: queryKeys.graphs,
    });

    it("成功：失效快照/图数据/图详情/图列表四个缓存并发布回滚事件", async () => {
      const keys = rollbackKeys();
      seedCache(keys.snapshots, { items: [], total: 0 });
      seedCache(keys.graphData, { nodes: [], edges: [] });
      seedCache(keys.graph, { id: GRAPH_ID, title: "g" });
      seedCache(keys.graphs, []);
      mocks.rollback.mockResolvedValue({
        success: true,
        preRollbackSnapshotId: "snap-0",
      });

      const { result } = renderHook(() => useRollback(GRAPH_ID), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        await result.current.mutateAsync("snap-1");
      });

      expect(mocks.rollback).toHaveBeenCalledWith(GRAPH_ID, "snap-1");
      expect(mocks.messageSuccess).toHaveBeenCalledWith(
        "toast.graph.snapshotRestored",
      );
      await waitFor(() => {
        expect(isInvalidated(keys.snapshots)).toBe(true);
      });
      expect(isInvalidated(keys.graphData)).toBe(true);
      expect(isInvalidated(keys.graph)).toBe(true);
      expect(isInvalidated(keys.graphs)).toBe(true);
      expect(mocks.publish).toHaveBeenCalledWith("graph_data_changed", {
        graphId: GRAPH_ID,
        changeType: "graph_rollback",
      });
    });

    it("失败：显示错误 toast、不失效缓存、不发布事件", async () => {
      const keys = rollbackKeys();
      seedCache(keys.graphData, { nodes: [], edges: [] });
      mocks.rollback.mockRejectedValue(new Error("rollback failed"));

      const { result } = renderHook(() => useRollback(GRAPH_ID), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        await expect(result.current.mutateAsync("snap-1")).rejects.toThrow(
          "rollback failed",
        );
      });

      expect(mocks.messageError).toHaveBeenCalledWith(
        "toast.graph.snapshotRestoreFailed",
      );
      expect(isInvalidated(keys.graphData)).not.toBe(true);
      expect(mocks.publish).not.toHaveBeenCalled();
    });
  });

  describe("useCreateBranch", () => {
    it("成功：失效分支列表缓存并发布 graph_list_changed 事件", async () => {
      const branchesKey = queryKeys.graphBranches(GRAPH_ID);
      seedCache(branchesKey, []);
      mocks.createBranch.mockResolvedValue({
        graphId: "g-branch",
        snapshotId: "snap-1",
      });

      const { result } = renderHook(() => useCreateBranch(GRAPH_ID), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        await result.current.mutateAsync("实验分支");
      });

      expect(mocks.createBranch).toHaveBeenCalledWith(GRAPH_ID, "实验分支");
      expect(mocks.messageSuccess).toHaveBeenCalledWith(
        "toast.graph.branchCreated",
      );
      await waitFor(() => {
        expect(isInvalidated(branchesKey)).toBe(true);
      });
      expect(mocks.publish).toHaveBeenCalledWith("graph_list_changed", {
        graphId: GRAPH_ID,
        changeType: "graph_created",
      });
    });
  });

  describe("useMergeBranch", () => {
    it("成功：透传合并参数、失效图数据缓存并发布合并事件", async () => {
      const graphDataKey = queryKeys.graphData(GRAPH_ID);
      seedCache(graphDataKey, { nodes: [], edges: [] });
      mocks.merge.mockResolvedValue({
        nodesAdded: 2,
        edgesAdded: 1,
        nodesModified: 0,
        edgesModified: 0,
        nodesRemoved: 0,
        edgesRemoved: 0,
        conflictsResolved: 0,
      });

      const { result } = renderHook(() => useMergeBranch(GRAPH_ID), {
        wrapper: createWrapper(queryClient),
      });

      const variables = {
        branchGraphId: "g-branch",
        selectedChanges: { nodeIds: ["n1", "n2"] },
        conflictResolutions: { c1: "main" as const },
      };

      await act(async () => {
        await result.current.mutateAsync(variables);
      });

      expect(mocks.merge).toHaveBeenCalledWith(
        GRAPH_ID,
        "g-branch",
        { nodeIds: ["n1", "n2"] },
        { c1: "main" },
      );
      expect(mocks.messageSuccess).toHaveBeenCalledWith(
        "toast.graph.branchMerged",
      );
      await waitFor(() => {
        expect(isInvalidated(graphDataKey)).toBe(true);
      });
      expect(mocks.publish).toHaveBeenCalledWith("graph_data_changed", {
        graphId: GRAPH_ID,
        changeType: "ai_action_executed",
      });
    });
  });

  describe("useDeleteBranch", () => {
    it("成功：删除分支图、失效分支列表并发布 graph_deleted 事件", async () => {
      const branchesKey = queryKeys.graphBranches(GRAPH_ID);
      seedCache(branchesKey, [{ id: "g-branch", title: "实验分支" }]);
      mocks.graphsDelete.mockResolvedValue(undefined);

      const { result } = renderHook(() => useDeleteBranch(GRAPH_ID), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        await result.current.mutateAsync("g-branch");
      });

      expect(mocks.graphsDelete).toHaveBeenCalledWith("g-branch");
      expect(mocks.messageSuccess).toHaveBeenCalledWith(
        "toast.graph.branchDeleted",
      );
      await waitFor(() => {
        expect(isInvalidated(branchesKey)).toBe(true);
      });
      expect(mocks.publish).toHaveBeenCalledWith("graph_list_changed", {
        graphId: GRAPH_ID,
        changeType: "graph_deleted",
      });
    });

    it("失败：显示错误 toast 且不发布事件", async () => {
      const branchesKey = queryKeys.graphBranches(GRAPH_ID);
      seedCache(branchesKey, []);
      mocks.graphsDelete.mockRejectedValue(new Error("delete failed"));

      const { result } = renderHook(() => useDeleteBranch(GRAPH_ID), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        await expect(result.current.mutateAsync("g-branch")).rejects.toThrow(
          "delete failed",
        );
      });

      expect(mocks.messageError).toHaveBeenCalledWith(
        "toast.graph.branchDeleteFailed",
      );
      expect(mocks.publish).not.toHaveBeenCalled();
    });
  });
});

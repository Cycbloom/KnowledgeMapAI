// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import type { Node, Edge, Graph } from "../../../types";
import type { CreateNodeData } from "@shared/types/api";
import {
  useCreateNodeMutation,
  useUpdateNodeOptimisticMutation,
  useDeleteNodeMutation,
  useBatchDeleteNodesMutation,
  useToggleFavoriteMutation,
  useDeleteEdgeMutation,
} from "../useGraphMutations";
import { queryKeys } from "../../queries/config";

const mocks = vi.hoisted(() => {
  // 统一的 api mock — adapter（useGraphMutations 直接依赖）与 barrel（useStudyMutations/useTaskMutations 依赖）共用
  const apiMock = {
    graphs: {
      create: vi.fn(),
      createFromTemplate: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      restore: vi.fn(),
      permanentDelete: vi.fn(),
      batchDelete: vi.fn(),
      batchRestore: vi.fn(),
      batchPermanentDelete: vi.fn(),
      toggleFavorite: vi.fn(),
    },
    nodes: {
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      batchDelete: vi.fn(),
    },
    edges: {
      create: vi.fn(),
      delete: vi.fn(),
    },
    data: { import: vi.fn(), export: vi.fn() },
    ai: {
      generateContent: vi.fn(),
      expand: vi.fn(),
      generateCards: vi.fn(),
      documentToGraph: vi.fn(),
      imageToGraph: vi.fn(),
      recommendConnections: vi.fn(),
      textToGraph: vi.fn(),
    },
    study: { createCardsBatch: vi.fn() },
    tasks: { create: vi.fn() },
  };
  return {
    apiMock,
    publish: vi.fn(),
    messageSuccess: vi.fn(),
    messageError: vi.fn(),
    nodesCreate: apiMock.nodes.create,
    nodesUpdate: apiMock.nodes.update,
    nodesDelete: apiMock.nodes.delete,
    nodesBatchDelete: apiMock.nodes.batchDelete,
    edgesDelete: apiMock.edges.delete,
    graphsToggleFavorite: apiMock.graphs.toggleFavorite,
  };
});

// Mock messageHelper — onMutate/onError 路径中的 toast 副作用
vi.mock("../../../utils/messageHelper", () => ({
  message: {
    success: mocks.messageSuccess,
    error: mocks.messageError,
    info: vi.fn(),
    warning: vi.fn(),
  },
  getErrorMessage: (error: unknown) =>
    error instanceof Error ? error.message : "unknown error",
}));

// Mock react-i18next — mutationFactory 顶层 import 依赖
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: "zh-CN" } }),
}));

// Mock FrontendEventBus — onSettled 事件发布
vi.mock("../../../services/timer/FrontendEventBus", () => ({
  frontendEventBus: { publish: mocks.publish },
}));

vi.mock("../../../services/api/adapter", () => ({ api: mocks.apiMock }));
vi.mock("../../../services/api", () => ({ api: mocks.apiMock }));

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }): ReactNode {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

type GraphData = { nodes: Node[]; edges: Edge[] };

function makeNode(id: string, extra: Partial<Node> = {}): Node {
  return {
    id,
    graph_id: "g1",
    knowledge_point_id: `kp-${id}`,
    title: `title ${id}`,
    x_position: 0,
    y_position: 0,
    level: "normal",
    is_accepted: true,
    visibility: "private",
    owner_id: "u1",
    created_at: "2026-08-17T00:00:00Z",
    updated_at: "2026-08-17T00:00:00Z",
    ...extra,
  };
}

function makeEdge(
  id: string,
  source: string,
  target: string,
  extra: Partial<Edge> = {},
): Edge {
  return {
    id,
    graph_id: "g1",
    source_knowledge_point_id: source,
    target_knowledge_point_id: target,
    ...extra,
  };
}

function makeGraph(id: string, extra: Partial<Graph> = {}): Graph {
  return {
    id,
    title: `graph ${id}`,
    created_at: "2026-08-17T00:00:00Z",
    ...extra,
  };
}

describe("Graph mutations 乐观更新与回滚", () => {
  let queryClient: QueryClient;
  const graphDataKey = queryKeys.graphData("g1");

  const seedGraphData = (data: GraphData) => {
    queryClient.setQueryData<GraphData>(graphDataKey, data);
  };

  const getGraphData = (): GraphData | undefined =>
    queryClient.getQueryData<GraphData>(graphDataKey);

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
  });

  describe("useCreateNodeMutation", () => {
    const variables: CreateNodeData = {
      graph_id: "g1",
      title: "new node",
      x_position: 10,
      y_position: 20,
    };

    it("成功：乐观插入 temp 节点，成功后被服务端节点替换并发布事件", async () => {
      seedGraphData({ nodes: [makeNode("n1")], edges: [] });

      // 用受控 Promise 捕获乐观中间态
      const deferred: { resolve: (node: Node) => void } = {
        resolve: () => undefined,
      };
      mocks.nodesCreate.mockImplementation(
        () =>
          new Promise<Node>((resolve) => {
            deferred.resolve = resolve;
          }),
      );

      const { result } = renderHook(() => useCreateNodeMutation(), {
        wrapper: createWrapper(queryClient),
      });

      let promise: Promise<Node> | undefined;
      act(() => {
        promise = result.current.mutateAsync(variables);
      });

      // 乐观中间态：缓存出现 temp- 前缀节点
      await waitFor(() => {
        expect(
          getGraphData()?.nodes.some((n) => n.id.startsWith("temp-")),
        ).toBe(true);
      });
      expect(getGraphData()?.nodes).toHaveLength(2);

      const serverNode = makeNode("server-node", { title: "new node" });
      await act(async () => {
        deferred.resolve(serverNode);
        await promise;
      });

      // 成功态：temp 节点被服务端数据替换
      await waitFor(() => {
        expect(getGraphData()?.nodes.map((n) => n.id)).toEqual([
          "n1",
          "server-node",
        ]);
      });
      expect(mocks.nodesCreate).toHaveBeenCalledWith(variables);
      expect(mocks.publish).toHaveBeenCalledWith("graph_data_changed", {
        graphId: "g1",
        changeType: "node_created",
      });
    });

    it("失败：回滚缓存至初始状态并提示错误", async () => {
      const initial: GraphData = { nodes: [makeNode("n1")], edges: [] };
      seedGraphData(initial);
      mocks.nodesCreate.mockRejectedValue(new Error("create failed"));

      const { result } = renderHook(() => useCreateNodeMutation(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        await expect(
          result.current.mutateAsync(variables),
        ).rejects.toThrow("create failed");
      });

      await waitFor(() => {
        expect(getGraphData()).toEqual(initial);
      });
      expect(mocks.messageError).toHaveBeenCalled();
      expect(mocks.publish).toHaveBeenCalledWith("graph_data_changed", {
        graphId: "g1",
        changeType: "node_created",
      });
    });
  });

  describe("useUpdateNodeOptimisticMutation", () => {
    it("成功：乐观合并字段，成功后用服务端数据覆盖", async () => {
      seedGraphData({
        nodes: [makeNode("n1", { title: "old title" }), makeNode("n2")],
        edges: [],
      });
      // 用受控 Promise 捕获乐观中间态
      const deferred: { resolve: (node: Node) => void } = {
        resolve: () => undefined,
      };
      mocks.nodesUpdate.mockImplementation(
        () =>
          new Promise<Node>((resolve) => {
            deferred.resolve = resolve;
          }),
      );

      const { result } = renderHook(() => useUpdateNodeOptimisticMutation(), {
        wrapper: createWrapper(queryClient),
      });

      let promise: Promise<Node> | undefined;
      act(() => {
        promise = result.current.mutateAsync({
          id: "n1",
          graphId: "g1",
          data: { title: "optimistic title" },
        });
      });

      // 乐观中间态：title 已更新，其余节点不变
      await waitFor(() => {
        expect(
          getGraphData()?.nodes.find((n) => n.id === "n1")?.title,
        ).toBe("optimistic title");
      });

      const serverNode = makeNode("n1", { title: "server title" });
      await act(async () => {
        deferred.resolve(serverNode);
        await promise;
      });

      // 成功态：以服务端返回为准
      await waitFor(() => {
        expect(
          getGraphData()?.nodes.find((n) => n.id === "n1")?.title,
        ).toBe("server title");
      });
      expect(mocks.publish).toHaveBeenCalledWith("graph_data_changed", {
        graphId: "g1",
        changeType: "node_updated",
      });
    });

    it("失败：回滚节点字段", async () => {
      seedGraphData({ nodes: [makeNode("n1", { title: "old title" })], edges: [] });
      mocks.nodesUpdate.mockRejectedValue(new Error("update failed"));

      const { result } = renderHook(() => useUpdateNodeOptimisticMutation(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        await expect(
          result.current.mutateAsync({
            id: "n1",
            graphId: "g1",
            data: { title: "optimistic title" },
          }),
        ).rejects.toThrow("update failed");
      });

      await waitFor(() => {
        expect(getGraphData()?.nodes.find((n) => n.id === "n1")?.title).toBe(
          "old title",
        );
      });
    });
  });

  describe("useDeleteNodeMutation", () => {
    it("成功：乐观移除节点与悬挂边，并对受影响图谱发布事件", async () => {
      seedGraphData({
        nodes: [makeNode("n1"), makeNode("n2")],
        edges: [
          makeEdge("e1", "n1", "n2"),
          makeEdge("e2", "n2", "n1"),
          makeEdge("e3", "kp-x", "n2"),
        ],
      });
      mocks.nodesDelete.mockResolvedValue({ affected_graphs: ["g1", "g2"] });

      const { result } = renderHook(() => useDeleteNodeMutation(), {
        wrapper: createWrapper(queryClient),
      });

      // n1 被删除 → e1（source=n1）、e2（target=n1）应同步移除，e3 保留
      const promise = result.current.mutateAsync({ id: "n1", graphId: "g1" });

      await waitFor(() => {
        expect(getGraphData()?.nodes.map((n) => n.id)).toEqual(["n2"]);
      });
      await waitFor(() => {
        expect(getGraphData()?.edges.map((e) => e.id)).toEqual(["e3"]);
      });

      await promise;

      expect(mocks.nodesDelete).toHaveBeenCalledWith("n1", undefined);
      // affected_graphs 每个图谱 + variables.graphId 各发布一次
      expect(mocks.publish).toHaveBeenCalledWith("graph_data_changed", {
        graphId: "g1",
        changeType: "node_deleted",
      });
      expect(mocks.publish).toHaveBeenCalledWith("graph_data_changed", {
        graphId: "g2",
        changeType: "node_deleted",
      });
      expect(mocks.publish).toHaveBeenCalledTimes(3);
    });

    it("失败：回滚节点与边", async () => {
      const initial: GraphData = {
        nodes: [makeNode("n1"), makeNode("n2")],
        edges: [makeEdge("e1", "n1", "n2")],
      };
      seedGraphData(initial);
      mocks.nodesDelete.mockRejectedValue(new Error("delete failed"));

      const { result } = renderHook(() => useDeleteNodeMutation(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        await expect(
          result.current.mutateAsync({ id: "n1", graphId: "g1" }),
        ).rejects.toThrow("delete failed");
      });

      await waitFor(() => {
        expect(getGraphData()).toEqual(initial);
      });
      expect(mocks.messageError).toHaveBeenCalled();
    });
  });

  describe("useBatchDeleteNodesMutation", () => {
    it("成功：批量移除节点与关联边", async () => {
      seedGraphData({
        nodes: [makeNode("n1"), makeNode("n2"), makeNode("n3")],
        edges: [
          makeEdge("e1", "n1", "n2"),
          makeEdge("e2", "kp-x", "n3"),
        ],
      });
      mocks.nodesBatchDelete.mockResolvedValue({ count: 2 });

      const { result } = renderHook(() => useBatchDeleteNodesMutation(), {
        wrapper: createWrapper(queryClient),
      });

      await result.current.mutateAsync({ nodeIds: ["n1", "n2"], graphId: "g1" });

      await waitFor(() => {
        expect(getGraphData()?.nodes.map((n) => n.id)).toEqual(["n3"]);
      });
      expect(getGraphData()?.edges.map((e) => e.id)).toEqual(["e2"]);
      expect(mocks.nodesBatchDelete).toHaveBeenCalledWith(["n1", "n2"]);
      expect(mocks.publish).toHaveBeenCalledWith("graph_data_changed", {
        graphId: "g1",
        changeType: "node_deleted",
      });
    });
  });

  describe("useToggleFavoriteMutation", () => {
    const graphsKey = queryKeys.graphs;

    it("成功：乐观更新 graphs 列表中的 is_favorite", async () => {
      queryClient.setQueryData<Graph[]>(graphsKey, [
        makeGraph("g1", { is_favorite: false }),
        makeGraph("g2", { is_favorite: false }),
      ]);
      mocks.graphsToggleFavorite.mockResolvedValue(undefined);

      const { result } = renderHook(() => useToggleFavoriteMutation(), {
        wrapper: createWrapper(queryClient),
      });

      const promise = result.current.mutateAsync({ id: "g1", is_favorite: true });

      await waitFor(() => {
        const cache = queryClient.getQueryData<Graph[]>(graphsKey);
        expect(cache?.find((g) => g.id === "g1")?.is_favorite).toBe(true);
        expect(cache?.find((g) => g.id === "g2")?.is_favorite).toBe(false);
      });

      await promise;
      expect(mocks.graphsToggleFavorite).toHaveBeenCalledWith("g1", true);
      expect(mocks.publish).toHaveBeenCalledWith("graph_list_changed", {
        changeType: "graph_updated",
      });
    });

    it("失败：回滚 is_favorite", async () => {
      queryClient.setQueryData<Graph[]>(graphsKey, [
        makeGraph("g1", { is_favorite: false }),
      ]);
      mocks.graphsToggleFavorite.mockRejectedValue(new Error("toggle failed"));

      const { result } = renderHook(() => useToggleFavoriteMutation(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        await expect(
          result.current.mutateAsync({ id: "g1", is_favorite: true }),
        ).rejects.toThrow("toggle failed");
      });

      await waitFor(() => {
        expect(
          queryClient.getQueryData<Graph[]>(graphsKey)?.[0]?.is_favorite,
        ).toBe(false);
      });
    });
  });

  describe("useDeleteEdgeMutation", () => {
    it("成功：乐观移除边并 invalidate graphData 查询", async () => {
      seedGraphData({
        nodes: [makeNode("n1"), makeNode("n2")],
        edges: [makeEdge("e1", "n1", "n2"), makeEdge("e2", "kp-x", "n2")],
      });
      mocks.edgesDelete.mockResolvedValue(undefined);

      const { result } = renderHook(() => useDeleteEdgeMutation(), {
        wrapper: createWrapper(queryClient),
      });

      await result.current.mutateAsync({ id: "e1", graphId: "g1" });

      await waitFor(() => {
        expect(getGraphData()?.edges.map((e) => e.id)).toEqual(["e2"]);
      });
      // invalidate 断言：查询被标记为失效，触发后续 refetch
      await waitFor(() => {
        expect(
          queryClient.getQueryState(graphDataKey)?.isInvalidated,
        ).toBe(true);
      });
      expect(mocks.edgesDelete).toHaveBeenCalledWith("e1");
    });
  });
});

import { useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../services/api/adapter";
import { Node, Edge, NodeLevel, Graph } from "../../types";
import type { CreateNodeData, UpdateNodeData, UpdateGraphData } from "@shared/types/api";
import {
  queryKeys,
  defaultQueryConfig,
  realtimeQueryConfig,
} from "../queries/config";
import { useCreateCardsBatchMutation } from "./useStudyMutations";
import { useCreateTaskMutation } from "./useTaskMutations";
import { frontendEventBus } from "../../services/timer/FrontendEventBus";
import {
  createSimpleMutation,
  createEventPublishMutation,
  createOptimisticMutation,
} from "./mutationFactory";

// ============================================================
// Event publish mutations — graph list
// ============================================================

export const useCreateGraphMutation = createEventPublishMutation(
  api.graphs.create,
  {
    event: "graph_list_changed",
    getPayload: () => ({ changeType: "graph_created" }),
  },
);

export const useCreateGraphFromTemplateMutation = createEventPublishMutation(
  (data: {
    template_id: string;
    title: string;
    description?: string;
  }) => api.graphs.createFromTemplate(data),
  {
    event: "graph_list_changed",
    getPayload: () => ({ changeType: "graph_created" }),
  },
);

export const useImportGraphMutation = createEventPublishMutation(
  api.data.import,
  {
    event: "graph_list_changed",
    getPayload: () => ({ changeType: "graph_created" }),
  },
);

export const useDeleteGraphMutation = createEventPublishMutation(
  api.graphs.delete,
  {
    event: "graph_list_changed",
    getPayload: () => ({ changeType: "graph_deleted" }),
  },
);

export const useRestoreGraphMutation = createEventPublishMutation(
  api.graphs.restore,
  {
    event: "graph_list_changed",
    getPayload: () => ({ changeType: "graph_restored" }),
  },
);

export const usePermanentDeleteGraphMutation = createEventPublishMutation(
  api.graphs.permanentDelete,
  {
    event: "graph_list_changed",
    getPayload: () => ({ changeType: "graph_permanently_deleted" }),
  },
);

// ============================================================
// Batch operation helper
// ============================================================

const batchOperation = async <T>(
  operation: (ids: string[]) => Promise<T>,
  ids: string[],
  batchSize = 50,
): Promise<{ count: number }> => {
  const results: { count: number }[] = [];
  for (let i = 0; i < ids.length; i += batchSize) {
    const batch = ids.slice(i, i + batchSize);
    const result = await operation(batch);
    results.push(result as { count: number });
  }
  return { count: results.reduce((sum, r) => sum + r.count, 0) };
};

// ============================================================
// Event publish mutations — batch graph operations
// ============================================================

export const useBatchRestoreGraphsMutation = createEventPublishMutation(
  (ids: string[]) => batchOperation(api.graphs.batchRestore, ids),
  {
    event: "graph_list_changed",
    getPayload: () => ({ changeType: "graphs_batch_restored" }),
  },
);

export const useBatchPermanentDeleteGraphsMutation = createEventPublishMutation(
  (ids: string[]) => batchOperation(api.graphs.batchPermanentDelete, ids),
  {
    event: "graph_list_changed",
    getPayload: () => ({ changeType: "graphs_batch_permanently_deleted" }),
  },
);

export const useBatchDeleteGraphsMutation = createEventPublishMutation(
  (ids: string[]) => batchOperation(api.graphs.batchDelete, ids),
  {
    event: "graph_list_changed",
    getPayload: () => ({ changeType: "graphs_batch_deleted" }),
  },
);

// ============================================================
// Optimistic mutation — update graph metadata
// ============================================================

export const useUpdateGraphMutation = createOptimisticMutation({
  mutationFn: ({ id, data }: { id: string; data: UpdateGraphData }) =>
    api.graphs.update(id, data),
  queryKey: queryKeys.graphs,
  optimisticUpdater: (
    old: Graph[] | undefined,
    { id, data }: { id: string; data: UpdateGraphData },
  ) =>
    old?.map((graph) =>
      graph.id === id ? { ...graph, ...data } as Graph : graph,
    ),
  onSettled: (_data, _error, variables) => {
    frontendEventBus.publish("graph_list_changed", { graphId: variables.id, changeType: "graph_updated" });
    frontendEventBus.publish("graph_data_changed", { graphId: variables.id, changeType: "node_updated" });
  },
});

// ============================================================
// Optimistic mutation — toggle favorite
// ============================================================

export const useToggleFavoriteMutation = createOptimisticMutation({
  mutationFn: ({ id, is_favorite }: { id: string; is_favorite: boolean }) =>
    api.graphs.toggleFavorite(id, is_favorite),
  queryKey: queryKeys.graphs,
  optimisticUpdater: (
    old: Graph[] | undefined,
    { id, is_favorite }: { id: string; is_favorite: boolean },
  ) =>
    old?.map((graph) =>
      graph.id === id ? { ...graph, is_favorite } : graph,
    ),
  onSettled: () => {
    frontendEventBus.publish("graph_list_changed", { changeType: "graph_updated" });
  },
});

// ============================================================
// Simple mutations — export & AI
// ============================================================

export const useExportGraphMutation = createSimpleMutation(
  ({ id, format }: { id: string; format: "json" | "pdf" }) =>
    api.data.export(id, format),
);

export const useAIGenerateMutation = createSimpleMutation(
  api.ai.generateContent,
);

export const useAIExpandMutation = createSimpleMutation(api.ai.expand);

export const useAIGenerateCardsMutation = createSimpleMutation(
  api.ai.generateCards,
);

export const useDocumentToGraphMutation = createSimpleMutation(
  api.ai.documentToGraph,
);

export const useImageToGraphMutation = createSimpleMutation(
  api.ai.imageToGraph,
);

export const useRecommendConnectionsMutation = createSimpleMutation(
  api.ai.recommendConnections,
);

// ============================================================
// Optimistic mutations — graph data (nodes & edges)
// ============================================================

export const useCreateNodeMutation = createOptimisticMutation({
  mutationFn: (variables: CreateNodeData) => api.nodes.create(variables),
  queryKey: (vars) => queryKeys.graphData(vars.graph_id),
  optimisticUpdater: (
    old: { nodes: Node[]; edges: Edge[] } | undefined,
    newNodeVariables: CreateNodeData,
  ) => {
    if (!old) return { nodes: [], edges: [] };

    const tempNode: Node = {
      id: `temp-${Date.now()}`,
      x_position: newNodeVariables.x_position ?? 0,
      y_position: newNodeVariables.y_position ?? 0,
      ...newNodeVariables,
      level: newNodeVariables.level as NodeLevel | undefined,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as Node;

    return {
      ...old,
      nodes: [...old.nodes, tempNode],
    };
  },
  onSuccessUpdater: (
    old: { nodes: Node[]; edges: Edge[] } | undefined,
    data: Node,
    variables: CreateNodeData,
  ) => {
    if (!old) return old;
    return {
      ...old,
      nodes: old.nodes.map((node) =>
        node.id.startsWith("temp-") && node.title === variables.title
          ? data
          : node,
      ),
    };
  },
  onSettled: (_data, _error, variables) => {
    frontendEventBus.publish("graph_data_changed", { graphId: variables.graph_id, changeType: "node_created" });
  },
});

export const useUpdateNodeOptimisticMutation = createOptimisticMutation({
  mutationFn: ({
    id,
    data,
    graphId: _graphId,
  }: {
    id: string;
    data: UpdateNodeData;
    graphId: string;
  }) => api.nodes.update(id, data),
  queryKey: (vars) => queryKeys.graphData(vars.graphId),
  optimisticUpdater: (
    old: { nodes: Node[]; edges: Edge[] } | undefined,
    { id, data }: { id: string; data: UpdateNodeData; graphId: string },
  ) => {
    if (!old) return old;
    return {
      ...old,
      nodes: old.nodes.map((node) =>
        node.id === id ? ({ ...node, ...data } as Node) : node,
      ),
    };
  },
  onSuccessUpdater: (
    old: { nodes: Node[]; edges: Edge[] } | undefined,
    data: Node,
    variables: { id: string; data: UpdateNodeData; graphId: string },
  ) => {
    if (!old) return old;
    return {
      ...old,
      nodes: old.nodes.map((node) =>
        node.id === variables.id ? data : node,
      ),
    };
  },
  onSettled: (_data, _error, variables) => {
    frontendEventBus.publish("graph_data_changed", { graphId: variables.graphId, changeType: "node_updated" });
  },
});

export const useDeleteNodeMutation = createOptimisticMutation({
  mutationFn: ({
    id,
    graphId: _graphId,
    hardDelete,
  }: {
    id: string;
    graphId: string;
    hardDelete?: boolean;
  }) => api.nodes.delete(id, hardDelete),
  queryKey: (vars) => queryKeys.graphData(vars.graphId),
  optimisticUpdater: (
    old: { nodes: Node[]; edges: Edge[] } | undefined,
    { id }: { id: string; graphId: string; hardDelete?: boolean },
  ) => {
    if (!old) return old;
    return {
      ...old,
      nodes: old.nodes.filter((node) => node.id !== id),
      edges: old.edges.filter(
        (edge) =>
          edge.source_knowledge_point_id !== id &&
          edge.target_knowledge_point_id !== id,
      ),
    };
  },
  onSettled: (data, _error, variables) => {
    if (data?.affected_graphs) {
      (data.affected_graphs as string[]).forEach((graphId: string) => {
        frontendEventBus.publish("graph_data_changed", { graphId, changeType: "node_deleted" });
      });
    }
    frontendEventBus.publish("graph_data_changed", { graphId: variables.graphId, changeType: "node_deleted" });
  },
});

export const useBatchDeleteNodesMutation = createOptimisticMutation({
  mutationFn: ({
    nodeIds,
    graphId: _graphId,
  }: {
    nodeIds: string[];
    graphId: string;
  }) => api.nodes.batchDelete(nodeIds),
  queryKey: (vars) => queryKeys.graphData(vars.graphId),
  optimisticUpdater: (
    old: { nodes: Node[]; edges: Edge[] } | undefined,
    { nodeIds }: { nodeIds: string[]; graphId: string },
  ) => {
    if (!old) return old;
    return {
      ...old,
      nodes: old.nodes.filter((node) => !nodeIds.includes(node.id)),
      edges: old.edges.filter(
        (edge) =>
          !nodeIds.includes(edge.source_knowledge_point_id) &&
          !nodeIds.includes(edge.target_knowledge_point_id),
      ),
    };
  },
  onSettled: (_data, _error, variables) => {
    frontendEventBus.publish("graph_data_changed", { graphId: variables.graphId, changeType: "node_deleted" });
  },
});

export const useCreateEdgeMutation = createOptimisticMutation({
  mutationFn: (data: {
    source_knowledge_point_id: string;
    target_knowledge_point_id: string;
    relationship_type: string;
    graphId?: string;
  }) => {
    const { graphId, relationship_type, ...edgeData } = data;
    return api.edges.create({
      ...edgeData,
      graph_id: graphId || "",
      relationship_type,
    });
  },
  queryKey: (vars) => queryKeys.graphData(vars.graphId || ""),
  optimisticUpdater: (
    old: { nodes: Node[]; edges: Edge[] } | undefined,
    newEdgeVariables: {
      source_knowledge_point_id: string;
      target_knowledge_point_id: string;
      relationship_type: string;
      graphId?: string;
    },
  ) => {
    const { graphId, ...edgeData } = newEdgeVariables;

    if (!graphId) return old;
    if (!old) return { nodes: [], edges: [] };

    const tempEdge: Edge = {
      id: `temp-edge-${Date.now()}`,
      graph_id: graphId,
      ...edgeData,
    };

    return {
      ...old,
      edges: [...old.edges, tempEdge],
    };
  },
  onSuccessUpdater: (
    old: { nodes: Node[]; edges: Edge[] } | undefined,
    data: Edge,
    variables: {
      source_knowledge_point_id: string;
      target_knowledge_point_id: string;
      relationship_type: string;
      graphId?: string;
    },
  ) => {
    if (!old) return old;
    return {
      ...old,
      edges: old.edges.map((edge) =>
        edge.id.startsWith("temp-edge-") &&
        edge.source_knowledge_point_id === variables.source_knowledge_point_id &&
        edge.target_knowledge_point_id === variables.target_knowledge_point_id
          ? data
          : edge,
      ),
    };
  },
  onSettled: (_data, _error, variables) => {
    if (variables.graphId) {
      frontendEventBus.publish("graph_data_changed", { graphId: variables.graphId, changeType: "edge_created" });
    } else {
      frontendEventBus.publish("graph_data_changed", { changeType: "edge_created" });
    }
  },
});

// ============================================================
// Non-optimistic mutations — kept as-is
// ============================================================

export const useUpdateNodeMutation = () => {
  return useMutation({
    mutationFn: ({
      id,
      data,
      graphId: _graphId,
    }: {
      id: string;
      data: {
        title?: string;
        content?: string;
        level?: string;
        x_position?: number;
        y_position?: number;
        learning_material?: string;
        properties?: Record<string, unknown>;
      };
      graphId?: string;
    }) => api.nodes.update(id, data),
    onSuccess: (_data, variables) => {
      frontendEventBus.publish("graph_data_changed", { graphId: variables.graphId, changeType: "node_updated" });
    },
  });
};

export const useDeleteEdgeMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string; graphId?: string }) => api.edges.delete(id),
    onMutate: async ({ id, graphId }) => {
      if (!graphId) return {};

      const queryKey = queryKeys.graphData(graphId);
      await queryClient.cancelQueries({ queryKey });
      const previousData = queryClient.getQueryData<{ nodes: Node[]; edges: Edge[] }>(queryKey);

      queryClient.setQueryData<{ nodes: Node[]; edges: Edge[] }>(queryKey, (old) => {
        if (!old) return old;
        return {
          ...old,
          edges: old.edges.filter((edge) => edge.id !== id),
        };
      });

      return { previousData, queryKey };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousData && context?.queryKey) {
        queryClient.setQueryData(context.queryKey, context.previousData);
      }
    },
    onSettled: (_data, _error, variables) => {
      frontendEventBus.publish("graph_data_changed", { graphId: variables.graphId, changeType: "edge_deleted" });
      if (variables.graphId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.graphData(variables.graphId) });
      }
    },
  });
};

export const useTextToGraphMutation = () => {
  return useMutation({
    mutationFn: api.ai.textToGraph,
    onSuccess: (_data, variables) => {
      if (variables.action === "save") {
        frontendEventBus.publish("graph_data_changed", { graphId: variables.graph_id, changeType: "ai_action_executed" });
      }
    },
  });
};

// ============================================================
// Prefetch hooks
// ============================================================

export const usePrefetchGraph = () => {
  const queryClient = useQueryClient();

  return useCallback(
    (graphId: string) => {
      queryClient.prefetchQuery({
        queryKey: queryKeys.graph(graphId),
        queryFn: () => api.graphs.get(graphId),
        ...defaultQueryConfig,
      });
      queryClient.prefetchQuery({
        queryKey: queryKeys.graphData(graphId),
        queryFn: async () => {
          const data = await api.graphs.getNodes(graphId);
          return {
            nodes: (data.nodes || []) as Node[],
            edges: (data.edges || []) as Edge[],
          };
        },
        ...defaultQueryConfig,
      });
    },
    [queryClient],
  );
};

export const usePrefetchStudyCards = () => {
  const queryClient = useQueryClient();

  return useCallback(
    (graphId: string) => {
      queryClient.prefetchQuery({
        queryKey: queryKeys.studyCards({ graph_id: graphId }),
        queryFn: () => api.study.getCards({ graph_id: graphId }),
        ...realtimeQueryConfig,
      });
    },
    [queryClient],
  );
};

// ============================================================
// Composite hook
// ============================================================

export const useGraphMutations = () => {
  const createNodeMutation = useCreateNodeMutation();
  const updateNodeMutation = useUpdateNodeMutation();
  const updateNodeOptimisticMutation = useUpdateNodeOptimisticMutation();
  const deleteNodeMutation = useDeleteNodeMutation();
  const batchDeleteNodesMutation = useBatchDeleteNodesMutation();
  const createEdgeMutation = useCreateEdgeMutation();
  const deleteEdgeMutation = useDeleteEdgeMutation();
  const aiGenerateMutation = useAIGenerateMutation();
  const aiExpandMutation = useAIExpandMutation();
  const aiGenerateCardsMutation = useAIGenerateCardsMutation();
  const createCardsBatchMutation = useCreateCardsBatchMutation();
  const recommendConnectionsMutation = useRecommendConnectionsMutation();
  const deleteGraphMutation = useDeleteGraphMutation();
  const createTaskMutation = useCreateTaskMutation();

  return {
    createNodeMutation,
    updateNodeMutation,
    updateNodeOptimisticMutation,
    deleteNodeMutation,
    batchDeleteNodesMutation,
    createEdgeMutation,
    deleteEdgeMutation,
    aiGenerateMutation,
    aiExpandMutation,
    aiGenerateCardsMutation,
    createCardsBatchMutation,
    recommendConnectionsMutation,
    deleteGraphMutation,
    createTaskMutation,
  };
};
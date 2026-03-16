import { useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../services/api";
import { Node, Edge, NodeLevel } from "../../types";
import {
  queryKeys,
  defaultQueryConfig,
  realtimeQueryConfig,
} from "../queries/config";
import { useCreateCardsBatchMutation } from "./useStudyMutations";
import { useCreateTaskMutation } from "./useTaskMutations";

export const useCreateGraphMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.graphs.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.graphs });
    },
  });
};

export const useCreateGraphFromTemplateMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      template_id: string;
      title: string;
      description?: string;
    }) => api.graphs.createFromTemplate(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.graphs });
    },
  });
};

export const useImportGraphMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.data.import,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.graphs });
    },
  });
};

export const useDeleteGraphMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.graphs.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.graphs });
      queryClient.invalidateQueries({ queryKey: ["graphs", "trash"] });
    },
  });
};

export const useRestoreGraphMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.graphs.restore,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.graphs });
      queryClient.invalidateQueries({ queryKey: ["graphs", "trash"] });
    },
  });
};

export const usePermanentDeleteGraphMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.graphs.permanentDelete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["graphs", "trash"] });
    },
  });
};

const batchOperation = async <T>(
  operation: (ids: string[]) => Promise<T>,
  ids: string[],
  batchSize = 50
): Promise<{ count: number }> => {
  const results: { count: number }[] = [];
  for (let i = 0; i < ids.length; i += batchSize) {
    const batch = ids.slice(i, i + batchSize);
    const result = await operation(batch);
    results.push(result as { count: number });
  }
  return {
    count: results.reduce((sum, r) => sum + r.count, 0),
  };
};

export const useBatchRestoreGraphsMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (ids: string[]) => batchOperation(api.graphs.batchRestore, ids),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.graphs });
      queryClient.invalidateQueries({ queryKey: ["graphs", "trash"] });
    },
  });
};

export const useBatchPermanentDeleteGraphsMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (ids: string[]) =>
      batchOperation(api.graphs.batchPermanentDelete, ids),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["graphs", "trash"] });
    },
  });
};

export const useBatchDeleteGraphsMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (ids: string[]) => batchOperation(api.graphs.batchDelete, ids),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.graphs });
      queryClient.invalidateQueries({ queryKey: ["graphs", "trash"] });
    },
  });
};

export const useUpdateGraphMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      api.graphs.update(id, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.graphs });
      queryClient.invalidateQueries({
        queryKey: queryKeys.graph(variables.id),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.graphNodeStatus(variables.id),
      });
    },
  });
};

export const useToggleFavoriteMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, is_favorite }: { id: string; is_favorite: boolean }) =>
      api.graphs.toggleFavorite(id, is_favorite),
    onMutate: async ({ id, is_favorite }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.graphs });
      const previousGraphs = queryClient.getQueryData(queryKeys.graphs);

      queryClient.setQueryData(queryKeys.graphs, (old: any[] | undefined) => {
        if (!old) return old;
        return old.map((graph) =>
          graph.id === id ? { ...graph, is_favorite } : graph,
        );
      });

      return { previousGraphs };
    },
    onError: (_err, _variables, context) => {
      if (context?.previousGraphs) {
        queryClient.setQueryData(queryKeys.graphs, context.previousGraphs);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.graphs });
    },
  });
};

export const useExportGraphMutation = () => {
  return useMutation({
    mutationFn: ({ id, format }: { id: string; format: "json" | "pdf" }) =>
      api.data.export(id, format),
  });
};

export const useCreateNodeMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (variables: any) => api.nodes.create(variables),
    onMutate: async (newNodeVariables) => {
      const graphId = newNodeVariables.graph_id;

      await queryClient.cancelQueries({
        queryKey: queryKeys.graphData(graphId),
      });

      const previousData = queryClient.getQueryData(
        queryKeys.graphData(graphId),
      );

      queryClient.setQueryData(
        queryKeys.graphData(graphId),
        (old: { nodes: Node[]; edges: Edge[] } | undefined) => {
          if (!old) return { nodes: [], edges: [] };

          const tempNode: Node = {
            id: `temp-${Date.now()}`,
            x_position: newNodeVariables.x_position ?? 0,
            y_position: newNodeVariables.y_position ?? 0,
            ...newNodeVariables,
            level: newNodeVariables.level as NodeLevel | undefined,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };

          return {
            ...old,
            nodes: [...old.nodes, tempNode],
          };
        },
      );

      return { previousData };
    },
    onSuccess: (data, _variables) => {
      if (data && (data as any)._reused) {
        console.info(
          "Node reused existing knowledge point:",
          (data as any).knowledge_point_id,
        );
      }
    },
    onError: (_err, newNode, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(
          queryKeys.graphData(newNode.graph_id),
          context.previousData,
        );
      }
    },
    onSettled: (_data, _error, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.graphData(variables.graph_id),
      });
    },
  });
};

export const useUpdateNodeMutation = () => {
  const queryClient = useQueryClient();

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
      if (variables.graphId) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.graphData(variables.graphId),
        });
      } else {
        queryClient.invalidateQueries({ queryKey: ["graphData"] });
      }
    },
  });
};

export const useUpdateNodeOptimisticMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      data,
      graphId: _graphId,
    }: {
      id: string;
      data: any;
      graphId: string;
    }) => api.nodes.update(id, data),
    onMutate: async ({ id, data, graphId }) => {
      await queryClient.cancelQueries({
        queryKey: queryKeys.graphData(graphId),
      });
      const previousData = queryClient.getQueryData(
        queryKeys.graphData(graphId),
      );

      queryClient.setQueryData(
        queryKeys.graphData(graphId),
        (old: { nodes: Node[]; edges: Edge[] } | undefined) => {
          if (!old) return old;
          return {
            ...old,
            nodes: old.nodes.map((node) =>
              node.id === id ? { ...node, ...data } : node,
            ),
          };
        },
      );

      return { previousData };
    },
    onError: (_err, variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(
          queryKeys.graphData(variables.graphId),
          context.previousData,
        );
      }
    },
    onSettled: (_data, _error, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.graphData(variables.graphId),
      });
    },
  });
};

export const useDeleteNodeMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      graphId: _graphId,
      hardDelete,
    }: {
      id: string;
      graphId: string;
      hardDelete?: boolean;
    }) => api.nodes.delete(id, hardDelete),
    onMutate: async ({ id, graphId }) => {
      await queryClient.cancelQueries({
        queryKey: queryKeys.graphData(graphId),
      });
      const previousData = queryClient.getQueryData(
        queryKeys.graphData(graphId),
      );

      queryClient.setQueryData(
        queryKeys.graphData(graphId),
        (old: { nodes: Node[]; edges: Edge[] } | undefined) => {
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
      );

      return { previousData };
    },
    onSuccess: (data, _variables) => {
      if (data?.affected_graphs) {
        data.affected_graphs.forEach((graphId: string) => {
          queryClient.invalidateQueries({
            queryKey: queryKeys.graphData(graphId),
          });
        });
      }
    },
    onError: (_err, variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(
          queryKeys.graphData(variables.graphId),
          context.previousData,
        );
      }
    },
    onSettled: (_data, _error, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.graphData(variables.graphId),
      });
    },
  });
};

export const useBatchDeleteNodesMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      nodeIds,
      graphId: _graphId,
    }: {
      nodeIds: string[];
      graphId: string;
    }) => api.nodes.batchDelete(nodeIds),
    onMutate: async ({ nodeIds, graphId }) => {
      await queryClient.cancelQueries({
        queryKey: queryKeys.graphData(graphId),
      });
      const previousData = queryClient.getQueryData(
        queryKeys.graphData(graphId),
      );

      queryClient.setQueryData(
        queryKeys.graphData(graphId),
        (old: { nodes: Node[]; edges: Edge[] } | undefined) => {
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
      );

      return { previousData };
    },
    onError: (_err, variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(
          queryKeys.graphData(variables.graphId),
          context.previousData,
        );
      }
    },
    onSettled: (_data, _error, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.graphData(variables.graphId),
      });
    },
  });
};

export const useCreateEdgeMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
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
    onMutate: async (newEdgeVariables) => {
      const { graphId, ...edgeData } = newEdgeVariables;
      if (!graphId) return;

      await queryClient.cancelQueries({
        queryKey: queryKeys.graphData(graphId),
      });
      const previousData = queryClient.getQueryData(
        queryKeys.graphData(graphId),
      );

      queryClient.setQueryData(
        queryKeys.graphData(graphId),
        (old: { nodes: Node[]; edges: Edge[] } | undefined) => {
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
      );

      return { previousData };
    },
    onError: (_err, variables, context) => {
      if (context?.previousData && variables.graphId) {
        queryClient.setQueryData(
          queryKeys.graphData(variables.graphId),
          context.previousData,
        );
      }
    },
    onSettled: (_data, _error, variables) => {
      if (variables.graphId) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.graphData(variables.graphId),
        });
      } else {
        queryClient.invalidateQueries({ queryKey: ["graphData"] });
      }
    },
  });
};

export const useDeleteEdgeMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id }: { id: string }) => api.edges.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["graphData"] });
    },
  });
};

export const useAIGenerateMutation = () => {
  return useMutation({ mutationFn: api.ai.generateContent });
};

export const useAIExpandMutation = () => {
  return useMutation({ mutationFn: api.ai.expand });
};

export const useAIGenerateCardsMutation = () => {
  return useMutation({ mutationFn: api.ai.generateCards });
};

export const useTextToGraphMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.ai.textToGraph,
    onSuccess: (_data, variables) => {
      if (variables.action === "save") {
        queryClient.invalidateQueries({
          queryKey: queryKeys.graphData(variables.graph_id),
        });
      }
    },
  });
};

export const useDocumentToGraphMutation = () => {
  return useMutation({
    mutationFn: api.ai.documentToGraph,
  });
};

export const useImageToGraphMutation = () => {
  return useMutation({
    mutationFn: api.ai.imageToGraph,
  });
};

export const useRecommendConnectionsMutation = () => {
  return useMutation({
    mutationFn: api.ai.recommendConnections,
  });
};

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

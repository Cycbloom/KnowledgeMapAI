import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { api } from '../services/api';
import { useStore } from '../store/useStore';
import { Node, Edge, Task, Template, NodeLevel } from '../types';

const DEFAULT_STALE_TIME = 1000 * 60 * 5;
const LONG_STALE_TIME = 1000 * 60 * 30;
const GC_TIME = 1000 * 60 * 60;

const defaultQueryConfig = {
  staleTime: DEFAULT_STALE_TIME,
  gcTime: GC_TIME,
  retry: 2,
  retryDelay: (attemptIndex: number) => Math.min(1000 * 2 ** attemptIndex, 30000),
};

const staticQueryConfig = {
  staleTime: LONG_STALE_TIME,
  gcTime: GC_TIME,
  retry: 1,
};

const realtimeQueryConfig = {
  staleTime: 0,
  gcTime: GC_TIME,
  retry: 1,
};

// Query Keys
export const queryKeys = {
  graphs: ['graphs'] as const,
  graph: (id: string) => ['graph', id] as const,
  graphData: (id: string) => ['graphData', id] as const,
  graphNodeStatus: (id: string) => ['graphNodeStatus', id] as const,
  studyCards: (params?: { graph_id?: string; node_id?: string; node_ids?: string; due?: boolean }) => 
    ['studyCards', params?.graph_id || 'all', params?.node_id || 'all', params?.node_ids || 'none', params?.due ? 'due' : 'all'] as const,
  user: ['user'] as const,
  dashboardStats: ['dashboardStats'] as const,
  tasks: (status?: string, limit?: number, offset?: number) => ['tasks', status || 'all', limit || 20, offset || 0] as const,
  aiStatus: ['aiStatus'] as const,
  statistics: ['statistics'] as const,
  templates: (category?: string) => ['templates', category || 'all'] as const,
  template: (id: string) => ['template', id] as const,
};

// --- Queries ---

export const useDashboardStats = () => {
  return useQuery({
    queryKey: queryKeys.dashboardStats,
    queryFn: api.dashboard.getStats,
    ...defaultQueryConfig,
  });
};

export const useStatistics = () => {
  return useQuery({
    queryKey: queryKeys.statistics,
    queryFn: api.statistics.getStats,
    ...defaultQueryConfig,
  });
};

export const useUser = (enabled: boolean = true) => {
  return useQuery({
    queryKey: queryKeys.user,
    queryFn: api.auth.getUser,
    enabled,
    ...staticQueryConfig,
    retry: false,
  });
};

export const useGraphs = () => {
  return useQuery({
    queryKey: queryKeys.graphs,
    queryFn: api.graphs.list,
    ...defaultQueryConfig,
  });
};

export const useTrashGraphs = () => {
  return useQuery({
    queryKey: ['graphs', 'trash'],
    queryFn: api.graphs.listTrash,
    ...defaultQueryConfig,
  });
};

export const useGraph = (id: string) => {
  return useQuery({
    queryKey: queryKeys.graph(id),
    queryFn: () => api.graphs.get(id),
    enabled: !!id,
    ...defaultQueryConfig,
  });
};

export const useGraphLearningPath = (id: string) => {
  return useQuery({
    queryKey: ['graphLearningPath', id],
    queryFn: () => api.graphs.getLearningPath(id),
    enabled: !!id,
    ...staticQueryConfig,
  });
};

export const useGraphData = (id: string) => {
  return useQuery({
    queryKey: queryKeys.graphData(id),
    queryFn: async () => {
      const data = await api.graphs.getNodes(id);
      return {
        nodes: (data.nodes || []) as Node[],
        edges: (data.edges || []) as Edge[],
      };
    },
    enabled: !!id,
    ...defaultQueryConfig,
  });
};

export const useGraphNodeStatus = (id: string) => {
  return useQuery({
    queryKey: queryKeys.graphNodeStatus(id),
    queryFn: () => api.graphs.getNodeStatus(id),
    enabled: !!id,
    ...realtimeQueryConfig,
  });
};

export const useStudyCards = (params?: { graph_id?: string; node_id?: string; node_ids?: string; due?: boolean }, enabled: boolean = true) => {
  return useQuery({
    queryKey: queryKeys.studyCards(params),
    queryFn: () => api.study.getCards(params),
    enabled,
    ...realtimeQueryConfig,
  });
};

export const useTasks = (enabled: boolean = true, status?: string, limit: number = 20, offset: number = 0) => {
  return useQuery({
    queryKey: queryKeys.tasks(status, limit, offset),
    queryFn: async () => (await api.tasks.list(status, limit, offset)) as { tasks: Task[], total: number },
    enabled,
    ...realtimeQueryConfig,
  });
};

export const useRetryTaskMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.tasks.retry,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
};

export const useDeleteTaskMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.tasks.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
};

export const useAIStatus = (enabled: boolean = true) => {
  return useQuery({
    queryKey: queryKeys.aiStatus,
    queryFn: api.ai.status,
    enabled,
    retry: false,
    staleTime: 0,
    gcTime: GC_TIME,
    refetchInterval: enabled ? 60_000 : false,
    meta: { silent: true }
  });
};

// --- Mutations ---

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
    mutationFn: (data: { template_id: string; title: string; description?: string }) => 
      api.graphs.createFromTemplate(data),
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
      queryClient.invalidateQueries({ queryKey: ['graphs', 'trash'] });
    },
  });
};

export const useRestoreGraphMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.graphs.restore,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.graphs });
      queryClient.invalidateQueries({ queryKey: ['graphs', 'trash'] });
    },
  });
};

export const usePermanentDeleteGraphMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.graphs.permanentDelete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['graphs', 'trash'] });
    },
  });
};

export const useUpdateGraphMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.graphs.update(id, data),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.graphs });
      queryClient.invalidateQueries({ queryKey: queryKeys.graph(variables.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.graphNodeStatus(variables.id) });
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
        return old.map(graph => 
          graph.id === id ? { ...graph, is_favorite } : graph
        );
      });

      return { previousGraphs };
    },
    onError: (err, variables, context) => {
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
    mutationFn: ({ id, format }: { id: string; format: 'json' | 'pdf' }) => api.data.export(id, format),
  });
};

export const useCreateNodeMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (variables: any) => api.nodes.create(variables),
    onMutate: async (newNodeVariables) => {
      const graphId = newNodeVariables.graph_id;
      
      await queryClient.cancelQueries({ queryKey: queryKeys.graphData(graphId) });

      const previousData = queryClient.getQueryData(queryKeys.graphData(graphId));

      queryClient.setQueryData(queryKeys.graphData(graphId), (old: { nodes: Node[], edges: Edge[] } | undefined) => {
        if (!old) return { nodes: [], edges: [] };
        
        const tempNode: Node = {
          id: `temp-${  Date.now()}`,
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
      });

      return { previousData };
    },
    onSuccess: (data, variables) => {
      if (data && (data as any)._reused) {
        console.log('Node reused existing knowledge point:', (data as any).knowledge_point_id);
      }
    },
    onError: (err, newNode, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(queryKeys.graphData(newNode.graph_id), context.previousData);
      }
    },
    onSettled: (data, error, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.graphData(variables.graph_id) });
    },
  });
};

export const useUpdateNodeMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.nodes.update(id, data),
    onSuccess: () => {
       // Invalidate all graphData queries
       queryClient.invalidateQueries({ queryKey: ['graphData'] });
    }
  });
};

// Improved Update Node Mutation requiring graphId for Optimistic UI
export const useUpdateNodeOptimisticMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data, graphId }: { id: string; data: any; graphId: string }) => 
      api.nodes.update(id, data),
    onMutate: async ({ id, data, graphId }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.graphData(graphId) });
      const previousData = queryClient.getQueryData(queryKeys.graphData(graphId));

      queryClient.setQueryData(queryKeys.graphData(graphId), (old: { nodes: Node[], edges: Edge[] } | undefined) => {
        if (!old) return old;
        return {
          ...old,
          nodes: old.nodes.map(node => node.id === id ? { ...node, ...data } : node),
        };
      });

      return { previousData };
    },
    onError: (err, variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(queryKeys.graphData(variables.graphId), context.previousData);
      }
    },
    onSettled: (data, error, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.graphData(variables.graphId) });
    },
  });
};

export const useDeleteNodeMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, graphId, hardDelete }: { id: string; graphId: string; hardDelete?: boolean }) => 
      api.nodes.delete(id, hardDelete),
    onMutate: async ({ id, graphId }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.graphData(graphId) });
      const previousData = queryClient.getQueryData(queryKeys.graphData(graphId));

      queryClient.setQueryData(queryKeys.graphData(graphId), (old: { nodes: Node[], edges: Edge[] } | undefined) => {
        if (!old) return old;
        return {
          ...old,
          nodes: old.nodes.filter(node => node.id !== id),
          edges: old.edges.filter(edge => edge.source_node_id !== id && edge.target_node_id !== id),
        };
      });

      return { previousData };
    },
    onSuccess: (data, variables) => {
      if (data?.affected_graphs) {
        data.affected_graphs.forEach((graphId: string) => {
          queryClient.invalidateQueries({ queryKey: queryKeys.graphData(graphId) });
        });
      }
    },
    onError: (err, variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(queryKeys.graphData(variables.graphId), context.previousData);
      }
    },
    onSettled: (data, error, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.graphData(variables.graphId) });
    },
  });
};

export const useBatchDeleteNodesMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ nodeIds, graphId }: { nodeIds: string[]; graphId: string }) => api.nodes.batchDelete(nodeIds),
    onMutate: async ({ nodeIds, graphId }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.graphData(graphId) });
      const previousData = queryClient.getQueryData(queryKeys.graphData(graphId));

      queryClient.setQueryData(queryKeys.graphData(graphId), (old: { nodes: Node[], edges: Edge[] } | undefined) => {
        if (!old) return old;
        return {
          ...old,
          nodes: old.nodes.filter(node => !nodeIds.includes(node.id)),
          edges: old.edges.filter(edge => !nodeIds.includes(edge.source_node_id) && !nodeIds.includes(edge.target_node_id)),
        };
      });

      return { previousData };
    },
    onError: (err, variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(queryKeys.graphData(variables.graphId), context.previousData);
      }
    },
    onSettled: (data, error, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.graphData(variables.graphId) });
    },
  });
};

export const useCreateEdgeMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { source_node_id: string; target_node_id: string; relationship_type: string; graphId?: string }) => {
       const { graphId, relationship_type, ...edgeData } = data;
       return api.edges.create({ ...edgeData, graph_id: graphId || '', relationship_type });
    },
    onMutate: async (newEdgeVariables) => {
       const { graphId, ...edgeData } = newEdgeVariables;
       if (!graphId) return;

       await queryClient.cancelQueries({ queryKey: queryKeys.graphData(graphId) });
       const previousData = queryClient.getQueryData(queryKeys.graphData(graphId));

       queryClient.setQueryData(queryKeys.graphData(graphId), (old: { nodes: Node[], edges: Edge[] } | undefined) => {
         if (!old) return { nodes: [], edges: [] };
         
         const tempEdge: Edge = {
             id: `temp-edge-${  Date.now()}`,
             ...edgeData,
          };
         
         return {
            ...old,
            edges: [...old.edges, tempEdge]
         };
       });

       return { previousData };
    },
    onError: (err, variables, context) => {
       if (context?.previousData && variables.graphId) {
          queryClient.setQueryData(queryKeys.graphData(variables.graphId), context.previousData);
       }
    },
    onSettled: (data, error, variables) => {
       if (variables.graphId) {
         queryClient.invalidateQueries({ queryKey: queryKeys.graphData(variables.graphId) });
       } else {
         queryClient.invalidateQueries({ queryKey: ['graphData'] });
       }
    }
  });
};

export const useDeleteEdgeMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id }: { id: string }) => api.edges.delete(id),
    onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: ['graphData'] });
    }
  });
};

export const useUpdateCardProgressMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, quality }: { id: string; quality: number }) => api.study.updateProgress(id, quality),
    onSuccess: () => {
      // Invalidate both cards and node status as progress affects both
      queryClient.invalidateQueries({ queryKey: ['studyCards'] });
      queryClient.invalidateQueries({ queryKey: ['graphNodeStatus'] });
    }
  });
};



export const useUpdateCardMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.study.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['studyCards'] });
    }
  });
};

export const useDeleteCardMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.study.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['studyCards'] });
    }
  });
};

export const useDeleteCardsBatchMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => api.study.deleteBatch(ids),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['studyCards'] });
    }
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
    onSuccess: (data, variables) => {
      if (variables.action === 'save') {
        queryClient.invalidateQueries({ queryKey: queryKeys.graphData(variables.graph_id) });
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

export const useCreateCardsBatchMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.study.createCardsBatch,
    onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['studyCards'] });
    }
  });
};

export const useCreateTaskMutation = () => {
  return useMutation({
    mutationFn: api.tasks.create,
  });
};

export const useLoginMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.auth.login,
    onSuccess: (data) => {
      if (data.user) {
        queryClient.setQueryData(queryKeys.user, { user: data.user });
      }
    }
  });
};

export const useRegisterMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.auth.register,
    onSuccess: (data) => {
      if (data.user) {
        queryClient.setQueryData(queryKeys.user, { user: data.user });
      }
    }
  });
};

export const useLogoutMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.auth.logout,
    onSuccess: () => {
      queryClient.setQueryData(queryKeys.user, null);
      queryClient.clear();
    }
  });
};

export const useUpdateProfileMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.auth.updateProfile,
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.user, data);
      queryClient.invalidateQueries({ queryKey: queryKeys.user });
      
      // Update global store to ensure api.ts uses latest config
      const { setUser, token } = useStore.getState();
      if (data.user) {
        setUser(data.user, token);
      }
    },
  });
};

// Template Queries & Mutations

export const useTemplates = (category?: string) => {
  return useQuery({
    queryKey: queryKeys.templates(category),
    queryFn: () => api.templates.list(category),
    staleTime: 1000 * 60 * 30, // 30 mins
  });
};

export const useTemplate = (id: string) => {
  return useQuery({
    queryKey: queryKeys.template(id),
    queryFn: () => api.templates.get(id),
    enabled: !!id,
    staleTime: 1000 * 60 * 30, // 30 mins
  });
};

export const useCreateTemplateMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.templates.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
    },
  });
};

export const useUpdateTemplateMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.templates.update(id, data),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.template(variables.id) });
    },
  });
};

export const useDeleteTemplateMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.templates.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
    },
  });
};

export const usePrefetchGraph = () => {
  const queryClient = useQueryClient();
  
  return useCallback((graphId: string) => {
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
  }, [queryClient]);
};

export const usePrefetchStudyCards = () => {
  const queryClient = useQueryClient();
  
  return useCallback((graphId: string) => {
    queryClient.prefetchQuery({
      queryKey: queryKeys.studyCards({ graph_id: graphId }),
      queryFn: () => api.study.getCards({ graph_id: graphId }),
      ...realtimeQueryConfig,
    });
  }, [queryClient]);
};

export const usePrefetchTemplates = () => {
  const queryClient = useQueryClient();
  
  return useCallback((category?: string) => {
    queryClient.prefetchQuery({
      queryKey: queryKeys.templates(category),
      queryFn: () => api.templates.list(category),
      staleTime: 1000 * 60 * 30,
    });
  }, [queryClient]);
};

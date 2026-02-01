import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import { Node, Edge, Task } from '../types';

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
  tasks: (status?: string) => ['tasks', status || 'all'] as const,
  aiStatus: ['aiStatus'] as const,
  statistics: ['statistics'] as const,
};

// --- Queries ---

export const useDashboardStats = () => {
  return useQuery({
    queryKey: queryKeys.dashboardStats,
    queryFn: api.dashboard.getStats,
  });
};

export const useStatistics = () => {
  return useQuery({
    queryKey: queryKeys.statistics,
    queryFn: api.statistics.getStats,
  });
};

export const useUser = (enabled: boolean = true) => {
  return useQuery({
    queryKey: queryKeys.user,
    queryFn: api.auth.getUser,
    enabled,
    staleTime: 1000 * 60 * 30, // 30 mins
    retry: false,
  });
};

export const useGraphs = () => {
  return useQuery({
    queryKey: queryKeys.graphs,
    queryFn: api.graphs.list,
  });
};

export const useGraph = (id: string) => {
  return useQuery({
    queryKey: queryKeys.graph(id),
    queryFn: () => api.graphs.get(id),
    enabled: !!id,
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
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
};

export const useGraphNodeStatus = (id: string) => {
  return useQuery({
    queryKey: queryKeys.graphNodeStatus(id),
    queryFn: () => api.graphs.getNodeStatus(id),
    enabled: !!id,
    staleTime: 0, // Always fetch fresh status
  });
};

export const useStudyCards = (params?: { graph_id?: string; node_id?: string; node_ids?: string; due?: boolean }, enabled: boolean = true) => {
  return useQuery({
    queryKey: queryKeys.studyCards(params),
    queryFn: () => api.study.getCards(params),
    enabled,
    staleTime: 0,
  });
};

export const useTasks = (enabled: boolean = true, status?: string) => {
  return useQuery({
    queryKey: queryKeys.tasks(status),
    queryFn: async () => (await api.tasks.list(status)) as Task[],
    enabled,
    refetchInterval: enabled ? 15000 : false, // Poll every 15 seconds instead of 5
    staleTime: 0,
  });
};

export const useRetryTaskMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.tasks.retry,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] }); // Invalidate all task lists
    },
  });
};

export const useDeleteTaskMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.tasks.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] }); // Invalidate all task lists
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

export const useExportGraphMutation = () => {
  return useMutation({
    mutationFn: ({ id, format }: { id: string; format: 'json' | 'pdf' }) => api.data.export(id, format),
  });
};

export const useCreateNodeMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.nodes.create,
    onMutate: async (newNodeVariables) => {
      const graphId = newNodeVariables.graph_id;
      
      // Cancel any outgoing refetches (so they don't overwrite our optimistic update)
      await queryClient.cancelQueries({ queryKey: queryKeys.graphData(graphId) });

      // Snapshot the previous value
      const previousData = queryClient.getQueryData(queryKeys.graphData(graphId));

      // Optimistically update to the new value
      queryClient.setQueryData(queryKeys.graphData(graphId), (old: { nodes: Node[], edges: Edge[] } | undefined) => {
        if (!old) return { nodes: [], edges: [] };
        
        // Create a temporary node
        const tempNode: Node = {
          id: 'temp-' + Date.now(),
          ...newNodeVariables,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        
        return {
          ...old,
          nodes: [...old.nodes, tempNode],
        };
      });

      // Return a context object with the snapshotted value
      return { previousData };
    },
    onError: (err, newNode, context) => {
      // If the mutation fails, use the context returned from onMutate to roll back
      if (context?.previousData) {
        queryClient.setQueryData(queryKeys.graphData(newNode.graph_id), context.previousData);
      }
    },
    onSettled: (data, error, variables) => {
      // Always refetch after error or success:
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
    mutationFn: ({ id, graphId }: { id: string; graphId: string }) => api.nodes.delete(id),
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
       const { graphId, ...edgeData } = data;
       return api.edges.create(edgeData);
    },
    onMutate: async (newEdgeVariables) => {
       const { graphId, ...edgeData } = newEdgeVariables;
       if (!graphId) return;

       await queryClient.cancelQueries({ queryKey: queryKeys.graphData(graphId) });
       const previousData = queryClient.getQueryData(queryKeys.graphData(graphId));

       queryClient.setQueryData(queryKeys.graphData(graphId), (old: { nodes: Node[], edges: Edge[] } | undefined) => {
         if (!old) return { nodes: [], edges: [] };
         
         const tempEdge: Edge = {
             id: 'temp-edge-' + Date.now(),
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

export const useAIGenerateMutation = () => {
  return useMutation({ mutationFn: api.ai.generate });
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
    },
  });
};

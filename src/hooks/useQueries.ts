import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import { Node, Edge } from '../types';

// Query Keys
export const queryKeys = {
  graphs: ['graphs'] as const,
  graph: (id: string) => ['graph', id] as const,
  graphData: (id: string) => ['graphData', id] as const,
  studyCards: (graphId?: string) => ['studyCards', graphId || 'all'] as const,
  user: ['user'] as const,
};

// --- Queries ---

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
  });
};

export const useStudyCards = (graphId?: string) => {
  return useQuery({
    queryKey: queryKeys.studyCards(graphId),
    queryFn: () => api.study.getCards(graphId),
    staleTime: 0, // Always fetch fresh cards when entering study mode to ensure randomization
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
    onMutate: async ({ id, data }) => {
      // We don't have graphId easily available here unless passed, 
      // but we can find it from cache or require it. 
      // For simplicity, let's assume we find it or invalidate all graphData (not ideal).
      // Better: pass graphId in variables.
      // But existing api.nodes.update doesn't require graphId.
      // Let's assume we are viewing the graph currently, so we can find the active query.
      // For now, we'll try to update all graphData queries where this node exists.
      
      // Actually, standard practice is to pass context or invalidate specific keys.
      // Let's iterate over all queries? No, expensive.
      // Let's rely on invalidation for now unless we pass graphId.
      // Optimistic update without graphId is hard.
      // Let's modify the usage to pass graphId if we want optimistic updates, 
      // or just invalidate.
      // But wait, the user wants "Optimistic Updates".
      
      // Let's try to find the query key that contains this node?
      // Or just require graphId in the mutation hook wrapper.
    },
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
    mutationFn: api.edges.create,
    onSuccess: (data, variables) => {
       // We need graphId to invalidate. 
       // The variables should usually have graphId? 
       // api.edges.create takes { source_node_id, target_node_id, relationship_type }
       // It doesn't take graphId explicitly, but we can infer or pass it.
       // Let's just invalidate all graphData for now or require graphId passed in wrapper.
       // Since edges link nodes in a graph, we can find the graphId if we have context.
       // For now, simple invalidation of all 'graphData' is safer but less efficient.
       // OR we accept graphId in the mutation variables just for cache management.
       queryClient.invalidateQueries({ queryKey: ['graphData'] });
    }
  });
};

export const useUpdateCardProgressMutation = () => {
  return useMutation({
    mutationFn: ({ id, quality }: { id: string; quality: number }) => api.study.updateProgress(id, quality),
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

export const useCreateCardsBatchMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.study.createCardsBatch,
    onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['studyCards'] });
    }
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

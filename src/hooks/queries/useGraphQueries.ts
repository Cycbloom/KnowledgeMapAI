import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { api } from "../../services/api/adapter";
import { Node, Edge, NodeStatus } from "../../types";
import { queryKeys, defaultQueryConfig, staticQueryConfig } from "./config";

export const useDashboardStats = () => {
  return useQuery({
    queryKey: queryKeys.dashboardStats,
    queryFn: api.dashboard.getStats,
    ...defaultQueryConfig,
  });
};

export const useTodaySummary = () => {
  return useQuery({
    queryKey: queryKeys.todaySummary,
    queryFn: api.dashboard.getTodaySummary,
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

export const useGraphs = () => {
  return useQuery({
    queryKey: queryKeys.graphs,
    queryFn: api.graphs.list,
    ...defaultQueryConfig,
    placeholderData: keepPreviousData,
  });
};

export const useTrashGraphs = () => {
  return useQuery({
    queryKey: queryKeys.trashGraphs,
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
    queryKey: queryKeys.graphLearningPath(id),
    queryFn: () => api.graphs.getLearningPath(id),
    enabled: !!id,
    ...staticQueryConfig,
  });
};

export const useGraphData = (id: string) => {
  return useQuery({
    queryKey: queryKeys.graphData(id),
    queryFn: async () => {
      const data = await api.graphs.getNodes(id, undefined, true);
      return {
        nodes: (data.nodes || []) as Node[],
        edges: (data.edges || []) as Edge[],
        nodeStatus: (data.nodeStatus || {}) as Record<string, NodeStatus>,
      };
    },
    enabled: !!id,
    ...defaultQueryConfig,
  });
};

export const useGraphDataWithEmbedding = (graphId: string) => {
  return useQuery({
    queryKey: queryKeys.graphDataWithEmbedding(graphId),
    queryFn: async () => {
      const data = await api.graphs.getNodes(graphId, true, true);
      return {
        nodes: (data.nodes || []) as Node[],
        edges: (data.edges || []) as Edge[],
        nodeStatus: (data.nodeStatus || {}) as Record<string, NodeStatus>,
      };
    },
    enabled: !!graphId,
    ...defaultQueryConfig,
    staleTime: 5 * 60 * 1000,
  });
};

export const useGraphNodeStatus = (id: string) => {
  return useQuery({
    queryKey: queryKeys.graphNodeStatus(id),
    queryFn: () => api.graphs.getNodeStatus(id),
    enabled: !!id,
    ...defaultQueryConfig,
    staleTime: 60_000,
  });
};

export const useBatchGraphStatus = (
  graphIds: string[],
  enabled: boolean = true,
) => {
  const { data, isLoading, isPending } = useQuery({
    queryKey: queryKeys.batchGraphNodeStatus(graphIds),
    queryFn: () => api.graphs.batchGetNodeStatus(graphIds),
    enabled: enabled && graphIds.length > 0,
    ...defaultQueryConfig,
    staleTime: 60_000,
  });

  return {
    data: data || {},
    isLoading,
    isPending,
    isAllSuccess: !!data,
  };
};

export const useAIStatus = (enabled: boolean = true) => {
  return useQuery({
    queryKey: queryKeys.aiStatus,
    queryFn: api.ai.status,
    enabled,
    retry: false,
    staleTime: 60 * 1000,
    gcTime: 1000 * 60 * 60,
    refetchInterval: enabled ? 60_000 : false,
    meta: { silent: true },
  });
};

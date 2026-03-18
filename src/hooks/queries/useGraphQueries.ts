import { useQuery, useQueries } from "@tanstack/react-query";
import { api } from "../../services/api/adapter";
import { Node, Edge } from "../../types";
import { queryKeys, defaultQueryConfig, staticQueryConfig, realtimeQueryConfig } from "./config";

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

export const useGraphs = () => {
  return useQuery({
    queryKey: queryKeys.graphs,
    queryFn: api.graphs.list,
    ...defaultQueryConfig,
  });
};

export const useTrashGraphs = () => {
  return useQuery({
    queryKey: ["graphs", "trash"],
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
    queryKey: ["graphLearningPath", id],
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

export const useBatchGraphStatus = (
  graphIds: string[],
  enabled: boolean = true,
) => {
  const queries = useQueries({
    queries: graphIds.map((id) => ({
      queryKey: queryKeys.graphNodeStatus(id),
      queryFn: () => api.graphs.getNodeStatus(id),
      enabled: enabled && !!id,
      ...realtimeQueryConfig,
    })),
  });

  const isLoading = queries.some((q) => q.isLoading);
  const isPending = queries.some((q) => q.isPending);

  const data = graphIds.reduce(
    (acc, id, index) => {
      acc[id] = queries[index].data;
      return acc;
    },
    {} as Record<string, unknown>,
  );

  return {
    data,
    queries,
    isLoading,
    isPending,
    isAllSuccess: queries.every((q) => q.isSuccess),
  };
};

export const useAIStatus = (enabled: boolean = true) => {
  return useQuery({
    queryKey: queryKeys.aiStatus,
    queryFn: api.ai.status,
    enabled,
    retry: false,
    staleTime: 0,
    gcTime: 1000 * 60 * 60,
    refetchInterval: enabled ? 60_000 : false,
    meta: { silent: true },
  });
};

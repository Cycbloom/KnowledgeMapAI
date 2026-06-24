import { useQuery } from "@tanstack/react-query";
import { api } from "../../services/api";
import { queryKeys, realtimeQueryConfig } from "./config";

export const useStudyCards = (
  params?: {
    graph_id?: string;
    knowledge_point_id?: string;
    knowledge_point_ids?: string[];
    due?: boolean;
  },
  enabled: boolean = true,
) => {
  return useQuery({
    queryKey: queryKeys.studyCards(params),
    queryFn: async () => {
      const result = await api.study.getCards(params);
      if (result && typeof result === "object" && "cards" in result) {
        return result.cards;
      }
      return result;
    },
    enabled,
    ...realtimeQueryConfig,
  });
};

export const useStudyStats = (graphId?: string) => {
  return useQuery({
    queryKey: ["studyStats", graphId],
    queryFn: () => api.study.getStats(graphId),
  });
};

export const useSemanticGroups = (graphId?: string, enabled: boolean = true) => {
  return useQuery({
    queryKey: ["semanticGroups", graphId],
    queryFn: () => api.study.getSemanticGroups(graphId),
    enabled,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });
};

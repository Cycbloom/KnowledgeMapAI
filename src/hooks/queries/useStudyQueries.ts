import { useQuery } from "@tanstack/react-query";
import { api } from "../../services/api";
import { queryKeys, realtimeQueryConfig } from "./config";

export const useStudyCards = (
  params?: {
    graph_id?: string;
    node_id?: string;
    node_ids?: string;
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

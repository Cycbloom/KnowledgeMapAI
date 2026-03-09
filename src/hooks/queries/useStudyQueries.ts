import { useQuery } from "@tanstack/react-query";
import { api } from "../../services/api";
import { queryKeys, realtimeQueryConfig } from "./config";

export const useStudyCards = (
  params?: {
    graph_id?: string;
    node_id?: string;
    node_ids?: string;
    due?: boolean;
  },
  enabled: boolean = true,
) => {
  return useQuery({
    queryKey: queryKeys.studyCards(params),
    queryFn: () => api.study.getCards(params),
    enabled,
    ...realtimeQueryConfig,
  });
};

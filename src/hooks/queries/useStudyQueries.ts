import { useQuery } from "@tanstack/react-query";
import { api } from "../../services/api";
import { queryKeys, realtimeQueryConfig } from "./config";
import { getSupabaseClient } from "@/lib/supabase";

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

export interface ReviewForecast {
  /** Cards due tomorrow */
  tomorrow: number;
  /** Cards due in the next 7 days (starting tomorrow) */
  thisWeek: number;
  /** Total cards due in next 7 days (alias of thisWeek) */
  next7Days: number;
  /** Daily counts for the next 7 days (index 0 = tomorrow) */
  daily: number[];
}

const EMPTY_FORECAST: ReviewForecast = {
  tomorrow: 0,
  thisWeek: 0,
  next7Days: 0,
  daily: [0, 0, 0, 0, 0, 0, 0],
};

/**
 * Fetches due card counts for the next 7 days (tomorrow through day 7).
 * Groups study_cards by next_review date.
 */
export const useReviewForecast = (
  params?: {
    graph_id?: string;
    knowledge_point_id?: string;
    knowledge_point_ids?: string[];
  },
  enabled: boolean = true,
) => {
  return useQuery({
    queryKey: queryKeys.reviewForecast(params),
    queryFn: async (): Promise<ReviewForecast> => {
      const supabase = getSupabaseClient();
      if (!supabase) {
        return EMPTY_FORECAST;
      }

      // Calculate date range: tomorrow 00:00:00 to 7 days later 23:59:59
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);

      const sevenDaysEnd = new Date(tomorrow);
      sevenDaysEnd.setDate(sevenDaysEnd.getDate() + 6);
      sevenDaysEnd.setHours(23, 59, 59, 999);

      let query = supabase
        .from("study_cards")
        .select("next_review")
        .gte("next_review", tomorrow.toISOString())
        .lte("next_review", sevenDaysEnd.toISOString())
        .not("next_review", "is", null);

      if (params?.graph_id) {
        query = query.eq("graph_id", params.graph_id);
      }
      if (params?.knowledge_point_id) {
        query = query.eq("knowledge_point_id", params.knowledge_point_id);
      }
      if (params?.knowledge_point_ids && params.knowledge_point_ids.length > 0) {
        query = query.in(
          "knowledge_point_id",
          params.knowledge_point_ids,
        );
      }

      const { data, error } = await query;
      if (error) {
        console.error("Failed to fetch review forecast:", error);
        return EMPTY_FORECAST;
      }

      const daily = [0, 0, 0, 0, 0, 0, 0];
      let next7Days = 0;

      for (const row of data ?? []) {
        const nextReview = row.next_review;
        if (!nextReview) continue;
        next7Days++;
        const dueDate = new Date(nextReview);
        const dayDiff = Math.floor(
          (dueDate.getTime() - tomorrow.getTime()) / (24 * 60 * 60 * 1000),
        );
        if (dayDiff >= 0 && dayDiff < 7) {
          daily[dayDiff]++;
        }
      }

      const tomorrowCount = daily[0] ?? 0;
      const thisWeek = daily.reduce((acc, n) => acc + n, 0);

      return {
        tomorrow: tomorrowCount,
        thisWeek,
        next7Days,
        daily,
      };
    },
    enabled,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });
};

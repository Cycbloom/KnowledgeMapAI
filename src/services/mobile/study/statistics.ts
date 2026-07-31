import { getMobileSupabaseClient } from "@/utils/supabase";
import type { IStatisticsApi } from "../../api/contracts/IStatisticsApi";
import { AppError, SharedErrorCodes } from "@/utils/errors";

interface StudyCardStateRow {
  fsrs_state: string | null;
  next_review: string | null;
  fsrs_stability: number | null;
  last_reviewed: string | null;
  created_at: string | null;
}

export const mobileStatisticsApi: IStatisticsApi = {
  getStats: async () => {
    const client = getMobileSupabaseClient();
    if (!client) {
      throw new AppError("Supabase client not initialized", SharedErrorCodes.SYSTEM_CONFIGURATION_ERROR, 500);
    }

    const {
      data: { user },
    } = await client.auth.getUser();

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    if (!user) {
      const emptyDistribution = [
        { name: "new", value: 0, color: "#94a3b8" },
        { name: "learning", value: 0, color: "#fbbf24" },
        { name: "review", value: 0, color: "#4ade80" },
        { name: "relearning", value: 0, color: "#f87171" },
      ];
      const forecast = [];
      const growth = [];

      for (let i = 0; i < 7; i++) {
        const d = new Date(today.getTime() + i * 24 * 60 * 60 * 1000);
        forecast.push({ date: d.toISOString().split("T")[0], count: 0 });
      }

      for (let i = 29; i >= 0; i--) {
        const d = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
        growth.push({ date: d.toISOString().split("T")[0], count: 0 });
      }

      return {
        metrics: {
          totalCards: 0,
          dueToday: 0,
          learning: 0,
          avgStability: 7,
        },
        heatmap: [],
        distribution: emptyDistribution,
        forecast,
        growth,
      };
    }

    const { data: cards } = await client
      .from("study_cards")
      .select(
        "fsrs_state, next_review, fsrs_stability, last_reviewed, created_at",
      )
      .eq("user_id", user.id);

    const stateCounts: Record<string, number> = {
      "New": 0,
      "Learning": 0,
      "Review": 0,
      "Relearning": 0,
    };

    let dueTodayCount = 0;
    let totalStability = 0;
    let stabilityCount = 0;
    const heatmapMap = new Map<string, number>();
    const forecastMap = new Map<string, number>();
    const growthMap = new Map<string, number>();

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    for (let i = 0; i < 7; i++) {
      const d = new Date(today.getTime() + i * 24 * 60 * 60 * 1000);
      forecastMap.set(d.toISOString().split("T")[0], 0);
    }

    for (let i = 29; i >= 0; i--) {
      const d = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
      growthMap.set(d.toISOString().split("T")[0], 0);
    }

    ((cards || []) as StudyCardStateRow[]).forEach((card) => {
      const state = card.fsrs_state || "New";
      const stability = card.fsrs_stability || 0;
      const nextReview = card.next_review ? new Date(card.next_review) : null;
      const lastReviewed = card.last_reviewed
        ? new Date(card.last_reviewed)
        : null;
      const createdAt = card.created_at ? new Date(card.created_at) : null;

      if (stateCounts[state] !== undefined) {
        stateCounts[state]++;
      }

      if (nextReview && nextReview >= today && nextReview < tomorrow) {
        dueTodayCount++;
      }

      if (stability > 0) {
        totalStability += stability;
        stabilityCount++;
      }

      if (lastReviewed) {
        const dateStr = lastReviewed.toISOString().split("T")[0];
        heatmapMap.set(dateStr, (heatmapMap.get(dateStr) || 0) + 1);

        if (forecastMap.has(dateStr)) {
          forecastMap.set(dateStr, (forecastMap.get(dateStr) || 0) + 1);
        }
      }

      if (createdAt) {
        const dateStr = createdAt.toISOString().split("T")[0];
        if (growthMap.has(dateStr)) {
          growthMap.set(dateStr, (growthMap.get(dateStr) || 0) + 1);
        }
      }
    });

    const heatmap = Array.from(heatmapMap.entries()).map(([date, count]) => ({
      date,
      count,
    }));
    const forecast = Array.from(forecastMap.entries()).map(([date, count]) => ({
      date,
      count,
    }));
    const growth = Array.from(growthMap.entries()).map(([date, count]) => ({
      date,
      count,
    }));

    return {
      metrics: {
        totalCards: (cards || []).length,
        dueToday: dueTodayCount,
        learning:
          stateCounts["Learning"] +
          stateCounts["Review"] +
          stateCounts["Relearning"],
        avgStability: stabilityCount > 0 ? totalStability / stabilityCount : 7,
      },
      heatmap,
      distribution: [
        { name: "new", value: stateCounts["New"], color: "#94a3b8" },
        {
          name: "learning",
          value: stateCounts["Learning"],
          color: "#fbbf24",
        },
        { name: "review", value: stateCounts["Review"], color: "#4ade80" },
        {
          name: "relearning",
          value: stateCounts["Relearning"],
          color: "#f87171",
        },
      ],
      forecast,
      growth,
    };
  },
};

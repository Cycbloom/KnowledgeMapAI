import { getMobileSupabaseClient } from "./client";
import type { StudyCard } from "@shared/types/common";

export const mobileStudyApi = {
  getCards: async (params?: {
    graph_id?: string;
    knowledge_point_id?: string;
    knowledge_point_ids?: string[];
    node_id?: string;
    node_ids?: string;
    source_graph_id?: string;
    due?: boolean;
  }) => {
    const client = getMobileSupabaseClient();
    if (!client) {
      throw new Error("Supabase client not initialized");
    }

    const {
      data: { user },
    } = await client.auth.getUser();

    if (!user) {
      return { cards: [] };
    }

    let query = client.from("study_cards").select("*").eq("user_id", user.id);

    if (params?.graph_id) {
      query = query.eq("graph_id", params.graph_id);
    } else if (params?.knowledge_point_id || params?.node_id) {
      const kpId = params.knowledge_point_id || params.node_id;
      if (kpId) {
        query = query.eq("knowledge_point_id", kpId);
      }
    } else if (
      (params?.knowledge_point_ids && params.knowledge_point_ids.length > 0) ||
      params?.node_ids
    ) {
      const kpIds = params.knowledge_point_ids || (params.node_ids ? params.node_ids.split(",") : []);
      if (kpIds.length > 0) {
        query = query.in("knowledge_point_id", kpIds);
      }
    }

    if (params?.due) {
      query = query.lte("next_review", new Date().toISOString());
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(error.message);
    }

    return { cards: (data as StudyCard[]) || [] };
  },

  getCardsByKnowledgePoint: async (knowledgePointId: string, _params?: any) => {
    const client = getMobileSupabaseClient();
    if (!client) {
      throw new Error("Supabase client not initialized");
    }

    const {
      data: { user },
    } = await client.auth.getUser();

    if (!user) {
      return { cards: [] };
    }

    const { data, error } = await client
      .from("study_cards")
      .select("*")
      .eq("user_id", user.id)
      .eq("knowledge_point_id", knowledgePointId);

    if (error) {
      throw new Error(error.message);
    }

    return { cards: (data as StudyCard[]) || [] };
  },

  createCardsBatch: async (cards: unknown[]) => {
    if (cards.length === 0) {
      return { success: true, cards: [] };
    }

    const client = getMobileSupabaseClient();
    if (!client) {
      throw new Error("Supabase client not initialized");
    }

    const {
      data: { user },
    } = await client.auth.getUser();

    if (!user) {
      throw new Error("User not authenticated");
    }

    const cardsToInsert = (
      cards as Array<{
        knowledgePointId: string;
        sourceGraphId: string;
        question: string;
        answer: string;
        explanation?: string;
        cardType?: StudyCard["card_type"];
        options?: string[];
      }>
    ).map((card) => ({
      user_id: user.id,
      knowledge_point_id: card.knowledgePointId,
      graph_id: card.sourceGraphId,
      source_graph_id: card.sourceGraphId,
      question: card.question,
      answer: card.answer,
      explanation: card.explanation || null,
      card_type: card.cardType || "qa",
      options: card.options || null,
      next_review: new Date().toISOString(),
      difficulty: 1,
      fsrs_state: 0,
      fsrs_stability: 0,
      fsrs_difficulty: 0,
      fsrs_elapsed_days: 0,
      fsrs_scheduled_days: 0,
      fsrs_retrievability: 0,
    }));

    const { data, error } = await (client.from("study_cards") as any)
      .insert(cardsToInsert)
      .select();

    if (error) {
      throw new Error(error.message);
    }

    return { success: true, cards: (data as StudyCard[]) || [] };
  },

  update: async (id: string, data: unknown) => {
    const client = getMobileSupabaseClient();
    if (!client) {
      throw new Error("Supabase client not initialized");
    }

    const { data: result, error } = await (client.from("study_cards") as any)
      .update(data as any)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return { success: true, card: result as StudyCard };
  },

  delete: async (id: string) => {
    const client = getMobileSupabaseClient();
    if (!client) {
      throw new Error("Supabase client not initialized");
    }

    const { error } = await client.from("study_cards").delete().eq("id", id);

    if (error) {
      throw new Error(error.message);
    }

    return { success: true };
  },

  deleteBatch: async (ids: string[]) => {
    if (ids.length === 0) {
      return { success: true };
    }

    const client = getMobileSupabaseClient();
    if (!client) {
      throw new Error("Supabase client not initialized");
    }

    const { error } = await client.from("study_cards").delete().in("id", ids);

    if (error) {
      throw new Error(error.message);
    }

    return { success: true };
  },

  updateProgress: async (id: string, quality: number) => {
    const client = getMobileSupabaseClient();
    if (!client) {
      throw new Error("Supabase client not initialized");
    }

    const { data: card, error: fetchError } = await (
      client.from("study_cards") as any
    )
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError || !card) {
      throw new Error(fetchError?.message || "Card not found");
    }

    const now = new Date();
    const reviewCount = ((card as any).review_count || 0) + 1;

    let nextReviewDays = 1;
    if (quality >= 4) {
      nextReviewDays = Math.min(2 ^ reviewCount, 365);
    } else if (quality >= 3) {
      nextReviewDays = Math.min(reviewCount * 2, 30);
    } else if (quality >= 2) {
      nextReviewDays = 1;
    } else {
      nextReviewDays = 0;
    }

    const nextReview = new Date(
      now.getTime() + nextReviewDays * 24 * 60 * 60 * 1000,
    );

    const { data: updatedCard, error: updateError } = await (
      client.from("study_cards") as any
    )
      .update({
        last_reviewed: now.toISOString(),
        next_review: nextReview.toISOString(),
        review_count: reviewCount,
      })
      .eq("id", id)
      .select()
      .single();

    if (updateError) {
      throw new Error(updateError.message);
    }

    return { success: true, card: updatedCard as StudyCard };
  },

  getCardGroups: async (knowledgePointId: string) => {
    const client = getMobileSupabaseClient();
    if (!client) {
      throw new Error("Supabase client not initialized");
    }

    const {
      data: { user },
    } = await client.auth.getUser();

    if (!user) {
      return [];
    }

    const { data, error } = await client
      .from("study_cards")
      .select("id, card_type, question, source_graph_id")
      .eq("user_id", user.id)
      .eq("knowledge_point_id", knowledgePointId);

    if (error) {
      throw new Error(error.message);
    }

    const groups: Array<{
      source_graph_id: string;
      graph_title: string;
      card_count: number;
    }> = [];
    const graphMap = new Map<string, number>();

    (data || []).forEach((card: any) => {
      const graphId = card.source_graph_id || "";
      if (!graphMap.has(graphId)) {
        graphMap.set(graphId, 0);
      }
      graphMap.set(graphId, (graphMap.get(graphId) || 0) + 1);
    });

    graphMap.forEach((cardCount, graphId) => {
      groups.push({
        source_graph_id: graphId,
        graph_title: "",
        card_count: cardCount,
      });
    });

    return groups;
  },
};

export const mobileDashboardApi = {
  getStats: async () => {
    const client = getMobileSupabaseClient();
    if (!client) {
      throw new Error("Supabase client not initialized");
    }

    const {
      data: { user },
    } = await client.auth.getUser();

    if (!user) {
      return {
        total_graphs: 0,
        total_nodes: 0,
        total_edges: 0,
        total_study_cards: 0,
        study_streak: 0,
        today_reviews: 0,
      };
    }

    const [
      { count: graphCount },
      { count: nodeCount },
      { count: edgeCount },
      { count: cardCount },
      { data: cards },
    ] = await Promise.all([
      client
        .from("knowledge_graphs")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .is("deleted_at", null),
      client
        .from("graph_nodes")
        .select("*", { count: "exact", head: true })
        .is("deleted_at", null),
      client
        .from("edges")
        .select("*", { count: "exact", head: true })
        .is("deleted_at", null),
      client
        .from("study_cards")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id),
      client
        .from("study_cards")
        .select("next_review, last_reviewed")
        .eq("user_id", user.id),
    ]);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    let todayReviews = 0;
    (cards || []).forEach((card: any) => {
      if (card.last_reviewed) {
        const lastReviewed = new Date(card.last_reviewed);
        if (lastReviewed >= today && lastReviewed < tomorrow) {
          todayReviews++;
        }
      }
    });

    return {
      total_graphs: graphCount || 0,
      total_nodes: nodeCount || 0,
      total_edges: edgeCount || 0,
      total_study_cards: cardCount || 0,
      study_streak: 0,
      today_reviews: todayReviews,
    };
  },
};

export const mobileStatisticsApi = {
  getStats: async () => {
    const client = getMobileSupabaseClient();
    if (!client) {
      throw new Error("Supabase client not initialized");
    }

    const {
      data: { user },
    } = await client.auth.getUser();

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    if (!user) {
      const emptyDistribution = [
        { name: "新卡片", value: 0, color: "#94a3b8" },
        { name: "学习中", value: 0, color: "#fbbf24" },
        { name: "复习中", value: 0, color: "#4ade80" },
        { name: "重新学习", value: 0, color: "#f87171" },
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

    const State = {
      New: 0,
      Learning: 1,
      Review: 2,
      Relearning: 3,
    };

    const stateCounts: Record<number, number> = {
      [State.New]: 0,
      [State.Learning]: 0,
      [State.Review]: 0,
      [State.Relearning]: 0,
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

    (cards || []).forEach((card: any) => {
      const state = card.fsrs_state || State.New;
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
          stateCounts[State.Learning] +
          stateCounts[State.Review] +
          stateCounts[State.Relearning],
        avgStability: stabilityCount > 0 ? totalStability / stabilityCount : 7,
      },
      heatmap,
      distribution: [
        { name: "新卡片", value: stateCounts[State.New], color: "#94a3b8" },
        {
          name: "学习中",
          value: stateCounts[State.Learning],
          color: "#fbbf24",
        },
        { name: "复习中", value: stateCounts[State.Review], color: "#4ade80" },
        {
          name: "重新学习",
          value: stateCounts[State.Relearning],
          color: "#f87171",
        },
      ],
      forecast,
      growth,
    };
  },
};

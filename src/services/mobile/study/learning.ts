import { getMobileSupabaseClient } from "@/lib/supabase";
import type { StudyCard } from "@shared/types/common";
import type { GetCardsParams, CardGroup, StudyStats } from "@shared/types/api";

interface StudyCardInsert {
  user_id: string;
  knowledge_point_id: string;
  graph_id: string;
  source_graph_id: string;
  question: string;
  answer: string;
  explanation: string | null;
  card_type: StudyCard["card_type"];
  options: string[] | null;
  next_review: string;
  difficulty: number;
  fsrs_state: string;
  fsrs_stability: number;
  fsrs_difficulty: number;
  fsrs_elapsed_days: number;
  fsrs_scheduled_days: number;
  fsrs_retrievability: number;
}

interface CardGroupRow {
  source_graph_id: string | null;
  card_type: string;
}

export const mobileStudyApi = {
  getCards: async (params?: GetCardsParams) => {
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
    } else if (params?.knowledge_point_id) {
      query = query.eq("knowledge_point_id", params.knowledge_point_id);
    } else if (params?.knowledge_point_ids && params.knowledge_point_ids.length > 0) {
      query = query.in("knowledge_point_id", params.knowledge_point_ids);
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

  getCardsByKnowledgePoint: async (knowledgePointId: string, _params?: Record<string, unknown>) => {
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
    ).map((card): StudyCardInsert => ({
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
      fsrs_state: "New",
      fsrs_stability: 0,
      fsrs_difficulty: 0,
      fsrs_elapsed_days: 0,
      fsrs_scheduled_days: 0,
      fsrs_retrievability: 0,
    }));

    const { data, error } = await client
      .from("study_cards")
      .insert(cardsToInsert)
      .select();

    if (error) {
      throw new Error(error.message);
    }

    return { success: true, cards: (data as StudyCard[]) || [] };
  },

  update: async (id: string, data: Partial<StudyCard>) => {
    const client = getMobileSupabaseClient();
    if (!client) {
      throw new Error("Supabase client not initialized");
    }

    const { data: result, error } = await client
      .from("study_cards")
      .update(data)
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

    const { data: card, error: fetchError } = await client
      .from("study_cards")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError || !card) {
      throw new Error(fetchError?.message || "Card not found");
    }

    const cardRow = card as StudyCard;
    const now = new Date();
    const reviewCount = (cardRow.review_count || 0) + 1;

    let nextReviewDays = 1;
    if (quality >= 4) {
      nextReviewDays = Math.min(2 ** reviewCount, 365);
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

    const { data: updatedCard, error: updateError } = await client
      .from("study_cards")
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

    const groups: CardGroup[] = [];
    const graphMap = new Map<string, number>();

    ((data || []) as CardGroupRow[]).forEach((card) => {
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

  getStats: async (graphId?: string) => {
    const client = getMobileSupabaseClient();
    if (!client) {
      throw new Error("Supabase client not initialized");
    }

    const {
      data: { user },
    } = await client.auth.getUser();

    if (!user) {
      return {
        totalCards: 0,
        dueCards: 0,
        newCards: 0,
        learningCards: 0,
        reviewCards: 0,
        relearningCards: 0,
        averageRetrievability: 0,
        averageStability: 0,
        averageDifficulty: 0,
      } satisfies StudyStats;
    }

    let query = client
      .from("study_cards")
      .select("fsrs_state, fsrs_retrievability, fsrs_stability, fsrs_difficulty, next_review")
      .eq("user_id", user.id);

    if (graphId) {
      query = query.eq("graph_id", graphId);
    }

    const { data: cards, error } = await query;

    if (error) {
      throw new Error(error.message);
    }

    const allCards = (cards ?? []) as Array<{
      next_review: string | null;
      fsrs_state: string | null;
      fsrs_retrievability: number | null;
      fsrs_stability: number | null;
      fsrs_difficulty: number | null;
    }>;
    const now = new Date();

    let dueCards = 0;
    let newCards = 0;
    let learningCards = 0;
    let reviewCards = 0;
    let relearningCards = 0;
    let totalRetrievability = 0;
    let totalStability = 0;
    let totalDifficulty = 0;

    for (const card of allCards) {
      if (card.next_review && new Date(card.next_review) <= now) {
        dueCards++;
      }

      switch (card.fsrs_state) {
        case "New":
          newCards++;
          break;
        case "Learning":
          learningCards++;
          break;
        case "Review":
          reviewCards++;
          break;
        case "Relearning":
          relearningCards++;
          break;
      }

      totalRetrievability += card.fsrs_retrievability ?? 0;
      totalStability += card.fsrs_stability ?? 0;
      totalDifficulty += card.fsrs_difficulty ?? 0;
    }

    const count = allCards.length;
    return {
      totalCards: count,
      dueCards,
      newCards,
      learningCards,
      reviewCards,
      relearningCards,
      averageRetrievability: count > 0 ? Math.round((totalRetrievability / count) * 1000) / 1000 : 0,
      averageStability: count > 0 ? Math.round((totalStability / count) * 100) / 100 : 0,
      averageDifficulty: count > 0 ? Math.round((totalDifficulty / count) * 100) / 100 : 0,
    };
  },
};

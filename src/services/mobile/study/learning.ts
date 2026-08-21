/** @mastery display */
import { getMobileSupabaseClient } from "@/utils/supabase";
import { Rating, State, type Card } from "ts-fsrs";
import i18next from "i18next";
import type { StudyCard } from "@shared/types/common";
import type { GetCardsParams, CardGroup, StudyStats } from "@shared/types/api";
import type { IStudyApi } from "../../api/contracts/IStudyApi";
import { fsrsEngine } from "./fsrsEngine";
import { logger } from "@/utils/logger";
import { AppError, SharedErrorCodes } from "@/utils/errors";
import { stabilityToMasteryBaseline, computeCardDisplayMastery } from "@shared/utils/fsrs/masteryContract";

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

export const mobileStudyApi: IStudyApi = {
  getCards: async (params?: GetCardsParams) => {
    const client = getMobileSupabaseClient();
    if (!client) {
      throw new AppError("Supabase client not initialized", SharedErrorCodes.SYSTEM_CONFIGURATION_ERROR, 500);
    }

    const {
      data: { user },
    } = await client.auth.getUser();

    if (!user) {
      return [];
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
      throw new AppError(error.message, SharedErrorCodes.DATABASE_QUERY_ERROR, 500);
    }

    return (data as StudyCard[]) || [];
  },

  getCardsPaged: async (params?: GetCardsParams) => {
    const client = getMobileSupabaseClient();
    if (!client) {
      throw new AppError("Supabase client not initialized", SharedErrorCodes.SYSTEM_CONFIGURATION_ERROR, 500);
    }

    const {
      data: { user },
    } = await client.auth.getUser();

    const page = params?.page ?? 1;
    const pageSize = params?.pageSize ?? 20;

    if (!user) {
      return { items: [], total: 0, page, pageSize };
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
    if (params?.card_type) {
      query = query.eq("card_type", params.card_type);
    }
    if (params?.fsrs_state) {
      query = query.eq("fsrs_state", params.fsrs_state);
    }
    if (params?.review_count_min !== undefined) {
      query = query.gte("review_count", params.review_count_min);
    }
    if (params?.review_count_max !== undefined) {
      query = query.lte("review_count", params.review_count_max);
    }
    if (params?.next_review_start) {
      query = query.gte("next_review", params.next_review_start);
    }
    if (params?.next_review_end) {
      query = query.lte("next_review", params.next_review_end);
    }
    if (params?.search && params.search.trim() !== "") {
      const term = `%${params.search.trim()}%`;
      query = query.or(`question.ilike.${term},answer.ilike.${term}`);
    }

    const countQuery = client
      .from("study_cards")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id);

    if (params?.graph_id) {
      countQuery.eq("graph_id", params.graph_id);
    } else if (params?.knowledge_point_id) {
      countQuery.eq("knowledge_point_id", params.knowledge_point_id);
    } else if (params?.knowledge_point_ids && params.knowledge_point_ids.length > 0) {
      countQuery.in("knowledge_point_id", params.knowledge_point_ids);
    }
    if (params?.due) {
      countQuery.lte("next_review", new Date().toISOString());
    }
    if (params?.card_type) {
      countQuery.eq("card_type", params.card_type);
    }
    if (params?.fsrs_state) {
      countQuery.eq("fsrs_state", params.fsrs_state);
    }
    if (params?.review_count_min !== undefined) {
      countQuery.gte("review_count", params.review_count_min);
    }
    if (params?.review_count_max !== undefined) {
      countQuery.lte("review_count", params.review_count_max);
    }
    if (params?.next_review_start) {
      countQuery.gte("next_review", params.next_review_start);
    }
    if (params?.next_review_end) {
      countQuery.lte("next_review", params.next_review_end);
    }
    if (params?.search && params.search.trim() !== "") {
      const term = `%${params.search.trim()}%`;
      countQuery.or(`question.ilike.${term},answer.ilike.${term}`);
    }

    const { count: total, error: countError } = await countQuery;
    if (countError) {
      throw new AppError(countError.message, SharedErrorCodes.DATABASE_QUERY_ERROR, 500);
    }

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    const { data, error } = await query.range(from, to);

    if (error) {
      throw new AppError(error.message, SharedErrorCodes.DATABASE_QUERY_ERROR, 500);
    }

    return {
      items: (data as StudyCard[]) || [],
      total: total ?? 0,
      page,
      pageSize,
    };
  },

  getCardsByKnowledgePoint: async (knowledgePointId: string, _params?: Record<string, unknown>) => {
    const client = getMobileSupabaseClient();
    if (!client) {
      throw new AppError("Supabase client not initialized", SharedErrorCodes.SYSTEM_CONFIGURATION_ERROR, 500);
    }

    const {
      data: { user },
    } = await client.auth.getUser();

    if (!user) {
      return [];
    }

    const { data, error } = await client
      .from("study_cards")
      .select("*")
      .eq("user_id", user.id)
      .eq("knowledge_point_id", knowledgePointId);

    if (error) {
      throw new AppError(error.message, SharedErrorCodes.DATABASE_QUERY_ERROR, 500);
    }

    return (data as StudyCard[]) || [];
  },

  createCardsBatch: async (cards: unknown[]) => {
    if (cards.length === 0) {
      return [];
    }

    const client = getMobileSupabaseClient();
    if (!client) {
      throw new AppError("Supabase client not initialized", SharedErrorCodes.SYSTEM_CONFIGURATION_ERROR, 500);
    }

    const {
      data: { user },
    } = await client.auth.getUser();

    if (!user) {
      throw new AppError("User not authenticated", SharedErrorCodes.AUTH_UNAUTHORIZED, 401);
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
      throw new AppError(error.message, SharedErrorCodes.DATABASE_QUERY_ERROR, 500);
    }

    return (data as StudyCard[]) || [];
  },

  update: async (id: string, data: Partial<StudyCard>) => {
    const client = getMobileSupabaseClient();
    if (!client) {
      throw new AppError("Supabase client not initialized", SharedErrorCodes.SYSTEM_CONFIGURATION_ERROR, 500);
    }

    const { data: result, error } = await client
      .from("study_cards")
      .update(data)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      throw new AppError(error.message, SharedErrorCodes.DATABASE_QUERY_ERROR, 500);
    }

    return result as StudyCard;
  },

  delete: async (id: string) => {
    const client = getMobileSupabaseClient();
    if (!client) {
      throw new AppError("Supabase client not initialized", SharedErrorCodes.SYSTEM_CONFIGURATION_ERROR, 500);
    }

    const { error } = await client.from("study_cards").delete().eq("id", id);

    if (error) {
      throw new AppError(error.message, SharedErrorCodes.DATABASE_QUERY_ERROR, 500);
    }

    return { success: true };
  },

  deleteBatch: async (ids: string[]) => {
    if (ids.length === 0) {
      return { success: true };
    }

    const client = getMobileSupabaseClient();
    if (!client) {
      throw new AppError("Supabase client not initialized", SharedErrorCodes.SYSTEM_CONFIGURATION_ERROR, 500);
    }

    const { error } = await client.from("study_cards").delete().in("id", ids);

    if (error) {
      throw new AppError(error.message, SharedErrorCodes.DATABASE_QUERY_ERROR, 500);
    }

    return { success: true };
  },

  updateProgress: async (id: string, quality: number) => {
    const client = getMobileSupabaseClient();
    if (!client) {
      throw new AppError("Supabase client not initialized", SharedErrorCodes.SYSTEM_CONFIGURATION_ERROR, 500);
    }

    const {
      data: { user },
    } = await client.auth.getUser();
    if (!user) {
      throw new AppError("User not authenticated", SharedErrorCodes.AUTH_UNAUTHORIZED, 401);
    }

    const { data: card, error: fetchError } = await client
      .from("study_cards")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError || !card) {
      throw new AppError(fetchError?.message || "Card not found", SharedErrorCodes.RESOURCE_CARD_NOT_FOUND, 404);
    }

    const cardRow = card as StudyCard;
    const fsrsCard = fsrsEngine.dbCardToFSRS(cardRow);
    const now = new Date();
    const rating = fsrsEngine.mapQualityToRating(quality);

    const f = await fsrsEngine.getFSRSForUser(user.id, client);
    const schedulingCards = f.repeat(fsrsCard, now) as unknown as Record<
      Rating,
      { card: Card }
    >;
    const scheduledCard = schedulingCards[rating].card;

    const nextStability = Math.max(0, Number(scheduledCard.stability) || 0);
    const nextRetrievability = nextStability > 0
      ? stabilityToMasteryBaseline(nextStability)
      : 0;

    logger.debug("[Mobile.learning.updateProgress] Write fsrs_retrievability baseline", {
      cardId: id,
      S: nextStability,
      baseline: nextRetrievability,
    });

    const { data: updatedCard, error: updateError } = await client
      .from("study_cards")
      .update({
        last_reviewed: now.toISOString(),
        next_review: scheduledCard.due.toISOString(),
        review_count: scheduledCard.reps,
        fsrs_state: State[scheduledCard.state] as keyof typeof State,
        fsrs_stability: scheduledCard.stability,
        fsrs_difficulty: scheduledCard.difficulty,
        fsrs_elapsed_days: scheduledCard.elapsed_days,
        fsrs_scheduled_days: scheduledCard.scheduled_days,
        fsrs_retrievability: nextRetrievability,
        fsrs_last_review: now.toISOString(),
        last_rating: rating,
      })
      .eq("id", id)
      .select()
      .single();

    if (updateError) {
      throw new AppError(updateError.message, SharedErrorCodes.DATABASE_QUERY_ERROR, 500);
    }

    // mastery_level 重算策略（方案 C 降级）：
    // 移动端无 update_knowledge_point_mastery RPC，mastery 重算由桌面端下次登录时
    // 通过 masteryCalculationService 批量触发，此处仅 warn 不影响主流程。
    if (cardRow.knowledge_point_id) {
      logger.warn(
        "[Mobile] mastery recalc RPC not available, will be synced on desktop login",
      );
    }

    return updatedCard as StudyCard;
  },

  getCardGroups: async (knowledgePointId: string) => {
    const client = getMobileSupabaseClient();
    if (!client) {
      throw new AppError("Supabase client not initialized", SharedErrorCodes.SYSTEM_CONFIGURATION_ERROR, 500);
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
      throw new AppError(error.message, SharedErrorCodes.DATABASE_QUERY_ERROR, 500);
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
      throw new AppError("Supabase client not initialized", SharedErrorCodes.SYSTEM_CONFIGURATION_ERROR, 500);
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
        averageDisplayMastery: 0,
        averageStability: 0,
        averageDifficulty: 0,
      } satisfies StudyStats;
    }

    let query = client
      .from("study_cards")
      .select("fsrs_state, fsrs_retrievability, fsrs_stability, fsrs_difficulty, next_review, fsrs_last_review")
      .eq("user_id", user.id);

    if (graphId) {
      query = query.eq("graph_id", graphId);
    }

    const { data: cards, error } = await query;

    if (error) {
      throw new AppError(error.message, SharedErrorCodes.DATABASE_QUERY_ERROR, 500);
    }

    const allCards = (cards ?? []) as Array<{
      next_review: string | null;
      fsrs_state: string | null;
      fsrs_retrievability: number | null;
      fsrs_stability: number | null;
      fsrs_difficulty: number | null;
      fsrs_last_review: string | null;
    }>;
    const now = new Date();
    const nowMs = now.getTime();

    let dueCards = 0;
    let newCards = 0;
    let learningCards = 0;
    let reviewCards = 0;
    let relearningCards = 0;
    let totalDisplayMastery = 0;
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

      const displayMastery = computeCardDisplayMastery(card, nowMs);
      totalDisplayMastery += displayMastery;
      totalStability += card.fsrs_stability ?? 0;
      totalDifficulty += card.fsrs_difficulty ?? 0;
    }

    const count = allCards.length;
    const avgDisplayMastery = count > 0 ? Math.round((totalDisplayMastery / count) * 1000) / 1000 : 0;
    return {
      totalCards: count,
      dueCards,
      newCards,
      learningCards,
      reviewCards,
      relearningCards,
      averageRetrievability: avgDisplayMastery,
      averageDisplayMastery: avgDisplayMastery,
      averageStability: count > 0 ? Math.round((totalStability / count) * 100) / 100 : 0,
      averageDifficulty: count > 0 ? Math.round((totalDifficulty / count) * 100) / 100 : 0,
    };
  },

  getFsrsParameters: async () => {
    const client = getMobileSupabaseClient();
    if (!client) {
      throw new AppError("Supabase client not initialized", SharedErrorCodes.SYSTEM_CONFIGURATION_ERROR, 500);
    }

    const {
      data: { user },
    } = await client.auth.getUser();

    if (!user) {
      return {
        source: "default" as const,
        w: [],
        request_retention: 0.9,
        maximum_interval: 36500,
        last_optimized_at: null,
      };
    }

    const { data, error } = await client
      .from("users")
      .select("settings")
      .eq("id", user.id)
      .single();

    if (error) {
      throw new AppError(error.message, SharedErrorCodes.DATABASE_QUERY_ERROR, 500);
    }

    const settings = (data?.settings as Record<string, unknown>) ?? {};
    const storedW = settings.fsrs_parameters as number[] | undefined;
    const source: "default" | "custom" | "optimized" = storedW
      ? (settings.fsrs_parameter_source as "default" | "custom" | "optimized") ?? "custom"
      : "default";

    return {
      source,
      w: storedW ?? [],
      request_retention: (settings.request_retention as number) ?? 0.9,
      maximum_interval: (settings.maximum_interval as number) ?? 36500,
      last_optimized_at: (settings.fsrs_last_optimized_at as string) ?? null,
    };
  },

  setFsrsParameters: async (w: number[]) => {
    const client = getMobileSupabaseClient();
    if (!client) {
      throw new AppError("Supabase client not initialized", SharedErrorCodes.SYSTEM_CONFIGURATION_ERROR, 500);
    }

    const {
      data: { user },
    } = await client.auth.getUser();

    if (!user) {
      throw new AppError("User not authenticated", SharedErrorCodes.AUTH_UNAUTHORIZED, 401);
    }

    const { data: userData } = await client
      .from("users")
      .select("settings")
      .eq("id", user.id)
      .single();

    const currentSettings = (userData?.settings as Record<string, unknown>) ?? {};
    const updatedSettings = {
      ...currentSettings,
      fsrs_parameters: w,
      fsrs_parameter_source: "custom",
    };

    const { error } = await client
      .from("users")
      .update({ settings: updatedSettings })
      .eq("id", user.id);

    if (error) {
      throw new AppError(error.message, SharedErrorCodes.DATABASE_QUERY_ERROR, 500);
    }

    return {
      source: "custom" as const,
      w,
      request_retention: (currentSettings.request_retention as number) ?? 0.9,
      maximum_interval: (currentSettings.maximum_interval as number) ?? 36500,
      last_optimized_at: (currentSettings.fsrs_last_optimized_at as string) ?? null,
    };
  },

  resetFsrsParameters: async () => {
    const client = getMobileSupabaseClient();
    if (!client) {
      throw new AppError("Supabase client not initialized", SharedErrorCodes.SYSTEM_CONFIGURATION_ERROR, 500);
    }

    const {
      data: { user },
    } = await client.auth.getUser();

    if (!user) {
      throw new AppError("User not authenticated", SharedErrorCodes.AUTH_UNAUTHORIZED, 401);
    }

    const { data } = await client
      .from("users")
      .select("settings")
      .eq("id", user.id)
      .single();

    const currentSettings = (data?.settings as Record<string, unknown>) ?? {};
    const { fsrs_parameters, fsrs_parameter_source, fsrs_last_optimized_at, ...restSettings } = currentSettings as Record<string, unknown>;
    void fsrs_parameters; void fsrs_parameter_source; void fsrs_last_optimized_at;

    const { error } = await client
      .from("users")
      .update({ settings: restSettings })
      .eq("id", user.id);

    if (error) {
      throw new AppError(error.message, SharedErrorCodes.DATABASE_QUERY_ERROR, 500);
    }

    return { success: true, message: i18next.t("study.fsrsParameter.resetSuccess") };
  },

  optimizeFsrsParameters: async () => {
    return {
      success: false,
      oldW: [],
      newW: [],
      improvement: 0,
      reviewCount: 0,
      message: i18next.t("study.fsrsParameter.optimizeNotSupported"),
    };
  },

  getSemanticGroups: async (_graphId?: string) => {
    return { groups: [], interference_pairs: [] };
  },
};

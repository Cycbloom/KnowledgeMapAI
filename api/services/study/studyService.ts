import { SupabaseClient } from "@supabase/supabase-js";
import { fsrs, Card, Rating, State, createEmptyCard } from "ts-fsrs";
import type { StudyCard } from "@/types";
import { cacheService, CacheKeys } from "../common/cacheService";
import { logger } from "../../utils/logger";
import { AppError } from "../../middleware/errorHandler";
import { ErrorCodes } from "../../../shared/types/errorCodes";
import type { StudyMode } from "../../../shared/types/scheduler";
import { getStudyModePreset } from "../../../shared/constants/studyModePresets";
import { MASTERY_THRESHOLDS } from "../../../shared/constants/masteryThresholds";
import { appEventBus } from "../core";
import type { ReviewCompletedPayload } from "../../../shared/types/events";
import { masteryCalculationService } from "./masteryCalculationService";

interface GetCardsOptions {
  userId: string;
  graphId?: string;
  knowledgePointId?: string;
  knowledgePointIds?: string[];
  dueOnly?: boolean;
}

interface CreateCardData {
  userId: string;
  knowledgePointId: string;
  sourceGraphId: string;
  question: string;
  answer: string;
  explanation?: string;
  cardType?: StudyCard["card_type"];
  options?: string[];
}

interface CreateCardsBatchItem {
  knowledgePointId: string;
  sourceGraphId: string;
  question: string;
  answer: string;
  explanation?: string;
  cardType?: StudyCard["card_type"];
  options?: string[];
}

interface UpdateProgressResult {
  card: StudyCard;
  scheduledCard: Card;
}

const dbCardToFSRS = (dbCard: StudyCard): Card => {
  const empty = createEmptyCard();
  return {
    ...empty,
    due: new Date(dbCard.next_review || new Date()),
    stability: dbCard.fsrs_stability || 0,
    difficulty: dbCard.fsrs_difficulty || 0,
    elapsed_days: dbCard.fsrs_elapsed_days || 0,
    scheduled_days: dbCard.fsrs_scheduled_days || 0,
    reps: dbCard.review_count || 0,
    state: dbCard.fsrs_state ? (State[dbCard.fsrs_state as keyof typeof State] ?? State.New) : State.New,
    last_review: dbCard.fsrs_last_review
      ? new Date(dbCard.fsrs_last_review)
      : undefined,
  };
};

const mapQualityToRating = (quality: number): Rating => {
  if (quality <= 1) return Rating.Again;
  if (quality === 2) return Rating.Hard;
  if (quality === 3) return Rating.Good;
  return Rating.Easy;
};

export function mapBinaryRating(correct: boolean): Rating {
  return correct ? Rating.Good : Rating.Again;
}

export async function handlePreviewMode(
  supabase: SupabaseClient,
  _userId: string,
  knowledgePointId: string,
): Promise<void> {
  const now = new Date().toISOString();
  await supabase
    .from("knowledge_points")
    .update({
      last_study_at: now,
      updated_at: now,
    })
    .eq("id", knowledgePointId);

  // 基于 FSRS retrievability 重新计算 mastery_level
  await masteryCalculationService.updateKnowledgePointMastery(supabase, knowledgePointId);
}

export function selectStrategyForNode(
  masteryLevel: number,
  fsrsState: string | null,
  daysSinceLastReview: number | null,
): StudyMode {
  if (!fsrsState || fsrsState === "New") {
    return "deep";
  }
  if (daysSinceLastReview !== null && daysSinceLastReview > 14) {
    return "drill";
  }
  if (masteryLevel >= MASTERY_THRESHOLDS.PRACTICE_QUIZ) {
    return "review";
  }
  return "deep";
}

const getFSRS = async (userId: string, supabase: SupabaseClient, studyMode?: StudyMode) => {
  try {
    const { data } = await supabase
      .from("users")
      .select("settings")
      .eq("id", userId)
      .single();

    const params: Record<string, number> = {};
    if (data?.settings?.request_retention) {
      params.request_retention = Number(data.settings.request_retention);
    }
    if (data?.settings?.maximum_interval) {
      params.maximum_interval = Number(data.settings.maximum_interval);
    }

    if (studyMode) {
      const preset = getStudyModePreset(studyMode);
      if (preset.fsrsOverride.request_retention !== undefined) {
        params.request_retention = preset.fsrsOverride.request_retention;
      }
      if (preset.fsrsOverride.maximum_interval !== undefined) {
        params.maximum_interval = preset.fsrsOverride.maximum_interval;
      }
    }

    return fsrs(params);
  } catch (e) {
    logger.warn("Failed to fetch user settings for FSRS, using defaults", e);
    return fsrs();
  }
};

export class StudyService {
  async getCards(
    supabase: SupabaseClient,
    options: GetCardsOptions,
  ): Promise<StudyCard[]> {
    const { userId, graphId, knowledgePointId, knowledgePointIds, dueOnly } =
      options;

    if (graphId && !knowledgePointId && !knowledgePointIds) {
      const cacheKey = CacheKeys.STUDY_CARDS(graphId);

      const cards = await cacheService.getOrSet(cacheKey, async () => {
        const { data, error } = await supabase
          .from("study_cards")
          .select("*")
          .eq("user_id", userId)
          .eq("graph_id", graphId);

        if (error) {
          logger.error("Supabase error fetching cards:", error);
          throw error;
        }
        return (data as StudyCard[]) || [];
      });

      if (dueOnly && Array.isArray(cards)) {
        const now = new Date();
        return cards.filter((c) => new Date(c.next_review) <= now);
      }

      return cards as StudyCard[];
    }

    let query = supabase.from("study_cards").select("*").eq("user_id", userId);

    if (knowledgePointId) {
      query = query.eq("knowledge_point_id", knowledgePointId);
    } else if (knowledgePointIds && knowledgePointIds.length > 0) {
      query = query.in("knowledge_point_id", knowledgePointIds);
    } else if (graphId) {
      query = query.eq("graph_id", graphId);
    }

    if (dueOnly) {
      query = query.lte("next_review", new Date().toISOString());
    }

    const { data, error } = await query;

    if (error) {
      logger.error("Supabase error fetching cards:", error);
      throw error;
    }

    return (data as StudyCard[]) || [];
  }

  async createCard(
    supabase: SupabaseClient,
    data: CreateCardData,
  ): Promise<StudyCard> {
    const {
      userId,
      knowledgePointId,
      sourceGraphId,
      question,
      answer,
      explanation,
      cardType,
      options,
    } = data;

    const { data: card, error } = await supabase
      .from("study_cards")
      .insert([
        {
          user_id: userId,
          knowledge_point_id: knowledgePointId,
          graph_id: sourceGraphId,
          source_graph_id: sourceGraphId,
          question,
          answer,
          explanation: explanation || null,
          card_type: cardType || "qa",
          options: options || null,
          next_review: new Date().toISOString(),
          difficulty: 1,
          fsrs_state: "New",
          fsrs_stability: 0,
          fsrs_difficulty: 0,
          fsrs_elapsed_days: 0,
          fsrs_scheduled_days: 0,
          fsrs_retrievability: 0,
        },
      ])
      .select()
      .single();

    if (error) {
      logger.error("Error creating card:", error);
      throw error;
    }

    await cacheService.del(CacheKeys.STUDY_CARDS(sourceGraphId));

    return card as StudyCard;
  }

  async createCardsBatch(
    supabase: SupabaseClient,
    cards: CreateCardsBatchItem[],
    userId: string,
  ): Promise<StudyCard[]> {
    if (cards.length === 0) return [];

    const cardsToInsert = cards.map((card) => ({
      user_id: userId,
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

    const { data, error } = await supabase
      .from("study_cards")
      .insert(cardsToInsert)
      .select();

    if (error) {
      logger.error("Error creating cards batch:", error);
      throw error;
    }

    const graphIds = new Set(cards.map((c) => c.sourceGraphId));
    graphIds.forEach((gid) => cacheService.del(CacheKeys.STUDY_CARDS(gid)));

    return (data as StudyCard[]) || [];
  }

  async updateProgress(
    supabase: SupabaseClient,
    cardId: string,
    quality: number,
    userId: string,
  ): Promise<UpdateProgressResult> {
    const { data: card, error: fetchError } = await supabase
      .from("study_cards")
      .select("*")
      .eq("id", cardId)
      .single();

    if (fetchError || !card) {
      logger.error("Error fetching card:", fetchError);
      throw new AppError(
        "卡片不存在",
        404,
        ErrorCodes.RESOURCE_CARD_NOT_FOUND
      );
    }

    const fsrsCard = dbCardToFSRS(card as StudyCard);
    const now = new Date();
    const rating = mapQualityToRating(quality);

    const f = await getFSRS(userId, supabase);
    let scheduling_cards;
    try {
      scheduling_cards = f.repeat(fsrsCard, now);
    } catch (fsrsError) {
      logger.error("FSRS algorithm error:", fsrsError);
      throw new AppError(
        "学习算法计算错误",
        500,
        ErrorCodes.LEARNING_FSRS_ERROR
      );
    }
    const scheduledCard = (
      scheduling_cards as unknown as Record<Rating, { card: Card }>
    )[rating].card;

    const { data: updatedCardData, error: updateError } = await supabase
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
        fsrs_last_review: now.toISOString(),
      })
      .eq("id", cardId)
      .select()
      .single();

    if (updateError) {
      logger.error("Error updating card progress:", updateError);
      throw updateError;
    }

    if (card.graph_id) {
      await cacheService.del(CacheKeys.STUDY_CARDS(card.graph_id));
    }

    // 基于 FSRS retrievability 重新计算知识点 mastery_level
    const updatedCard = updatedCardData as StudyCard;
    if (updatedCard?.knowledge_point_id) {
      masteryCalculationService.updateKnowledgePointMastery(
        supabase,
        updatedCard.knowledge_point_id,
      ).catch((err) => logger.error("Failed to update mastery_level after review:", err));
    }

    appEventBus
      .publish<ReviewCompletedPayload>(
        "review_completed",
        {
          reviewTaskId: cardId,
          knowledgePointId: (updatedCard as StudyCard)?.knowledge_point_id ?? "",
          qualityScore: quality,
          nextReviewDate: scheduledCard.due?.toISOString() ?? new Date().toISOString(),
          algorithm: "fsrs",
        },
        userId,
        "study_service",
      )
      .catch((err) => logger.error("review_completed event publish failed:", err));

    return {
      card: updatedCard as StudyCard,
      scheduledCard,
    };
  }

  async deleteCard(supabase: SupabaseClient, cardId: string): Promise<void> {
    const { data: card, error: fetchError } = await supabase
      .from("study_cards")
      .select("graph_id")
      .eq("id", cardId)
      .single();

    if (fetchError) {
      logger.error("Error fetching card for deletion:", fetchError);
      throw fetchError;
    }

    const { error } = await supabase
      .from("study_cards")
      .delete()
      .eq("id", cardId);

    if (error) {
      logger.error("Error deleting card:", error);
      throw error;
    }

    if (card?.graph_id) {
      await cacheService.del(CacheKeys.STUDY_CARDS(card.graph_id));
    }
  }

  async deleteCardsBatch(
    supabase: SupabaseClient,
    cardIds: string[],
  ): Promise<void> {
    if (cardIds.length === 0) return;

    const { data: cards, error: fetchError } = await supabase
      .from("study_cards")
      .select("id, graph_id")
      .in("id", cardIds);

    if (fetchError) {
      logger.error("Error fetching cards for batch deletion:", fetchError);
      throw fetchError;
    }

    const { error } = await supabase
      .from("study_cards")
      .delete()
      .in("id", cardIds);

    if (error) {
      logger.error("Error deleting cards batch:", error);
      throw error;
    }

    if (cards) {
      const graphIds = new Set(
        cards.map((c: { graph_id: string }) => c.graph_id).filter(Boolean),
      );
      graphIds.forEach((gid) =>
        cacheService.del(CacheKeys.STUDY_CARDS(gid as string)),
      );
    }
  }

  async getStudyStats(
    supabase: SupabaseClient,
    userId: string,
    graphId?: string,
  ): Promise<{
    totalCards: number;
    dueCards: number;
    newCards: number;
    learningCards: number;
    reviewCards: number;
    relearningCards: number;
    averageRetrievability: number;
    averageStability: number;
    averageDifficulty: number;
  }> {
    let query = supabase
      .from("study_cards")
      .select("fsrs_state, fsrs_retrievability, fsrs_stability, fsrs_difficulty, next_review")
      .eq("user_id", userId);

    if (graphId) {
      query = query.eq("graph_id", graphId);
    }

    const { data: cards, error } = await query;

    if (error) {
      logger.error("Error fetching study stats:", error);
      throw error;
    }

    const allCards = cards ?? [];
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
  }

  async insertCards(
    supabase: SupabaseClient,
    cards: Array<{
      user_id: string;
      knowledge_point_id: string;
      graph_id: string;
      question: string;
      answer: string;
      explanation?: string | null;
      card_type?: string;
      options?: string | null;
      next_review: string;
      difficulty: number;
      fsrs_state: string;
      fsrs_stability: number;
      fsrs_difficulty: number;
      fsrs_elapsed_days: number;
      fsrs_scheduled_days: number;
      fsrs_retrievability: number;
    }>,
  ): Promise<{ success: boolean; error?: string }> {
    const { error } = await supabase.from("study_cards").insert(cards);
    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true };
  }

  async getUserStudyStats(
    supabase: SupabaseClient,
    userId: string,
  ): Promise<{
    distribution?: Array<{ state: string; count: number }>;
    heatmap?: unknown[];
    forecast?: Array<{ date: string | number; count: number }>;
    growth?: Array<{ date: string | number; count: number }>;
    metrics: {
      totalCards: number;
      dueToday: number;
      learning: number;
      avgStability: number;
    };
  }> {
    const { data, error } = await supabase.rpc("get_user_study_stats", {
      p_user_id: userId,
    });

    if (error) {
      throw error;
    }

    return data as {
      distribution?: Array<{ state: string; count: number }>;
      heatmap?: unknown[];
      forecast?: Array<{ date: string | number; count: number }>;
      growth?: Array<{ date: string | number; count: number }>;
      metrics: {
        totalCards: number;
        dueToday: number;
        learning: number;
        avgStability: number;
      };
    };
  }
}

export const studyService = new StudyService();

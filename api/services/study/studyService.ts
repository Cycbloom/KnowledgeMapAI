/** @mastery display */
import { SupabaseClient } from "@supabase/supabase-js";
import {
  fsrs,
  State,
  Card,
  Rating,
  migrateParameters,
  type FSRSParameters,
} from "ts-fsrs";
import type { StudyCard } from '@shared/types';
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
import { stabilityToMasteryBaseline, computeCardDisplayMastery } from "../../../shared/utils/fsrs/masteryContract";
import { dbCardToFSRS, mapQualityToRating } from "../../../shared/utils/fsrs/cardConversion";

interface GetCardsOptions {
  userId: string;
  graphId?: string;
  knowledgePointId?: string;
  knowledgePointIds?: string[];
  dueOnly?: boolean;
  /** Server-side pagination. When provided, returns a paginated result. */
  page?: number;
  pageSize?: number;
  search?: string;
  cardType?: string;
  fsrsState?: string;
  reviewCountMin?: number;
  reviewCountMax?: number;
  nextReviewStart?: string;
  nextReviewEnd?: string;
}

export interface PaginatedCardsResult {
  items: StudyCard[];
  total: number;
  page: number;
  pageSize: number;
}

// 联表查询 study_cards 附带来源信息：
// knowledge_points!study_cards_knowledge_point_id_fkey → 来源知识点标题
// knowledge_graphs!study_cards_graph_id_fkey           → 所属图谱标题
// 显式指定 FK 约束名消歧（study_cards 有两个指向 knowledge_graphs 的外键）
const CARD_SOURCE_SELECT = "*, knowledge_points!study_cards_knowledge_point_id_fkey(title), knowledge_graphs!study_cards_graph_id_fkey(title)";

interface CardSourceJoinRow {
  knowledge_points?: { title: string | null } | null;
  knowledge_graphs?: { title: string | null } | null;
}

const enrichCardWithSource = (card: StudyCard & CardSourceJoinRow): StudyCard => {
  const { knowledge_points, knowledge_graphs, ...rest } = card;
  return {
    ...rest,
    knowledgePointTitle: knowledge_points?.title ?? null,
    graphTitle: knowledge_graphs?.title ?? null,
  };
};

const enrichCardsWithSource = (cards: (StudyCard & CardSourceJoinRow)[]): StudyCard[] =>
  cards.map(enrichCardWithSource);

interface CreateCardData {
  userId: string;
  knowledgePointId: string;
  sourceGraphId: string;
  question: string;
  answer: string;
  explanation?: string;
  cardType?: StudyCard["card_type"];
  options?: string[];
  /** 难度数值（1=易 / 2=中 / 3=难），缺省按 1 处理 */
  difficulty?: number;
  /** 考察点（细粒度知识点标签） */
  focusTopic?: string;
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

    const params: Partial<FSRSParameters> = {};
    if (data?.settings?.request_retention) {
      params.request_retention = Number(data.settings.request_retention);
    }
    if (data?.settings?.maximum_interval) {
      params.maximum_interval = Number(data.settings.maximum_interval);
    }

    // 加载用户个性化 FSRS w 参数，并在迁移后校验长度；任何异常都退回默认
    if (Array.isArray(data?.settings?.fsrs_parameters)) {
      try {
        const migratedW = migrateParameters(data.settings.fsrs_parameters as number[]);
        if (Array.isArray(migratedW) && migratedW.length >= 21 && migratedW.every((w) => Number.isFinite(w))) {
          params.w = migratedW;
        }
      } catch (fsrsMigrateErr) {
        logger.warn("FSRS migrateParameters failed, falling back to default w", fsrsMigrateErr);
      }
    }

    if (studyMode) {
      const preset = getStudyModePreset(studyMode);
      if (preset.fsrsOverride.request_retention !== undefined) {
        params.request_retention = preset.fsrsOverride.request_retention;
      }
      if (preset.fsrsOverride.maximum_interval !== undefined) {
        params.maximum_interval = preset.fsrsOverride.maximum_interval;
      }
      if (preset.fsrsOverride.w !== undefined) {
        params.w = preset.fsrsOverride.w;
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
  ): Promise<StudyCard[] | PaginatedCardsResult> {
    const {
      userId,
      graphId,
      knowledgePointId,
      knowledgePointIds,
      dueOnly,
      page,
      pageSize,
      search,
      cardType,
      fsrsState,
      reviewCountMin,
      reviewCountMax,
      nextReviewStart,
      nextReviewEnd,
    } = options;

    const paged = page !== undefined && pageSize !== undefined;

    // Fast path: graph-only, no pagination/filtering → cached full array.
    if (graphId && !knowledgePointId && !knowledgePointIds && !paged) {
      const cacheKey = CacheKeys.STUDY_CARDS(graphId);

      const cards = await cacheService.getOrSet(cacheKey, async () => {
        const { data, error } = await supabase
          .from("study_cards")
          .select(CARD_SOURCE_SELECT)
          .eq("user_id", userId)
          .eq("graph_id", graphId);

        if (error) {
          logger.error("Supabase error fetching cards:", error);
          throw error;
        }
        return enrichCardsWithSource((data as (StudyCard & CardSourceJoinRow)[]) || []);
      });

      if (dueOnly && Array.isArray(cards)) {
        const now = new Date();
        return cards.filter((c) => new Date(c.next_review) <= now);
      }

      return cards as StudyCard[];
    }

    let query = supabase.from("study_cards").select(CARD_SOURCE_SELECT).eq("user_id", userId);

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

    // Server-side structured filtering.
    if (cardType) {
      query = query.eq("card_type", cardType);
    }
    if (fsrsState) {
      const states = fsrsState.split(",").map((s) => s.trim()).filter(Boolean);
      if (states.length === 1) {
        query = query.eq("fsrs_state", states[0]);
      } else if (states.length > 1) {
        query = query.in("fsrs_state", states);
      }
    }
    if (reviewCountMin !== undefined) {
      query = query.gte("review_count", reviewCountMin);
    }
    if (reviewCountMax !== undefined) {
      query = query.lte("review_count", reviewCountMax);
    }
    if (nextReviewStart) {
      query = query.gte("next_review", nextReviewStart);
    }
    if (nextReviewEnd) {
      query = query.lte("next_review", nextReviewEnd);
    }
    if (search && search.trim() !== "") {
      const term = `%${search.trim()}%`;
      query = query.or(`question.ilike.${term},answer.ilike.${term}`);
    }

    if (!paged) {
      const { data, error } = await query;

      if (error) {
        logger.error("Supabase error fetching cards:", error);
        throw error;
      }

      return enrichCardsWithSource((data as (StudyCard & CardSourceJoinRow)[]) || []);
    }

    // Paginated path: count + ranged select.
    const currentPage = Math.max(1, page ?? 1);
    const currentPageSize = Math.max(1, pageSize ?? 20);

    const countQuery = supabase
      .from("study_cards")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);

    if (knowledgePointId) {
      countQuery.eq("knowledge_point_id", knowledgePointId);
    } else if (knowledgePointIds && knowledgePointIds.length > 0) {
      countQuery.in("knowledge_point_id", knowledgePointIds);
    } else if (graphId) {
      countQuery.eq("graph_id", graphId);
    }

    if (dueOnly) {
      countQuery.lte("next_review", new Date().toISOString());
    }
    if (cardType) {
      countQuery.eq("card_type", cardType);
    }
    if (fsrsState) {
      const states = fsrsState.split(",").map((s) => s.trim()).filter(Boolean);
      if (states.length === 1) {
        countQuery.eq("fsrs_state", states[0]);
      } else if (states.length > 1) {
        countQuery.in("fsrs_state", states);
      }
    }
    if (reviewCountMin !== undefined) {
      countQuery.gte("review_count", reviewCountMin);
    }
    if (reviewCountMax !== undefined) {
      countQuery.lte("review_count", reviewCountMax);
    }
    if (nextReviewStart) {
      countQuery.gte("next_review", nextReviewStart);
    }
    if (nextReviewEnd) {
      countQuery.lte("next_review", nextReviewEnd);
    }
    if (search && search.trim() !== "") {
      const term = `%${search.trim()}%`;
      countQuery.or(`question.ilike.${term},answer.ilike.${term}`);
    }

    const { count: total, error: countError } = await countQuery;
    if (countError) {
      logger.error("Supabase error counting cards:", countError);
      throw countError;
    }

    const from = (currentPage - 1) * currentPageSize;
    const to = from + currentPageSize - 1;
    // 稳定排序（created_at 降序 + id 兜底），避免 PostgREST 默认无序返回导致分页间重复/缺失，
    // 从而避免同一张卡在无限滚动列表里重复渲染、选择状态互相串扰。
    const { data, error } = await query
      .order("created_at", { ascending: false })
      .order("id", { ascending: true })
      .range(from, to);

    if (error) {
      logger.error("Supabase error fetching cards page:", error);
      throw error;
    }

    return {
      items: enrichCardsWithSource((data as (StudyCard & CardSourceJoinRow)[]) || []),
      total: total ?? 0,
      page: currentPage,
      pageSize: currentPageSize,
    };
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
      difficulty,
      focusTopic,
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
          difficulty: difficulty ?? 1,
          fsrs_state: "New",
          fsrs_stability: 0,
          fsrs_difficulty: 0,
          fsrs_elapsed_days: 0,
          fsrs_scheduled_days: 0,
          fsrs_retrievability: 0,
          focus_topic: focusTopic || null,
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
      logger.error("FSRS card state before repeat:", {
        cardId,
        state: fsrsCard.state,
        stability: fsrsCard.stability,
        difficulty: fsrsCard.difficulty,
        reps: fsrsCard.reps,
        elapsed_days: fsrsCard.elapsed_days,
        scheduled_days: fsrsCard.scheduled_days,
        due: fsrsCard.due.toISOString(),
        last_review: fsrsCard.last_review?.toISOString() ?? null,
        quality,
        rating,
        raw: {
          fsrs_state: (card as StudyCard).fsrs_state,
          fsrs_stability: (card as StudyCard).fsrs_stability,
          fsrs_difficulty: (card as StudyCard).fsrs_difficulty,
          review_count: (card as StudyCard).review_count,
        },
      });
      throw new AppError(
        "学习算法计算错误",
        500,
        ErrorCodes.LEARNING_FSRS_ERROR
      );
    }
    const scheduledCard = (
      scheduling_cards as unknown as Record<Rating, { card: Card }>
    )[rating].card;

    // fsrs_retrievability 存储口径：S 的半饱和（hyperbolic）归一化长期掌握水平（与前端进度条口径一致）
    // 原 forgetting_curve(w, 0, S) 在 Δt=0 时永远=1，所有评分档都写 100%，丢失 Hard/Good/Easy 等级语义
    // 改用 shared stabilityToMasteryBaseline (s / (s + 7))：S=0→0%、S=7→50%、S=30→81%、S=365→98%，单调且与 S=7 半饱和点吻合
    // 注：R=exp(-Δt/S) 的瞬时时间衰减由前端在渲染时基于 fsrs_last_review + now 实时相乘补充
    const nextStability = Math.max(0, Number(scheduledCard.stability) || 0);
    const nextRetrievability = nextStability > 0
      ? stabilityToMasteryBaseline(nextStability)
      : 0;

    logger.debug("[StudyService.updateProgress] Write fsrs_retrievability baseline", {
      cardId,
      S: nextStability,
      baseline: nextRetrievability,
    });

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
        fsrs_retrievability: nextRetrievability,
        fsrs_last_review: now.toISOString(),
        last_rating: rating,
      })
      .eq("id", cardId)
      .select(CARD_SOURCE_SELECT)
      .single();

    if (updateError) {
      logger.error("Error updating card progress:", updateError);
      throw updateError;
    }

    if (card.graph_id) {
      await cacheService.del(CacheKeys.STUDY_CARDS(card.graph_id));
    }

    // 基于 FSRS retrievability 重新计算知识点 mastery_level
    const updatedCard = enrichCardWithSource(updatedCardData as StudyCard & CardSourceJoinRow);
    if (updatedCard?.knowledge_point_id) {
      masteryCalculationService.updateKnowledgePointMastery(
        supabase,
        updatedCard.knowledge_point_id,
      ).catch((err) => logger.error("Failed to update mastery_level after review:", err));
    }

    appEventBus.publish<ReviewCompletedPayload>(
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
      );

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
    averageDisplayMastery: number;
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
    let totalDisplayMastery = 0;
    let totalStability = 0;
    let totalDifficulty = 0;
    const nowMs = now.getTime();

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

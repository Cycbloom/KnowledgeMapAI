/**
 * 复习任务服务 (FSRS)
 *
 * 所有复习任务统一使用 FSRS 算法，数据存储在 study_cards 表。
 *
 * @schedule decision
 */

import { SupabaseClient } from "@supabase/supabase-js";
import { studyService } from "../study/studyService";
import { AppError } from "../../middleware/errorHandler";
import { ErrorCodes } from "../../../shared/types/errorCodes";
import { logger } from "../../utils/logger";
import i18next from "i18next";
import type { StudyCard } from "@shared/types/common";
import type {
  ReviewTask,
  CreateReviewTaskData,
  ReviewTaskStats,
  PendingReviewTask,
} from "@shared/types";

export class ReviewTaskService {
  async createFirstReviewTask(
    client: SupabaseClient,
    userId: string,
    data: CreateReviewTaskData,
  ): Promise<ReviewTask> {
    const { data: existingCard, error: checkError } = await client
      .from("study_cards")
      .select("id")
      .eq("user_id", userId)
      .eq("knowledge_point_id", data.knowledge_point_id)
      .eq("card_type", "qa")
      .maybeSingle();

    if (checkError) {
      throw new AppError(ErrorCodes.DATABASE_QUERY_ERROR, {
        details: { originalError: checkError.message },
      });
    }

    if (existingCard) {
      throw new AppError(ErrorCodes.DATABASE_DUPLICATE_ENTRY, {
        details: { message: i18next.t("scheduler.api.errors.reviewCardExists") },
      });
    }

    /** @schedule decision - FSRS 初始字段写入：state/stability/difficulty/retrievability/due */
    const { data: reviewTask, error } = await client
      .from("study_cards")
      .insert({
        user_id: userId,
        knowledge_point_id: data.knowledge_point_id,
        graph_id: null,
        card_type: "qa",
        question: "",
        answer: "",
        /** @schedule decision - due 队列排序 */
        next_review: new Date().toISOString(),
        /** @schedule decision - FSRS CardState */
        fsrs_state: "New",
        /** @schedule decision - FSRS Stability (S) 用于间隔计算 */
        fsrs_stability: 0,
        /** @schedule decision - FSRS Difficulty (D) */
        fsrs_difficulty: 0,
        fsrs_elapsed_days: 0,
        fsrs_scheduled_days: 0,
        /** @schedule decision - FSRS Retrievability (R) 快照 */
        fsrs_retrievability: 0,
      })
      .select()
      .single();

    if (error) {
      throw new AppError(ErrorCodes.SCHEDULER_TASK_CREATION_FAILED, {
        details: { originalError: error.message },
      });
    }

    logger.info("FSRS review card created", {
      userId,
      knowledgePointId: data.knowledge_point_id,
      taskId: data.task_id,
      algorithm: "fsrs",
    });

    return this.cardToReviewTask(reviewTask, userId);
  }

  async updateReviewTask(
    client: SupabaseClient,
    userId: string,
    knowledgePointId: string,
    data: { quality: number },
  ): Promise<ReviewTask> {
    // 注意：一个 knowledge_point_id 下可能有多张题型卡片（qa / true_false /
    // cloze / matching 等）。这里优先查找旧版约定的 "qa" 默认卡，找不到再
    // fallback 到该 KP 下创建时间最早的任意一张卡；若仍没有则静默 warn 并
    // 返回 null（由调用方决定是否需要报错）。
    const { data: cards, error: fetchError } = await client
      .from("study_cards")
      .select("*")
      .eq("user_id", userId)
      .eq("knowledge_point_id", knowledgePointId)
      .order("created_at", { ascending: true });

    if (fetchError) {
      throw new AppError(ErrorCodes.DATABASE_QUERY_ERROR, {
        details: { originalError: fetchError.message },
      });
    }

    if (!cards || cards.length === 0) {
      logger.warn("updateReviewTask: no study_cards found for KP", {
        userId,
        knowledgePointId,
      });
      throw new AppError(ErrorCodes.RESOURCE_NOT_FOUND, {
        details: { message: i18next.t("scheduler.api.errors.reviewTaskNotFound") },
      });
    }

    // 优先选 card_type === "qa" 的默认卡，没有则选最早的一张
    const card =
      (cards.find((c) => (c as StudyCard).card_type === "qa") as StudyCard | undefined) ??
      (cards[0] as StudyCard);

    const result = await studyService.updateProgress(
      client,
      card.id,
      data.quality,
      userId,
    );

    logger.info("Review task updated via FSRS", {
      userId,
      knowledgePointId,
      quality: data.quality,
      newState: result.card.fsrs_state,
    });

    return this.cardToReviewTask(result.card, userId);
  }

  async getPendingReviewTasks(
    client: SupabaseClient,
    userId: string,
    limit?: number,
  ): Promise<PendingReviewTask[]> {
    /** @schedule decision - due/overdue 队列查询：next_review <= now 过滤 + 排序 */
    const now = new Date().toISOString();
    let query = client
      .from("study_cards")
      .select("*")
      .eq("user_id", userId)
      .lte("next_review", now)
      .order("next_review", { ascending: true });

    if (limit) {
      query = query.limit(limit);
    }

    const { data: cards, error } = await query;

    if (error) {
      throw new AppError(ErrorCodes.DATABASE_QUERY_ERROR, {
        details: { originalError: error.message },
      });
    }

    const pendingTasks: PendingReviewTask[] = (cards ?? []).map((card: StudyCard) => {
      /** @schedule decision - urgency 计算：next_review 与当前时间比较 → overdue/today/upcoming/future 优先级 */
      const urgency = this.calculateUrgency(card.next_review);
      /** @mastery display - 基于 fsrs_stability 估算用户可见掌握度（不用于调度，仅返回给前端渲染） */
      const masteryLevel = card.fsrs_stability
        ? Math.min(1, card.fsrs_stability / 30)
        : 0;

      return {
        ...this.cardToReviewTask(card, userId),
        urgency,
        masteryLevel,
      };
    });

    return pendingTasks;
  }

  async getReviewTaskStats(
    client: SupabaseClient,
    userId: string,
  ): Promise<ReviewTaskStats> {
    const { data: cards, error } = await client
      .from("study_cards")
      .select("*")
      .eq("user_id", userId);

    if (error) {
      throw new AppError(ErrorCodes.DATABASE_QUERY_ERROR, {
        details: { originalError: error.message },
      });
    }

    if (!cards || cards.length === 0) {
      return {
        total: 0,
        overdue: 0,
        today: 0,
        upcoming: 0,
        future: 0,
        averageStability: 0,
        averageDifficulty: 0,
        averageRetrievability: 0,
      };
    }

    let overdue = 0;
    let today = 0;
    let upcoming = 0;
    let future = 0;
    let totalStability = 0;
    let totalDifficulty = 0;
    let totalRetrievability = 0;

    for (const card of cards) {
      /** @schedule decision - overdue/today/upcoming/future 分类：基于 next_review (due) */
      const urgency = this.calculateUrgency(card.next_review);
      switch (urgency) {
        case "overdue": overdue++; break;
        case "today": today++; break;
        case "upcoming": upcoming++; break;
        case "future": future++; break;
      }
      /** @mastery display - 平均 stability/difficulty/retrievability 仅用于统计面板展示，不参与调度计算 */
      totalStability += card.fsrs_stability ?? 0;
      totalDifficulty += card.fsrs_difficulty ?? 0;
      totalRetrievability += card.fsrs_retrievability ?? 0;
    }

    const count = cards.length;
    return {
      total: count,
      overdue,
      today,
      upcoming,
      future,
      averageStability: Math.round((totalStability / count) * 100) / 100,
      averageDifficulty: Math.round((totalDifficulty / count) * 100) / 100,
      averageRetrievability: Math.round((totalRetrievability / count) * 100) / 100,
    };
  }

  async getReviewTaskByKnowledgePoint(
    client: SupabaseClient,
    userId: string,
    knowledgePointId: string,
  ): Promise<ReviewTask | null> {
    const { data, error } = await client
      .from("study_cards")
      .select("*")
      .eq("user_id", userId)
      .eq("knowledge_point_id", knowledgePointId)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return null;
      }
      throw new AppError(ErrorCodes.DATABASE_QUERY_ERROR, {
        details: { originalError: error.message },
      });
    }

    return this.cardToReviewTask(data, userId);
  }

  async deleteReviewTask(
    client: SupabaseClient,
    userId: string,
    knowledgePointId: string,
  ): Promise<void> {
    const { error } = await client
      .from("study_cards")
      .delete()
      .eq("user_id", userId)
      .eq("knowledge_point_id", knowledgePointId);

    if (error) {
      throw new AppError(ErrorCodes.DATABASE_QUERY_ERROR, {
        details: { originalError: error.message },
      });
    }

    logger.info("Review card deleted", {
      userId,
      knowledgePointId,
    });
  }

  /** @schedule decision - overdue/today/upcoming/future 四象限分类：基于 due date 与当前时间比较 */
  private calculateUrgency(nextReview: string): "overdue" | "today" | "upcoming" | "future" {
    const now = new Date();
    const nextDate = new Date(nextReview);
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);

    if (nextDate <= now) return "overdue";
    if (nextDate <= todayEnd) return "today";

    const nextWeek = new Date(now);
    nextWeek.setDate(nextWeek.getDate() + 7);
    if (nextDate <= nextWeek) return "upcoming";
    return "future";
  }

  private cardToReviewTask(card: StudyCard, userId: string): ReviewTask {
    return {
      id: card.id,
      user_id: userId,
      knowledge_point_id: card.knowledge_point_id,
      task_id: "",
      algorithm: "fsrs",
      /** @schedule decision - FSRS Stability (S) 返回给 API 调用方（可能被下游调度逻辑使用） */
      fsrs_stability: card.fsrs_stability,
      /** @schedule decision - FSRS Difficulty (D) */
      fsrs_difficulty: card.fsrs_difficulty,
      /** @schedule decision - FSRS CardState (New/Learning/Review/Relearning) */
      fsrs_state: card.fsrs_state,
      /** @schedule decision | @mastery display - Retrievability 快照：既用于 due 计算 fallback，也可用于 UI 展示旧版逻辑 */
      fsrs_retrievability: card.fsrs_retrievability,
      /** @schedule decision - next due date (next_review) 用于下游队列/排序 */
      next_review_date: card.next_review,
      last_review_date: card.last_reviewed ?? null,
      last_quality_score: null,
      created_at: card.created_at ?? new Date().toISOString(),
      updated_at: card.created_at ?? new Date().toISOString(),
    };
  }
}

export const reviewTaskService = new ReviewTaskService();

/**
 * 复习任务服务 (FSRS)
 *
 * 所有复习任务统一使用 FSRS 算法，数据存储在 study_cards 表。
 */

import { SupabaseClient } from "@supabase/supabase-js";
import { studyService } from "../study/studyService";
import { AppError } from "../../middleware/errorHandler";
import { ErrorCodes } from "../../../shared/types/errorCodes";
import { logger } from "../../utils/logger";
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
        details: { message: "该知识点已存在复习卡片 (FSRS)" },
      });
    }

    const { data: reviewTask, error } = await client
      .from("study_cards")
      .insert({
        user_id: userId,
        knowledge_point_id: data.knowledge_point_id,
        graph_id: null,
        card_type: "qa",
        question: "",
        answer: "",
        next_review: new Date().toISOString(),
        fsrs_state: "New",
        fsrs_stability: 0,
        fsrs_difficulty: 0,
        fsrs_elapsed_days: 0,
        fsrs_scheduled_days: 0,
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
    const { data: card, error: fetchError } = await client
      .from("study_cards")
      .select("*")
      .eq("user_id", userId)
      .eq("knowledge_point_id", knowledgePointId)
      .single();

    if (fetchError) {
      if (fetchError.code === "PGRST116") {
        throw new AppError(ErrorCodes.RESOURCE_NOT_FOUND, {
          details: { message: "复习任务不存在" },
        });
      }
      throw new AppError(ErrorCodes.DATABASE_QUERY_ERROR, {
        details: { originalError: fetchError.message },
      });
    }

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
      const urgency = this.calculateUrgency(card.next_review);
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
      const urgency = this.calculateUrgency(card.next_review);
      switch (urgency) {
        case "overdue": overdue++; break;
        case "today": today++; break;
        case "upcoming": upcoming++; break;
        case "future": future++; break;
      }
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
      fsrs_stability: card.fsrs_stability,
      fsrs_difficulty: card.fsrs_difficulty,
      fsrs_state: card.fsrs_state,
      fsrs_retrievability: card.fsrs_retrievability,
      next_review_date: card.next_review,
      last_review_date: card.last_reviewed ?? null,
      last_quality_score: null,
      created_at: card.created_at ?? new Date().toISOString(),
      updated_at: card.created_at ?? new Date().toISOString(),
    };
  }
}

export const reviewTaskService = new ReviewTaskService();

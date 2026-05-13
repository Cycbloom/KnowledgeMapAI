import { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "../../utils/logger";
import { schedulerEventBus } from "../scheduler/core/eventBus";
import type { ReviewCompletedPayload } from "../../../shared/types/scheduler";

/**
 * 间隔重复桥接服务 - 统一 SM2 和 FSRS 的对外接口
 *
 * **迁移通知**: 默认算法已从 SM2 切换为 FSRS。
 * - 遗留 SM2 任务 (knowledge_review_tasks) 继续通过 SM2 路径处理
 * - 新任务 (study_cards) 默认走 FSRS 路径
 */

interface UnifiedReviewItem {
  id: string;
  knowledgePointId: string;
  nextReviewDate: string;
  urgency: "overdue" | "today" | "upcoming" | "future";
  algorithm: "sm2" | "fsrs";
  title?: string;
  masteryLevel: number;
}

interface ReviewResult {
  nextReviewDate: string;
  intervalDays: number;
  algorithm: "sm2" | "fsrs";
}

class SpacedRepetitionBridge {
  async getUnifiedReviewQueue(
    supabase: SupabaseClient,
    userId: string,
  ): Promise<UnifiedReviewItem[]> {
    const [sm2Items, fsrsItems] = await Promise.allSettled([
      this.getSM2ReviewQueue(supabase, userId),
      this.getFSRSReviewQueue(supabase, userId),
    ]);

    const items: UnifiedReviewItem[] = [];

    if (sm2Items.status === "fulfilled") {
      items.push(...sm2Items.value);
    }
    if (fsrsItems.status === "fulfilled") {
      items.push(...fsrsItems.value);
    }

    items.sort((a, b) => {
      const urgencyOrder = { overdue: 0, today: 1, upcoming: 2, future: 3 };
      const urgencyDiff = urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
      if (urgencyDiff !== 0) return urgencyDiff;
      return a.masteryLevel - b.masteryLevel;
    });

    return items;
  }

  private async getSM2ReviewQueue(
    supabase: SupabaseClient,
    userId: string,
  ): Promise<UnifiedReviewItem[]> {
    const { data: reviews, error } = await supabase
      .from("knowledge_review_tasks")
      .select("id, knowledge_point_id, next_review_date, last_quality_score, ease_factor, repetitions")
      .eq("user_id", userId);

    if (error) {
      logger.error("[SRBridge] Failed to fetch SM2 review queue:", error);
      return [];
    }

    const now = new Date();

    return (reviews ?? []).map((review) => {
      const nextDate = new Date(review.next_review_date);
      const todayEnd = new Date(now);
      todayEnd.setHours(23, 59, 59, 999);
      const tomorrowEnd = new Date(todayEnd);
      tomorrowEnd.setDate(tomorrowEnd.getDate() + 1);

      let urgency: UnifiedReviewItem["urgency"] = "future";
      if (nextDate <= now) urgency = "overdue";
      else if (nextDate <= todayEnd) urgency = "today";
      else if (nextDate <= tomorrowEnd) urgency = "upcoming";

      const masteryLevel = Math.min(1, (review.ease_factor - 1.3) / 1.7);

      return {
        id: review.id,
        knowledgePointId: review.knowledge_point_id,
        nextReviewDate: review.next_review_date,
        urgency,
        algorithm: "sm2" as const,
        masteryLevel,
      };
    });
  }

  private async getFSRSReviewQueue(
    supabase: SupabaseClient,
    userId: string,
  ): Promise<UnifiedReviewItem[]> {
    const { data: cards, error } = await supabase
      .from("study_cards")
      .select("id, knowledge_point_id, next_review, state, difficulty, stability")
      .eq("user_id", userId);

    if (error) {
      logger.error("[SRBridge] Failed to fetch FSRS review queue:", error);
      return [];
    }

    const now = new Date();

    return (cards ?? [])
      .filter((card) => card.next_review && new Date(card.next_review) <= new Date(now.getTime() + 24 * 60 * 60 * 1000))
      .map((card) => {
        const nextDate = new Date(card.next_review);
        const todayEnd = new Date(now);
        todayEnd.setHours(23, 59, 59, 999);
        const tomorrowEnd = new Date(todayEnd);
        tomorrowEnd.setDate(tomorrowEnd.getDate() + 1);

        let urgency: UnifiedReviewItem["urgency"] = "future";
        if (nextDate <= now) urgency = "overdue";
        else if (nextDate <= todayEnd) urgency = "today";
        else if (nextDate <= tomorrowEnd) urgency = "upcoming";

        const masteryLevel = card.stability ? Math.min(1, card.stability / 30) : 0;

        return {
          id: card.id,
          knowledgePointId: card.knowledge_point_id,
          nextReviewDate: card.next_review,
          urgency,
          algorithm: "fsrs" as const,
          masteryLevel,
        };
      });
  }

  async processReviewCompletion(
    supabase: SupabaseClient,
    userId: string,
    reviewId: string,
    knowledgePointId: string,
    qualityScore: number,
    algorithm: "sm2" | "fsrs",
  ): Promise<ReviewResult | null> {
    try {
      let result: ReviewResult | null = null;

      if (algorithm === "sm2") {
        result = await this.processSM2Review(supabase, userId, knowledgePointId, qualityScore);
      } else {
        result = await this.processFSRSReview(supabase, userId, reviewId, qualityScore);
      }

      if (result) {
        await schedulerEventBus.publish<ReviewCompletedPayload>(
          "review_completed",
          {
            reviewTaskId: reviewId,
            knowledgePointId,
            qualityScore,
            nextReviewDate: result.nextReviewDate,
            algorithm: result.algorithm,
          },
          userId,
          "spaced_repetition_bridge",
        );
      }

      return result;
    } catch (error) {
      logger.error("[SRBridge] Failed to process review completion:", error);
      return null;
    }
  }

  private async processSM2Review(
    supabase: SupabaseClient,
    userId: string,
    knowledgePointId: string,
    qualityScore: number,
  ): Promise<ReviewResult | null> {
    const { reviewTaskService } = await import("../scheduler/reviewTaskService");

    const result = await reviewTaskService.updateReviewTask(supabase, userId, knowledgePointId, {
      quality: qualityScore,
    });

    if (!result) return null;

    return {
      nextReviewDate: result.next_review_date,
      intervalDays: result.interval_days ?? 1,
      algorithm: "sm2",
    };
  }

  private async processFSRSReview(
    supabase: SupabaseClient,
    userId: string,
    cardId: string,
    qualityScore: number,
  ): Promise<ReviewResult | null> {
    const { studyService } = await import("./studyService");

    const result = await studyService.updateProgress(supabase, cardId, qualityScore, userId);

    if (!result) return null;

    const nextReviewDate = result.scheduledCard.due?.toISOString() ?? new Date().toISOString();
    const intervalDays = result.scheduledCard.scheduled_days ?? 1;

    return {
      nextReviewDate,
      intervalDays,
      algorithm: "fsrs",
    };
  }
}

export const spacedRepetitionBridge = new SpacedRepetitionBridge();
export { SpacedRepetitionBridge };
export type { UnifiedReviewItem, ReviewResult };

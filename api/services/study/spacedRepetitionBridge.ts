import { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "../../utils/logger";
import { appEventBus } from "../core/eventBus";
import type { ReviewCompletedPayload } from "../../../shared/types/scheduler";

/**
 * Spaced Repetition Bridge - FSRS-only review queue and processing.
 *
 * All review operations use the FSRS algorithm via study_cards.
 * SM2 (knowledge_review_tasks) is deprecated and no longer merged.
 */

interface UnifiedReviewItem {
  id: string;
  knowledgePointId: string;
  nextReviewDate: string;
  urgency: "overdue" | "today" | "upcoming" | "future";
  algorithm: "fsrs";
  title?: string;
  masteryLevel: number;
}

interface ReviewResult {
  nextReviewDate: string;
  intervalDays: number;
  algorithm: "fsrs";
}

class SpacedRepetitionBridge {
  async getUnifiedReviewQueue(
    supabase: SupabaseClient,
    userId: string,
  ): Promise<UnifiedReviewItem[]> {
    const items = await this.getFSRSReviewQueue(supabase, userId);

    items.sort((a, b) => {
      const urgencyOrder = { overdue: 0, today: 1, upcoming: 2, future: 3 };
      const urgencyDiff = urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
      if (urgencyDiff !== 0) return urgencyDiff;
      return a.masteryLevel - b.masteryLevel;
    });

    return items;
  }

  private async getFSRSReviewQueue(
    supabase: SupabaseClient,
    userId: string,
  ): Promise<UnifiedReviewItem[]> {
    const { data: cards, error } = await supabase
      .from("study_cards")
      .select("id, knowledge_point_id, next_review, fsrs_state, fsrs_difficulty, fsrs_stability, fsrs_retrievability")
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

        const masteryLevel = card.fsrs_retrievability ?? 0;

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
  ): Promise<ReviewResult | null> {
    try {
      const result = await this.processFSRSReview(supabase, userId, reviewId, qualityScore);

      if (result) {
        await appEventBus.publish<ReviewCompletedPayload>(
          "review_completed",
          {
            reviewTaskId: reviewId,
            knowledgePointId,
            qualityScore,
            nextReviewDate: result.nextReviewDate,
            algorithm: "fsrs",
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

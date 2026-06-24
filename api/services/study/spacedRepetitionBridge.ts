import { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "../../utils/logger";
import { appEventBus } from "../core/eventBus";
import type { ReviewCompletedPayload } from "../../../shared/types/scheduler";
import { semanticInterferenceService } from "./semanticInterferenceService";

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

    // Check if semantic scheduling is enabled
    const semanticEnabled = await this.isSemanticSchedulingEnabled(supabase, userId);

    // First sort by urgency
    const urgencyOrder = { overdue: 0, today: 1, upcoming: 2, future: 3 };
    items.sort((a, b) => {
      const urgencyDiff = urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
      if (urgencyDiff !== 0) return urgencyDiff;
      return a.masteryLevel - b.masteryLevel;
    });

    if (!semanticEnabled) return items;

    // Group by urgency and apply semantic spacing within each group
    try {
      const groups = this.groupByUrgency(items);
      const result: UnifiedReviewItem[] = [];

      for (const urgency of ["overdue", "today", "upcoming", "future"] as const) {
        const groupItems = groups[urgency];
        if (groupItems.length <= 1) {
          result.push(...groupItems);
          continue;
        }

        const spacedItems = await semanticInterferenceService.getSemanticSpacedOrder<UnifiedReviewItem>(
          supabase,
          groupItems,
        );
        result.push(...spacedItems as UnifiedReviewItem[]);
      }

      return result;
    } catch (error) {
      logger.warn("[SRBridge] Semantic sorting failed, falling back to default sort:", error);
      return items;
    }
  }

  private groupByUrgency(items: UnifiedReviewItem[]): Record<string, UnifiedReviewItem[]> {
    const groups: Record<string, UnifiedReviewItem[]> = {
      overdue: [],
      today: [],
      upcoming: [],
      future: [],
    };
    for (const item of items) {
      groups[item.urgency].push(item);
    }
    return groups;
  }

  private async isSemanticSchedulingEnabled(
    supabase: SupabaseClient,
    userId: string,
  ): Promise<boolean> {
    try {
      const { data } = await supabase
        .from("users")
        .select("settings")
        .eq("id", userId)
        .single();

      // Default to true if not explicitly set to false
      return data?.settings?.study?.semantic_scheduling !== false;
    } catch {
      return true;
    }
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
        appEventBus.publish<ReviewCompletedPayload>(
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

import { appEventBus } from "../eventBus";
import type {
  AppEvent,
  ReviewCompletedPayload,
} from "@shared/types/events";
import { supabaseAdmin } from "../../../supabase";
import { logger } from "../../../utils/logger";

class ReviewSchedulerSubscriber {
  private boundOnReviewCompleted: ((event: AppEvent) => Promise<void>) | null = null;

  initialize() {
    this.boundOnReviewCompleted = this.onReviewCompleted.bind(this);

    appEventBus.subscribe("review_completed", this.boundOnReviewCompleted);
    logger.info("[ReviewSchedulerSubscriber] Subscribers registered");
  }

  destroy() {
    if (this.boundOnReviewCompleted) {
      appEventBus.unsubscribe("review_completed", this.boundOnReviewCompleted);
    }
    this.boundOnReviewCompleted = null;
    logger.info("[ReviewSchedulerSubscriber] Subscribers destroyed");
  }

  private async onReviewCompleted(event: AppEvent) {
    const payload = event.payload as ReviewCompletedPayload;
    await this.scheduleNextReview(event.userId, payload);
  }

  private async scheduleNextReview(userId: string, payload: ReviewCompletedPayload) {
    try {
      const { reviewTaskService } = await import("../../scheduler/reviewTaskService");
      await reviewTaskService.updateReviewTask(supabaseAdmin, userId, payload.knowledgePointId, {
        quality: payload.qualityScore,
      });
    } catch (error) {
      logger.error("[ReviewSchedulerSubscriber] Failed to schedule next review:", error);
    }
  }
}

export const reviewSchedulerSubscriber = new ReviewSchedulerSubscriber();

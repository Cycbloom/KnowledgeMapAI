import { appEventBus } from "../eventBus";
import type {
  AppEvent,
  ReviewCompletedPayload,
} from "@shared/types/events";
import { getSupabaseAdmin } from "../../../supabase";
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
      // FSRS 路径：studyService.updateProgress 在发布 review_completed 前已经
      // 完成了 next_review / fsrs_state / stability / difficulty 等全部字段更新，
      // 此处无需再走 reviewTaskService 做重复计算（且旧逻辑默认按 knowledge_point_id
      // 查唯一 qa 卡，在多题型时代不再成立，容易命中 PGRST116 报错）。
      if (payload.algorithm === "fsrs") {
        logger.debug("[ReviewSchedulerSubscriber] FSRS review handled inline, skipping redundant updateReviewTask", {
          reviewTaskId: payload.reviewTaskId,
          knowledgePointId: payload.knowledgePointId,
        });
        return;
      }
      const { reviewTaskService } = await import("../../scheduler/reviewTaskService");
      await reviewTaskService.updateReviewTask(getSupabaseAdmin(), userId, payload.knowledgePointId, {
        quality: payload.qualityScore,
      });
    } catch (error) {
      logger.error("[ReviewSchedulerSubscriber] Failed to schedule next review:", error);
    }
  }
}

export const reviewSchedulerSubscriber = new ReviewSchedulerSubscriber();

import { appEventBus } from "../eventBus";
import type {
  AppEvent,
  GraphCreatedPayload,
  NodeCreatedPayload,
  FocusSessionEndedPayload,
} from "@shared/types/events";
import type { FocusSession } from "@shared/types/scheduler";
import { logger } from "../../../utils/logger";

class AchievementSubscriber {
  private boundOnTaskCompleted: ((event: AppEvent) => Promise<void>) | null = null;
  private boundOnFocusSessionEnded: ((event: AppEvent) => Promise<void>) | null = null;
  private boundOnGraphCreated: ((event: AppEvent) => Promise<void>) | null = null;
  private boundOnNodeCreated: ((event: AppEvent) => Promise<void>) | null = null;
  private boundOnReviewCompleted: ((event: AppEvent) => Promise<void>) | null = null;

  initialize() {
    this.boundOnTaskCompleted = this.onTaskCompleted.bind(this);
    this.boundOnFocusSessionEnded = this.onFocusSessionEnded.bind(this);
    this.boundOnGraphCreated = this.onGraphCreated.bind(this);
    this.boundOnNodeCreated = this.onNodeCreated.bind(this);
    this.boundOnReviewCompleted = this.onReviewCompleted.bind(this);

    appEventBus.subscribe("task_completed", this.boundOnTaskCompleted);
    appEventBus.subscribe("focus_session_ended", this.boundOnFocusSessionEnded);
    appEventBus.subscribe("graph_created", this.boundOnGraphCreated);
    appEventBus.subscribe("node_created", this.boundOnNodeCreated);
    appEventBus.subscribe("review_completed", this.boundOnReviewCompleted);
    logger.info("[AchievementSubscriber] Subscribers registered");
  }

  destroy() {
    if (this.boundOnTaskCompleted) {
      appEventBus.unsubscribe("task_completed", this.boundOnTaskCompleted);
    }
    if (this.boundOnFocusSessionEnded) {
      appEventBus.unsubscribe("focus_session_ended", this.boundOnFocusSessionEnded);
    }
    if (this.boundOnGraphCreated) {
      appEventBus.unsubscribe("graph_created", this.boundOnGraphCreated);
    }
    if (this.boundOnNodeCreated) {
      appEventBus.unsubscribe("node_created", this.boundOnNodeCreated);
    }
    if (this.boundOnReviewCompleted) {
      appEventBus.unsubscribe("review_completed", this.boundOnReviewCompleted);
    }
    this.boundOnTaskCompleted = null;
    this.boundOnFocusSessionEnded = null;
    this.boundOnGraphCreated = null;
    this.boundOnNodeCreated = null;
    this.boundOnReviewCompleted = null;
    logger.info("[AchievementSubscriber] Subscribers destroyed");
  }

  private async onTaskCompleted(event: AppEvent) {
    await this.checkAchievements(event.userId);
  }

  private async onFocusSessionEnded(event: AppEvent) {
    await this.checkAchievements(event.userId);

    try {
      const { achievementService } = await import("../../achievementService");
      const payload = event.payload as FocusSessionEndedPayload;
      const { getSupabaseAdmin } = await import("../../../supabase");
      const { data: session } = await getSupabaseAdmin()
        .from("focus_sessions")
        .select("*")
        .eq("id", payload.sessionId)
        .single();

      if (session) {
        await achievementService.checkSpecialAchievements(event.userId, session as FocusSession);
      }
    } catch (error) {
      logger.error("[AchievementSubscriber] Failed to check special achievements:", error);
    }
  }

  private async onGraphCreated(event: AppEvent) {
    const payload = event.payload as GraphCreatedPayload;
    try {
      const { achievementService } = await import("../../achievementService");
      await achievementService.updateCreationStats(payload.userId);
    } catch (error) {
      logger.error("[AchievementSubscriber] Failed to update creation stats:", error);
    }
  }

  private async onNodeCreated(event: AppEvent) {
    const payload = event.payload as NodeCreatedPayload;
    try {
      const { achievementService } = await import("../../achievementService");
      await achievementService.updateCreationStats(payload.userId);
    } catch (error) {
      logger.error("[AchievementSubscriber] Failed to update creation stats:", error);
    }
  }

  private async onReviewCompleted(event: AppEvent) {
    try {
      const { achievementService } = await import("../../achievementService");
      await achievementService.updateMasteredStats(event.userId);
      await achievementService.addXp(event.userId, 10);
    } catch (error) {
      logger.error("[AchievementSubscriber] Failed to update mastered stats:", error);
    }
  }

  private async checkAchievements(userId: string) {
    try {
      const { achievementService } = await import("../../achievementService");
      await achievementService.checkAndUnlockAchievements(userId);
    } catch (error) {
      logger.error("[AchievementSubscriber] Failed to check achievements:", error);
    }
  }
}

export const achievementSubscriber = new AchievementSubscriber();

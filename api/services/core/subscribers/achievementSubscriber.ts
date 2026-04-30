import { appEventBus } from "../eventBus";
import type {
  AppEvent,
  GraphCreatedPayload,
} from "@shared/types/events";
import { getSupabaseAdmin } from "../../../supabase";
import { logger } from "../../../utils/logger";

class AchievementSubscriber {
  private boundOnTaskCompleted: ((event: AppEvent) => Promise<void>) | null = null;
  private boundOnFocusSessionEnded: ((event: AppEvent) => Promise<void>) | null = null;
  private boundOnGraphCreated: ((event: AppEvent) => Promise<void>) | null = null;

  initialize() {
    this.boundOnTaskCompleted = this.onTaskCompleted.bind(this);
    this.boundOnFocusSessionEnded = this.onFocusSessionEnded.bind(this);
    this.boundOnGraphCreated = this.onGraphCreated.bind(this);

    appEventBus.subscribe("task_completed", this.boundOnTaskCompleted);
    appEventBus.subscribe("focus_session_ended", this.boundOnFocusSessionEnded);
    appEventBus.subscribe("graph_created", this.boundOnGraphCreated);
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
    this.boundOnTaskCompleted = null;
    this.boundOnFocusSessionEnded = null;
    this.boundOnGraphCreated = null;
    logger.info("[AchievementSubscriber] Subscribers destroyed");
  }

  private async onTaskCompleted(event: AppEvent) {
    await this.checkAchievements(event.userId);
  }

  private async onFocusSessionEnded(event: AppEvent) {
    await this.checkAchievements(event.userId);
  }

  private async onGraphCreated(event: AppEvent) {
    const payload = event.payload as GraphCreatedPayload;
    await this.checkAchievements(payload.userId);
  }

  private async checkAchievements(userId: string) {
    try {
      const { achievementService } = await import("../../scheduler/achievementService");
      await achievementService.checkAndUnlockAchievements(getSupabaseAdmin(), userId);
    } catch (error) {
      logger.error("[AchievementSubscriber] Failed to check achievements:", error);
    }
  }
}

export const achievementSubscriber = new AchievementSubscriber();

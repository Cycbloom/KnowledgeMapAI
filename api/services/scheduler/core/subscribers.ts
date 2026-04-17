import { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "../../../utils/logger";
import { schedulerEventBus } from "./eventBus";
import type {
  SchedulerEvent,
  TaskCompletedPayload,
} from "../../../../shared/types/scheduler";
import { achievementSubscriber } from "../../core/subscribers/achievementSubscriber";
import { learningProgressSubscriber } from "../../core/subscribers/learningProgressSubscriber";
import { reviewSchedulerSubscriber } from "../../core/subscribers/reviewSchedulerSubscriber";

class SchedulerSubscribers {
  private supabase: SupabaseClient | null = null;
  private boundOnTaskCompleted: ((event: SchedulerEvent) => Promise<void>) | null = null;

  initialize(supabaseClient: SupabaseClient) {
    this.supabase = supabaseClient;
    this.boundOnTaskCompleted = this.onTaskCompleted.bind(this);
    schedulerEventBus.subscribe("task_completed", this.boundOnTaskCompleted);

    achievementSubscriber.initialize();
    learningProgressSubscriber.initialize();
    reviewSchedulerSubscriber.initialize();

    logger.info("[Subscribers] All event subscribers registered");
  }

  destroy() {
    if (this.boundOnTaskCompleted) {
      schedulerEventBus.unsubscribe("task_completed", this.boundOnTaskCompleted);
    }
    this.boundOnTaskCompleted = null;

    achievementSubscriber.destroy();
    learningProgressSubscriber.destroy();
    reviewSchedulerSubscriber.destroy();

    logger.info("[Subscribers] All event subscribers destroyed");
  }

  private async onTaskCompleted(event: SchedulerEvent) {
    const payload = event.payload as TaskCompletedPayload;
    await this.updateEfficiency(event.userId, payload);
  }

  private async updateEfficiency(userId: string, payload: TaskCompletedPayload) {
    if (!this.supabase) return;
    try {
      const { efficiencyService } = await import("../efficiencyService");
      await efficiencyService.recordTaskCompletion(this.supabase, {
        taskId: payload.taskId,
        userId,
        startedAt: new Date(Date.now() - (payload.actualDuration ?? 0) * 60000).toISOString(),
        completedAt: new Date().toISOString(),
        duration: payload.actualDuration ?? 0,
        tags: payload.tags,
        queueLevel: payload.queueLevel,
      });
    } catch (error) {
      logger.error("[Subscribers] Failed to update efficiency:", error);
    }
  }
}

export const schedulerSubscribers = new SchedulerSubscribers();
export { SchedulerSubscribers };

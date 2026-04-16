import { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "../../../utils/logger";
import { schedulerEventBus } from "./eventBus";
import type {
  SchedulerEvent,
  TaskCompletedPayload,
  FocusSessionEndedPayload,
  ReviewCompletedPayload,
} from "../../../../shared/types/scheduler";

class SchedulerSubscribers {
  private supabase: SupabaseClient | null = null;

  initialize(supabaseClient: SupabaseClient) {
    this.supabase = supabaseClient;
    this.registerSubscribers();
  }

  private registerSubscribers() {
    schedulerEventBus.subscribe("task_completed", this.onTaskCompleted.bind(this));
    schedulerEventBus.subscribe("focus_session_ended", this.onFocusSessionEnded.bind(this));
    schedulerEventBus.subscribe("review_completed", this.onReviewCompleted.bind(this));
    logger.info("[Subscribers] All event subscribers registered");
  }

  private async onTaskCompleted(event: SchedulerEvent) {
    const payload = event.payload as TaskCompletedPayload;
    logger.info(`[Subscribers] Task completed: ${payload.taskId}`);

    await Promise.allSettled([
      this.updateEfficiency(event.userId, payload),
      this.checkAchievements(event.userId),
      this.syncKnowledgePointProgress(event.userId, payload),
      this.updateLearningPathProgress(event.userId, payload),
      this.updatePeriodicTaskProgressOnTask(event.userId, payload),
      this.handleLearningLoopTaskCompleted(event.userId, payload),
    ]);
  }

  private async onFocusSessionEnded(event: SchedulerEvent) {
    const payload = event.payload as FocusSessionEndedPayload;
    logger.info(`[Subscribers] Focus session ended: ${payload.sessionId}`);

    await Promise.allSettled([
      this.checkAchievementsOnFocus(event.userId),
      this.updatePeriodicTaskProgressOnFocus(event.userId, payload),
      this.handleLearningLoopFocusSession(event.userId, payload),
    ]);
  }

  private async onReviewCompleted(event: SchedulerEvent) {
    const payload = event.payload as ReviewCompletedPayload;
    logger.info(`[Subscribers] Review completed: ${payload.reviewTaskId}`);

    await this.scheduleNextReview(event.userId, payload);
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

  private async checkAchievements(userId: string) {
    if (!this.supabase) return;
    try {
      const { achievementService } = await import("../achievementService");
      await achievementService.checkAndUnlockAchievements(this.supabase, userId);
    } catch (error) {
      logger.error("[Subscribers] Failed to check achievements:", error);
    }
  }

  private async syncKnowledgePointProgress(userId: string, payload: TaskCompletedPayload) {
    if (!this.supabase || !payload.knowledgePointId) return;
    try {
      const { progressSyncService } = await import("../progressSyncService");
      await progressSyncService.syncTaskCompletion(this.supabase, {
        taskId: payload.taskId,
        userId,
      });
    } catch (error) {
      logger.error("[Subscribers] Failed to sync knowledge point progress:", error);
    }
  }

  private async updateLearningPathProgress(userId: string, payload: TaskCompletedPayload) {
    if (!this.supabase) return;
    try {
      const { pathProgressService } = await import("../pathProgressService");
      await pathProgressService.syncTaskCompletionToPath(this.supabase, userId, payload.taskId);
    } catch (error) {
      logger.error("[Subscribers] Failed to update learning path progress:", error);
    }
  }

  private async updatePeriodicTaskProgressOnTask(userId: string, _payload: TaskCompletedPayload) {
    try {
      const { periodicTaskService } = await import("../periodicTaskService");
      await periodicTaskService.updatePeriodicTaskProgress(userId, "tasks", 1);
    } catch (error) {
      logger.error("[Subscribers] Failed to update periodic task progress:", error);
    }
  }

  private async checkAchievementsOnFocus(userId: string) {
    if (!this.supabase) return;
    try {
      const { achievementService } = await import("../achievementService");
      await achievementService.checkAndUnlockAchievements(this.supabase, userId);
    } catch (error) {
      logger.error("[Subscribers] Failed to check focus achievements:", error);
    }
  }

  private async updatePeriodicTaskProgressOnFocus(userId: string, payload: FocusSessionEndedPayload) {
    try {
      const { periodicTaskService } = await import("../periodicTaskService");
      const focusMinutes = Math.round(payload.duration / 60);
      await periodicTaskService.updatePeriodicTaskProgress(userId, "focus", focusMinutes);
    } catch (error) {
      logger.error("[Subscribers] Failed to update periodic task progress on focus:", error);
    }
  }

  private async scheduleNextReview(userId: string, payload: ReviewCompletedPayload) {
    if (!this.supabase) return;
    try {
      const { reviewTaskService } = await import("../reviewTaskService");
      await reviewTaskService.updateReviewTask(this.supabase, userId, payload.knowledgePointId, {
        quality: payload.qualityScore,
      });
    } catch (error) {
      logger.error("[Subscribers] Failed to schedule next review:", error);
    }
  }

  private async handleLearningLoopFocusSession(userId: string, payload: FocusSessionEndedPayload) {
    if (!this.supabase) return;
    try {
      const { learningLoopOrchestrator } = await import("./learningLoopOrchestrator");
      await learningLoopOrchestrator.handleFocusSessionEnded(this.supabase, userId, payload);
    } catch (error) {
      logger.error("[Subscribers] Failed to handle learning loop focus session:", error);
    }
  }

  private async handleLearningLoopTaskCompleted(userId: string, payload: TaskCompletedPayload) {
    if (!this.supabase) return;
    try {
      const { learningLoopOrchestrator } = await import("./learningLoopOrchestrator");
      await learningLoopOrchestrator.handleTaskCompleted(this.supabase, userId, payload);
    } catch (error) {
      logger.error("[Subscribers] Failed to handle learning loop task completed:", error);
    }
  }
}

export const schedulerSubscribers = new SchedulerSubscribers();
export { SchedulerSubscribers };

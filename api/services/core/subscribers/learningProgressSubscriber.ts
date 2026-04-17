import { appEventBus } from "../eventBus";
import type {
  AppEvent,
  TaskCompletedPayload,
  FocusSessionEndedPayload,
} from "@shared/types/events";
import { supabaseAdmin } from "../../../supabase";
import { logger } from "../../../utils/logger";

class LearningProgressSubscriber {
  private boundOnTaskCompleted: ((event: AppEvent) => Promise<void>) | null = null;
  private boundOnFocusSessionEnded: ((event: AppEvent) => Promise<void>) | null = null;

  initialize() {
    this.boundOnTaskCompleted = this.onTaskCompleted.bind(this);
    this.boundOnFocusSessionEnded = this.onFocusSessionEnded.bind(this);

    appEventBus.subscribe("task_completed", this.boundOnTaskCompleted);
    appEventBus.subscribe("focus_session_ended", this.boundOnFocusSessionEnded);
    logger.info("[LearningProgressSubscriber] Subscribers registered");
  }

  destroy() {
    if (this.boundOnTaskCompleted) {
      appEventBus.unsubscribe("task_completed", this.boundOnTaskCompleted);
    }
    if (this.boundOnFocusSessionEnded) {
      appEventBus.unsubscribe("focus_session_ended", this.boundOnFocusSessionEnded);
    }
    this.boundOnTaskCompleted = null;
    this.boundOnFocusSessionEnded = null;
    logger.info("[LearningProgressSubscriber] Subscribers destroyed");
  }

  private async onTaskCompleted(event: AppEvent) {
    const payload = event.payload as TaskCompletedPayload;

    await Promise.allSettled([
      this.syncKnowledgePointProgress(event.userId, payload),
      this.updateLearningPathProgress(event.userId, payload),
      this.updatePeriodicTaskProgressOnTask(event.userId, payload),
      this.handleLearningLoopTaskCompleted(event.userId, payload),
    ]);
  }

  private async onFocusSessionEnded(event: AppEvent) {
    const payload = event.payload as FocusSessionEndedPayload;

    await Promise.allSettled([
      this.updatePeriodicTaskProgressOnFocus(event.userId, payload),
      this.handleLearningLoopFocusSession(event.userId, payload),
    ]);
  }

  private async syncKnowledgePointProgress(userId: string, payload: TaskCompletedPayload) {
    if (!payload.knowledgePointId) return;
    try {
      const { progressSyncService } = await import("../../scheduler/progressSyncService");
      await progressSyncService.syncTaskCompletion(supabaseAdmin, {
        taskId: payload.taskId,
        userId,
      });
    } catch (error) {
      logger.error("[LearningProgressSubscriber] Failed to sync knowledge point progress:", error);
    }
  }

  private async updateLearningPathProgress(userId: string, payload: TaskCompletedPayload) {
    try {
      const { pathProgressService } = await import("../../scheduler/pathProgressService");
      await pathProgressService.syncTaskCompletionToPath(supabaseAdmin, userId, payload.taskId);
    } catch (error) {
      logger.error("[LearningProgressSubscriber] Failed to update learning path progress:", error);
    }
  }

  private async updatePeriodicTaskProgressOnTask(userId: string, _payload: TaskCompletedPayload) {
    try {
      const { periodicTaskService } = await import("../../scheduler/periodicTaskService");
      await periodicTaskService.updatePeriodicTaskProgress(userId, "tasks", 1);
    } catch (error) {
      logger.error("[LearningProgressSubscriber] Failed to update periodic task progress:", error);
    }
  }

  private async updatePeriodicTaskProgressOnFocus(userId: string, payload: FocusSessionEndedPayload) {
    try {
      const { periodicTaskService } = await import("../../scheduler/periodicTaskService");
      const focusMinutes = Math.round(payload.duration / 60);
      await periodicTaskService.updatePeriodicTaskProgress(userId, "focus", focusMinutes);
    } catch (error) {
      logger.error("[LearningProgressSubscriber] Failed to update periodic task progress on focus:", error);
    }
  }

  private async handleLearningLoopTaskCompleted(userId: string, payload: TaskCompletedPayload) {
    try {
      const { learningLoopOrchestrator } = await import("../../scheduler/core/learningLoopOrchestrator");
      await learningLoopOrchestrator.handleTaskCompleted(supabaseAdmin, userId, payload);
    } catch (error) {
      logger.error("[LearningProgressSubscriber] Failed to handle learning loop task completed:", error);
    }
  }

  private async handleLearningLoopFocusSession(userId: string, payload: FocusSessionEndedPayload) {
    try {
      const { learningLoopOrchestrator } = await import("../../scheduler/core/learningLoopOrchestrator");
      await learningLoopOrchestrator.handleFocusSessionEnded(supabaseAdmin, userId, payload);
    } catch (error) {
      logger.error("[LearningProgressSubscriber] Failed to handle learning loop focus session:", error);
    }
  }
}

export const learningProgressSubscriber = new LearningProgressSubscriber();

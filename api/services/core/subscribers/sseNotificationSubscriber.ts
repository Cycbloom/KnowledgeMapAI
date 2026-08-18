import { appEventBus } from "../eventBus";
import { sseService } from "../sseService";
import type {
  AppEvent,
  AppEventType,
  NotificationNeededPayload,
  AITaskCompletedPayload,
  AITaskFailedPayload,
  TaskCompletedPayload,
  FocusSessionEndedPayload,
  ReviewCompletedPayload,
  AchievementUnlockedPayload,
} from "@shared/types/events";
import { logger } from "../../../utils/logger";

interface SSEMessage {
  type: string;
  message?: string;
  data?: Record<string, unknown>;
  cacheKeys?: string[][];
}

class SSENotificationSubscriber {
  private handlers: Map<AppEventType, (event: AppEvent) => void> = new Map();

  initialize() {
    this.subscribe("notification_needed", this.handleNotificationNeeded);
    this.subscribe("ai_task_completed", this.handleAITaskCompleted);
    this.subscribe("ai_task_failed", this.handleAITaskFailed);
    this.subscribe("task_completed", this.handleTaskCompleted);
    this.subscribe("focus_session_ended", this.handleFocusSessionEnded);
    this.subscribe("review_completed", this.handleReviewCompleted);
    this.subscribe("achievement_unlocked", this.handleAchievementUnlocked);
    logger.info("[SSENotificationSubscriber] All event subscribers registered");
  }

  destroy() {
    for (const [eventType, handler] of this.handlers) {
      appEventBus.unsubscribe(eventType, handler);
    }
    this.handlers.clear();
    logger.info("[SSENotificationSubscriber] All event subscribers removed");
  }

  private subscribe(eventType: AppEventType, handler: (event: AppEvent) => void) {
    const boundHandler = handler.bind(this);
    this.handlers.set(eventType, boundHandler);
    appEventBus.subscribe(eventType, boundHandler);
  }

  private handleNotificationNeeded(event: AppEvent) {
    const payload = event.payload as NotificationNeededPayload;
    const message: SSEMessage = {
      type: payload.type,
      message: payload.message,
      data: payload.data,
      cacheKeys: payload.cacheKeys,
    };
    sseService.sendToUser(payload.userId, message);
  }

  private handleAITaskCompleted(event: AppEvent) {
    const payload = event.payload as AITaskCompletedPayload;
    const message: SSEMessage = {
      type: "task_update",
      data: {
        taskId: payload.taskId,
        status: "completed",
        result: payload.result,
      },
      cacheKeys: payload.graphId
        ? [["graphs", payload.graphId], ["nodes"]]
        : [],
    };
    sseService.sendToUser(payload.userId, message);
  }

  private handleAITaskFailed(event: AppEvent) {
    const payload = event.payload as AITaskFailedPayload;
    const message: SSEMessage = {
      type: "task_update",
      data: {
        taskId: payload.taskId,
        status: "failed",
        error: payload.error,
      },
      cacheKeys: [],
    };
    sseService.sendToUser(payload.userId, message);
  }

  private handleTaskCompleted(event: AppEvent) {
    const payload = event.payload as TaskCompletedPayload;
    const message: SSEMessage = {
      type: "task_completed",
      data: {
        taskId: payload.taskId,
      },
      cacheKeys: [["scheduler", "tasks"], ["scheduler", "stats"], ["scheduler", "queues"]],
    };
    sseService.sendToUser(event.userId, message);
  }

  private handleFocusSessionEnded(event: AppEvent) {
    const payload = event.payload as FocusSessionEndedPayload;
    const message: SSEMessage = {
      type: "focus_session_ended",
      data: {
        sessionId: payload.sessionId,
      },
      cacheKeys: [["scheduler", "tasks"], ["scheduler", "stats"]],
    };
    sseService.sendToUser(event.userId, message);
  }

  private handleReviewCompleted(event: AppEvent) {
    const payload = event.payload as ReviewCompletedPayload;
    const message: SSEMessage = {
      type: "review_completed",
      data: {
        knowledgePointId: payload.knowledgePointId,
      },
      cacheKeys: [["study", "review"], ["scheduler", "stats"]],
    };
    sseService.sendToUser(event.userId, message);
  }

  private handleAchievementUnlocked(event: AppEvent) {
    const payload = event.payload as AchievementUnlockedPayload;
    const message: SSEMessage = {
      type: "achievement_unlocked",
      data: {
        id: payload.id,
        title: payload.title,
        description: payload.description,
        icon: payload.icon,
      },
      cacheKeys: [["achievements"]],
    };
    sseService.sendToUser(event.userId, message);
  }
}

export const sseNotificationSubscriber = new SSENotificationSubscriber();

import { appEventBus } from "../eventBus";
import type { AppEvent, AppEventType } from "@shared/types/events";
import { logger } from "../../../utils/logger";

class AchievementSubscriber {
  private handlers: Map<AppEventType, ((event: AppEvent) => Promise<void>) | null> = new Map();

  initialize() {
    const eventTypes: AppEventType[] = [
      "task_completed",
      "focus_session_ended",
      "graph_created",
      "node_created",
      "review_completed",
    ];

    for (const eventType of eventTypes) {
      const handler = this.createHandler(eventType);
      this.handlers.set(eventType, handler);
      appEventBus.subscribe(eventType, handler);
    }

    logger.info("[AchievementSubscriber] Subscribers registered");
  }

  destroy() {
    for (const [eventType, handler] of this.handlers) {
      if (handler) {
        appEventBus.unsubscribe(eventType, handler);
      }
    }
    this.handlers.clear();
    logger.info("[AchievementSubscriber] Subscribers destroyed");
  }

  private createHandler(eventType: AppEventType): (event: AppEvent) => Promise<void> {
    return async (event: AppEvent) => {
      try {
        const { achievementEngine } = await import("../../achievements/achievementEngine");
        const unlocked = await achievementEngine.evaluateAchievements(event.userId, eventType, event);

        // 解锁事件发布：通知前端弹成就通知 + 触发缓存失效
        for (const ach of unlocked) {
          appEventBus.publish(
            "achievement_unlocked",
            {
              id: ach.id,
              title: ach.name,
              description: ach.description,
              icon: ach.icon,
            },
            event.userId,
            "achievementSubscriber",
          );
        }
      } catch (error) {
        logger.error(`[AchievementSubscriber] Failed to handle ${eventType}:`, error);
      }
    };
  }
}

export const achievementSubscriber = new AchievementSubscriber();

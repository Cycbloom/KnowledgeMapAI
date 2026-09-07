import { appEventBus } from "../eventBus";
import { getSupabaseAdmin } from "../../../supabase";
import { notificationService } from "../../common/notificationService";
import { logger } from "../../../utils/logger";
import i18next from "i18next";
import type {
  AppEvent,
  AppEventType,
  NotificationNeededPayload,
  TaskCompletedPayload,
  FocusSessionEndedPayload,
} from "@shared/types/events";

/**
 * 通知落库订阅器：把核心业务事件写入 notifications 表，
 * 让通知中心能展示真实的系统通知（此前该表无生产端写入）。
 *
 * 覆盖：
 * - task_completed → type=task_complete（尊重 task_complete_enabled，默认开）
 * - focus_session_ended → type=time_slice_end（尊重 time_slice_end_enabled，休息时段跳过）
 *
 * 落库后再发布 notification_needed（SSE），通知中心即时刷新展示。
 * deadline 类型由 cronService.checkDeadlineReminders 直接落库，不在此重复。
 */
class NotificationPersistenceSubscriber {
  private handlers: Map<AppEventType, (event: AppEvent) => void> = new Map();

  initialize() {
    this.subscribe("task_completed", this.handleTaskCompleted);
    this.subscribe("focus_session_ended", this.handleFocusSessionEnded);
    logger.info("[NotificationPersistenceSubscriber] All subscribers registered");
  }

  destroy() {
    for (const [eventType, handler] of this.handlers) {
      appEventBus.unsubscribe(eventType, handler);
    }
    this.handlers.clear();
    logger.info("[NotificationPersistenceSubscriber] All subscribers removed");
  }

  private subscribe(eventType: AppEventType, handler: (event: AppEvent) => void) {
    const boundHandler = handler.bind(this);
    this.handlers.set(eventType, boundHandler);
    appEventBus.subscribe(eventType, boundHandler);
  }

  private async handleTaskCompleted(event: AppEvent) {
    const payload = event.payload as TaskCompletedPayload;
    try {
      const admin = getSupabaseAdmin();
      const { data: settings } = await admin
        .from("notification_settings")
        .select("task_complete_enabled")
        .eq("user_id", event.userId)
        .maybeSingle();
      if (settings?.task_complete_enabled === false) return;

      const { data: task } = await admin
        .from("user_tasks")
        .select("title")
        .eq("id", payload.taskId)
        .maybeSingle();

      const title =
        typeof task?.title === "string" && task.title.trim().length > 0
          ? task.title
          : i18next.t("scheduler.api.messages.taskCompletedGeneric");
      const message = i18next.t("scheduler.api.messages.taskCompleted", { title });

      await notificationService.create(admin, event.userId, {
        type: "task_complete",
        title: i18next.t("scheduler.api.messages.taskCompletedTitle"),
        message,
        data: { taskId: payload.taskId, queueLevel: payload.queueLevel },
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      });

      // 免打扰时段：落库保留（通知中心可见），但不推送
      const inDnd = await notificationService.isInDoNotDisturb(admin, event.userId);
      if (inDnd) return;

      appEventBus.publish<NotificationNeededPayload>(
        "notification_needed",
        {
          userId: event.userId,
          type: "task_complete",
          message,
          data: { taskId: payload.taskId },
          cacheKeys: [["notifications"], ["scheduler", "tasks"]],
        },
        event.userId,
        "notification_persistence",
      );
    } catch (error) {
      logger.error(
        "[NotificationPersistence] Failed to persist task_complete notification:",
        error,
      );
    }
  }

  private async handleFocusSessionEnded(event: AppEvent) {
    const payload = event.payload as FocusSessionEndedPayload;
    // 休息时段不生成专注结束通知
    if (payload.isBreak) return;

    try {
      const admin = getSupabaseAdmin();
      const { data: settings } = await admin
        .from("notification_settings")
        .select("time_slice_end_enabled")
        .eq("user_id", event.userId)
        .maybeSingle();
      if (settings?.time_slice_end_enabled === false) return;

      const minutes = Math.max(1, Math.round((payload.duration ?? 0) / 60));
      const message = i18next.t("scheduler.api.messages.timeSliceEnd", { minutes });

      await notificationService.create(admin, event.userId, {
        type: "time_slice_end",
        title: i18next.t("scheduler.api.messages.timeSliceEndTitle"),
        message,
        data: { sessionId: payload.sessionId, taskId: payload.taskId, minutes },
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      });

      // 免打扰时段：落库保留（通知中心可见），但不推送
      const inDnd = await notificationService.isInDoNotDisturb(admin, event.userId);
      if (inDnd) return;

      appEventBus.publish<NotificationNeededPayload>(
        "notification_needed",
        {
          userId: event.userId,
          type: "time_slice_end",
          message,
          data: { sessionId: payload.sessionId },
          cacheKeys: [["notifications"], ["scheduler", "tasks"]],
        },
        event.userId,
        "notification_persistence",
      );
    } catch (error) {
      logger.error(
        "[NotificationPersistence] Failed to persist time_slice_end notification:",
        error,
      );
    }
  }
}

export const notificationPersistenceSubscriber = new NotificationPersistenceSubscriber();

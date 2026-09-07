import { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "../../utils/logger";
import { getSupabaseAdmin } from "../../supabase";
import { notificationService } from "../common/notificationService";
import { appEventBus } from "../core/eventBus";
import i18next from "i18next";
import type { NotificationNeededPayload } from "../../../shared/types/events";

export interface DailySummary {
  tasksCompleted: number;
  focusMinutes: number;
  cardsReviewed: number;
  pendingReviews: number;
  overdueTasks: number;
}

/**
 * 每日学习摘要服务。
 *
 * 聚合用户当日学习/任务数据，晚间（本地时间 20 点后）生成摘要：
 * - 落库 notifications 表（type=daily_summary，通知中心可见）
 * - 发布 notification_needed（SSE，通知中心即时刷新）
 *
 * 尊重 notification_settings.daily_summary_enabled；当天已生成过则跳过（去重）。
 */
class DailySummaryService {
  async generateForUser(
    supabase: SupabaseClient,
    userId: string,
    todayStart: string,
  ): Promise<DailySummary> {
    const nowIso = new Date().toISOString();

    const [tasksRes, focusRes, reviewedRes, pendingRes, overdueRes] =
      await Promise.all([
        supabase
          .from("user_tasks")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId)
          .eq("status", "completed")
          .gte("completed_at", todayStart),
        supabase
          .from("focus_sessions")
          .select("duration")
          .eq("user_id", userId)
          .gte("ended_at", todayStart),
        supabase
          .from("study_cards")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId)
          .gte("fsrs_last_review", todayStart),
        supabase
          .from("study_cards")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId)
          .lte("next_review", nowIso),
        supabase
          .from("user_tasks")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId)
          .not("deadline", "is", null)
          .is("deleted_at", null)
          .in("status", ["pending", "in_progress", "paused"])
          .lt("deadline", nowIso),
      ]);

    const focusSeconds = (focusRes.data ?? []) as { duration?: number }[];
    return {
      tasksCompleted: tasksRes.count ?? 0,
      focusMinutes: Math.round(
        focusSeconds.reduce((sum, row) => sum + (row.duration ?? 0), 0) / 60,
      ),
      cardsReviewed: reviewedRes.count ?? 0,
      pendingReviews: pendingRes.count ?? 0,
      overdueTasks: overdueRes.count ?? 0,
    };
  }

  async runForAllUsers(): Promise<void> {
    const admin = getSupabaseAdmin();
    const now = new Date();
    // 晚间摘要：仅本地时间 20 点后生成
    if (now.getHours() < 20) return;

    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayStartIso = todayStart.toISOString();
    const dateLabel = todayStartIso.slice(0, 10);

    try {
      // 今日活跃用户：有专注 / 完成任务 / 复习卡片
      const userIds = new Set<string>();
      const [focusRes, taskRes, reviewRes] = await Promise.all([
        admin.from("focus_sessions").select("user_id").gte("ended_at", todayStartIso),
        admin
          .from("user_tasks")
          .select("user_id")
          .eq("status", "completed")
          .gte("completed_at", todayStartIso),
        admin.from("study_cards").select("user_id").gte("fsrs_last_review", todayStartIso),
      ]);
      for (const row of focusRes.data ?? []) userIds.add(row.user_id);
      for (const row of taskRes.data ?? []) userIds.add(row.user_id);
      for (const row of reviewRes.data ?? []) userIds.add(row.user_id);
      if (userIds.size === 0) return;

      const userIdArr = [...userIds];
      const [settingsRes, existingRes] = await Promise.all([
        admin
          .from("notification_settings")
          .select("user_id, daily_summary_enabled")
          .in("user_id", userIdArr),
        admin
          .from("notifications")
          .select("user_id")
          .eq("type", "daily_summary")
          .gte("created_at", todayStartIso)
          .in("user_id", userIdArr),
      ]);

      const enabledUsers = new Set(
        (settingsRes.data ?? [])
          .filter((s) => s.daily_summary_enabled !== false)
          .map((s) => s.user_id),
      );
      const alreadySent = new Set((existingRes.data ?? []).map((n) => n.user_id));

      for (const userId of userIdArr) {
        if (!enabledUsers.has(userId) || alreadySent.has(userId)) continue;
        try {
          const summary = await this.generateForUser(admin, userId, todayStartIso);
          const message = i18next.t("scheduler.api.messages.dailySummary", {
            tasksCompleted: summary.tasksCompleted,
            focusMinutes: summary.focusMinutes,
            cardsReviewed: summary.cardsReviewed,
            pendingReviews: summary.pendingReviews,
            overdueTasks: summary.overdueTasks,
          });

          await notificationService.create(admin, userId, {
            type: "daily_summary",
            title: i18next.t("scheduler.api.messages.dailySummaryTitle"),
            message,
            data: { ...summary, date: dateLabel },
            expires_at: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          });

          // 免打扰时段：落库保留（通知中心可见），但不推送
          const inDnd = await notificationService.isInDoNotDisturb(admin, userId);
          if (inDnd) continue;

          appEventBus.publish<NotificationNeededPayload>(
            "notification_needed",
            {
              userId,
              type: "daily_summary",
              message,
              data: { ...summary, date: dateLabel },
              cacheKeys: [["notifications"]],
            },
            userId,
            "daily_summary_service",
          );
        } catch (error) {
          logger.error(`[DailySummary] failed for user ${userId}:`, error);
        }
      }
    } catch (error) {
      logger.error("[DailySummary] job failed:", error);
    }
  }
}

export const dailySummaryService = new DailySummaryService();

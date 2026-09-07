import { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "../../../supabase";
import { logger } from "../../../utils/logger";
import i18next from "i18next";
import { appEventBus } from "../../core/eventBus";
import type { ScheduleExecutedPayload } from "../../../../shared/types/scheduler";
import type { NotificationNeededPayload } from "../../../../shared/types/events";
import { notDeleted } from '../../common/softDeleteHelper';
import { notificationService } from "../../common/notificationService";
import { embeddingService } from "../../ai/embeddingService";

interface CronJob {
  name: string;
  intervalMs: number;
  handler: () => Promise<void>;
  timer?: ReturnType<typeof setInterval>;
}

class SchedulerCronService {
  private jobs: CronJob[] = [];
  private isRunning = false;

  start() {
    if (this.isRunning) {
      logger.warn("[CronService] Already running");
      return;
    }

    this.isRunning = true;

    this.registerJob({
      name: "execute_due_schedules",
      intervalMs: 60 * 1000,
      handler: this.executeDueSchedules.bind(this),
    });

    this.registerJob({
      name: "check_review_reminders",
      intervalMs: 5 * 60 * 1000,
      handler: this.checkReviewReminders.bind(this),
    });

    this.registerJob({
      name: "aggregate_periodic_task_progress",
      intervalMs: 15 * 60 * 1000,
      handler: this.aggregatePeriodicTaskProgress.bind(this),
    });

    this.registerJob({
      name: "check_periodic_streaks",
      intervalMs: 24 * 60 * 60 * 1000,
      handler: this.checkPeriodicStreaks.bind(this),
    });

    this.registerJob({
      name: "calibrate_achievement_progress",
      intervalMs: 24 * 60 * 60 * 1000,
      handler: this.calibrateAchievementProgress.bind(this),
    });

    this.registerJob({
      name: "backfill_missing_embeddings",
      intervalMs: 24 * 60 * 60 * 1000,
      handler: this.backfillMissingEmbeddings.bind(this),
    });

    this.registerJob({
      name: "run_ai_pre_generation",
      intervalMs: 30 * 60 * 1000,
      handler: this.runAIPreGeneration.bind(this),
    });

    this.registerJob({
      name: "check_deadline_reminders",
      intervalMs: 15 * 60 * 1000,
      handler: this.checkDeadlineReminders.bind(this),
    });

    this.registerJob({
      name: "generate_daily_summary",
      intervalMs: 6 * 60 * 60 * 1000,
      handler: this.generateDailySummary.bind(this),
    });

    this.registerJob({
      name: "reschedule_overdue_tasks",
      intervalMs: 6 * 60 * 60 * 1000,
      handler: this.rescheduleOverdueTasks.bind(this),
    });

    for (const job of this.jobs) {
      job.timer = setInterval(async () => {
        try {
          await job.handler();
        } catch (error) {
          logger.error(`[CronService] Job ${job.name} failed:`, error);
        }
      }, job.intervalMs);

      job.handler().catch((error) => {
        logger.error(`[CronService] Initial run of ${job.name} failed:`, error);
      });
    }

    logger.info(`[CronService] Started with ${this.jobs.length} jobs`);
  }

  stop() {
    for (const job of this.jobs) {
      if (job.timer) {
        clearInterval(job.timer);
      }
    }
    this.jobs = [];
    this.isRunning = false;
    logger.info("[CronService] Stopped");
  }

  registerJob(job: CronJob) {
    this.jobs.push(job);
    if (this.isRunning) {
      job.timer = setInterval(async () => {
        try {
          await job.handler();
        } catch (error) {
          logger.error(`[CronService] Job ${job.name} failed:`, error);
        }
      }, job.intervalMs);
    }
  }

  private async executeDueSchedules() {
    const now = new Date().toISOString();

    const { data: dueSchedules, error } = await getSupabaseAdmin()
      .from("task_schedules")
      .select(
        "id, user_id, schedule_type, schedule_config, task_template_id, next_run_at",
      )
      .eq("is_active", true)
      .lte("next_run_at", now)
      .limit(50);

    if (error) {
      logger.error("[CronService] Failed to fetch due schedules:", error);
      return;
    }

    if (!dueSchedules || dueSchedules.length === 0) return;

    logger.info(`[CronService] Processing ${dueSchedules.length} due schedules`);

    for (const schedule of dueSchedules) {
      const originalNextRun = schedule.next_run_at as
        | string
        | null
        | undefined;

      try {
        // Calculate the next run time before claiming so the claim can
        // atomically advance next_run_at (preventing duplicate execution
        // across multiple instances).
        const newNextRun = this.calculateNextRun(
          schedule.schedule_type,
          schedule.schedule_config,
        );

        // Atomic claim: UPDATE ... WHERE id = ? AND next_run_at = ? AND
        // is_active = true RETURNING *. If RETURNING is empty, another
        // instance already claimed this schedule.
        const { data: claimed, error: claimError } = await getSupabaseAdmin()
          .from("task_schedules")
          .update({
            last_run_at: now,
            next_run_at: newNextRun,
          })
          .eq("id", schedule.id)
          .eq("next_run_at", originalNextRun ?? "")
          .eq("is_active", true)
          .select();

        if (claimError) {
          logger.error(
            `[CronService] Failed to claim schedule ${schedule.id}:`,
            claimError,
          );
          continue;
        }

        if (!claimed || claimed.length === 0) {
          logger.debug(
            `[CronService] Schedule ${schedule.id} already claimed by another instance, skipping`,
          );
          continue;
        }

        // Claim succeeded - execute the schedule. Rollback next_run_at only
        // when executeSchedule itself fails (not when event publishing fails,
        // since the task has already been created at that point).
        let taskCreated: string | undefined;
        try {
          taskCreated = await this.executeSchedule(
            getSupabaseAdmin(),
            schedule,
          );
        } catch (execError) {
          logger.error(
            `[CronService] Failed to execute schedule ${schedule.id}:`,
            execError,
          );
          await this.rollbackScheduleNextRun(schedule.id, originalNextRun);
          continue;
        }

        appEventBus.publish<ScheduleExecutedPayload>(
          "schedule_executed",
          {
            scheduleId: schedule.id,
            scheduleType: schedule.schedule_type,
            taskCreated,
          },
          schedule.user_id,
          "cron_service",
        );
      } catch (error) {
        logger.error(
          `[CronService] Failed to process schedule ${schedule.id}:`,
          error,
        );
      }
    }
  }

  private async rollbackScheduleNextRun(
    scheduleId: string,
    originalNextRun: string | null | undefined,
  ) {
    try {
      await getSupabaseAdmin()
        .from("task_schedules")
        .update({ next_run_at: originalNextRun ?? null })
        .eq("id", scheduleId);
    } catch (rollbackError) {
      logger.error(
        `[CronService] Failed to rollback next_run_at for schedule ${scheduleId}:`,
        rollbackError,
      );
    }
  }

  private async executeSchedule(
    supabase: SupabaseClient,
    schedule: {
      id: string;
      user_id: string;
      schedule_type: string;
      schedule_config: Record<string, unknown>;
      task_template_id: string;
    },
  ): Promise<string | undefined> {
    const { data: template } = await notDeleted(supabase
      .from("user_tasks")
      .select("title, description, queue_level, priority, tags, task_type")
      .eq("id", schedule.task_template_id)
      )
      .single();

    if (!template) {
      logger.warn(`[CronService] Template task ${schedule.task_template_id} not found`);
      return undefined;
    }

    const { count } = await notDeleted(supabase
      .from("user_tasks")
      .select("*", { count: "exact", head: true })
      .eq("user_id", schedule.user_id)
      .eq("queue_level", template.queue_level ?? 0)
      );

    const { data: task, error } = await supabase
      .from("user_tasks")
      .insert({
        user_id: schedule.user_id,
        title: template.title,
        description: template.description,
        queue_level: template.queue_level ?? 0,
        position: count ?? 0,
        priority: template.priority ?? 0,
        tags: template.tags ?? [],
        status: "pending",
        task_type: "periodic",
      })
      .select()
      .single();

    if (error) {
      logger.error("[CronService] Failed to create task from schedule:", error);
      return undefined;
    }

    return task?.id;
  }

  private calculateNextRun(
    scheduleType: string,
    config: Record<string, unknown>,
  ): string {
    const now = new Date();

    switch (scheduleType) {
      case "daily": {
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const time = (config.time as string) ?? "09:00";
        const [hours, minutes] = time.split(":").map(Number);
        tomorrow.setHours(hours ?? 9, minutes ?? 0, 0, 0);
        return tomorrow.toISOString();
      }
      case "weekly": {
        const days = (config.days as number[]) ?? [1];
        const targetDay = days[0] ?? 1;
        const next = new Date(now);
        const currentDay = next.getDay();
        const daysUntilTarget = (targetDay - currentDay + 7) % 7 || 7;
        next.setDate(next.getDate() + daysUntilTarget);
        const time = (config.time as string) ?? "09:00";
        const [hours, minutes] = time.split(":").map(Number);
        next.setHours(hours ?? 9, minutes ?? 0, 0, 0);
        return next.toISOString();
      }
      case "custom": {
        const intervalDays = (config.interval_days as number) ?? 1;
        const next = new Date(now);
        next.setDate(next.getDate() + intervalDays);
        return next.toISOString();
      }
      case "smart": {
        const baseInterval = (config.base_interval as number) ?? 1;
        const adjustmentFactor = (config.adjustment_factor as number) ?? 1.0;
        const adjustedInterval = Math.round(baseInterval * adjustmentFactor);
        const next = new Date(now);
        next.setDate(next.getDate() + Math.max(1, adjustedInterval));
        return next.toISOString();
      }
      default: {
        const next = new Date(now);
        next.setDate(next.getDate() + 1);
        return next.toISOString();
      }
    }
  }

  /**
   * AI 预生成：扫描所有用户未来排期的知识点，为缺失学习资料/题目的
   * 知识点提前入队后台生成任务（详见 preGenerationService）。
   */
  private async runAIPreGeneration() {
    try {
      const { preGenerationService } = await import("../preGenerationService");
      await preGenerationService.runForAllUsers();
    } catch (error) {
      logger.error("[CronService] Failed to run AI pre-generation:", error);
    }
  }

  /**
   * 任务截止时间提醒：扫描接近 deadline / 已逾期的未完成任务，
   * 按用户通知偏好（deadline_enabled / deadline_reminder_minutes）提醒一次，
   * 同时落库 notifications 表（通知中心可见）并发布 SSE 事件（前端 toast）。
   * 24 小时内已提醒过的任务去重，避免每 15 分钟重复轰炸。
   */
  private async checkDeadlineReminders() {
    const admin = getSupabaseAdmin();
    const now = new Date();
    // 默认最多提前 60 分钟扫描（对应默认提醒档 [30, 60]）
    const windowEnd = new Date(now.getTime() + 60 * 60 * 1000);

    try {
      const { data: tasks, error } = await admin
        .from("user_tasks")
        .select("id, user_id, title, deadline, status")
        .not("deadline", "is", null)
        .is("deleted_at", null)
        .in("status", ["pending", "in_progress", "paused"])
        .lte("deadline", windowEnd.toISOString())
        .limit(500);

      if (error) {
        logger.error("[CronService] Failed to fetch deadline tasks:", error);
        return;
      }
      if (!tasks || tasks.length === 0) return;

      const userIds = [...new Set(tasks.map((t) => t.user_id))];

      const [{ data: settingsRows }, { data: existingNotes }] = await Promise.all([
        admin
          .from("notification_settings")
          .select("user_id, deadline_enabled, deadline_reminder_minutes")
          .in("user_id", userIds),
        admin
          .from("notifications")
          .select("data")
          .eq("type", "deadline")
          .in("user_id", userIds)
          .gt("created_at", new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()),
      ]);

      const settingsByUser = new Map<
        string,
        { deadline_enabled: boolean; deadline_reminder_minutes: number[] }
      >();
      for (const s of settingsRows ?? []) {
        settingsByUser.set(s.user_id, {
          deadline_enabled: s.deadline_enabled ?? true,
          deadline_reminder_minutes: Array.isArray(s.deadline_reminder_minutes)
            ? s.deadline_reminder_minutes
            : [30, 60],
        });
      }

      // 24 小时内已提醒过的任务去重
      const notifiedTaskIds = new Set<string>();
      for (const n of existingNotes ?? []) {
        const taskId = (n.data as Record<string, unknown> | null)?.taskId;
        if (typeof taskId === "string") notifiedTaskIds.add(taskId);
      }

      for (const task of tasks) {
        const settings = settingsByUser.get(task.user_id);
        if (!settings?.deadline_enabled) continue;
        if (notifiedTaskIds.has(task.id)) continue;

        const minutesLeft =
          (new Date(task.deadline).getTime() - now.getTime()) / 60000;
        const isOverdue = minutesLeft <= 0;
        const reminderMinutes =
          settings.deadline_reminder_minutes.length > 0
            ? settings.deadline_reminder_minutes
            : [30, 60];
        // 逾期提醒一次；未逾期则仅在跨过提醒档位（±2 分钟容差）时提醒
        const inWindow = reminderMinutes.some(
          (m) => Math.abs(minutesLeft - m) <= 2,
        );
        if (!isOverdue && !inWindow) continue;

        const overdue = isOverdue;
        const minutes = Math.max(1, Math.round(minutesLeft));
        const title = overdue
          ? i18next.t("scheduler.api.messages.overdueTitle")
          : i18next.t("scheduler.api.messages.deadlineTitle");
        const message = overdue
          ? i18next.t("scheduler.api.messages.overdueTask", { title: task.title })
          : i18next.t("scheduler.api.messages.deadlineReminder", {
              title: task.title,
              minutes,
            });

        try {
          await notificationService.create(admin, task.user_id, {
            type: "deadline",
            title,
            message,
            data: { taskId: task.id, taskTitle: task.title, overdue },
            expires_at: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          });
        } catch (err) {
          logger.error(
            `[CronService] Failed to persist deadline notification for task ${task.id}:`,
            err,
          );
          continue;
        }

        // 免打扰时段：落库保留（通知中心可见），但不推送
        const inDnd = await notificationService.isInDoNotDisturb(admin, task.user_id);
        if (inDnd) continue;

        appEventBus.publish<NotificationNeededPayload>(
          "notification_needed",
          {
            userId: task.user_id,
            type: "deadline_reminder",
            message,
            data: { taskId: task.id, taskTitle: task.title, overdue },
            cacheKeys: [["notifications"], ["scheduler", "tasks"]],
          },
          task.user_id,
          "cron_service",
        );
      }
    } catch (error) {
      logger.error("[CronService] Deadline reminders job failed:", error);
    }
  }

  /**
   * 每日学习摘要：晚间（本地时间 20 点后）为活跃用户生成当日小结，
   * 落库 notifications 表并发布 SSE（详见 dailySummaryService）。
   */
  private async generateDailySummary() {
    try {
      const { dailySummaryService } = await import("../dailySummaryService");
      await dailySummaryService.runForAllUsers();
    } catch (error) {
      logger.error("[CronService] Failed to generate daily summary:", error);
    }
  }

  /**
   * 逾期任务自动重排：把已过 deadline 的未完成任务顺延到明天（原时刻），
   * 使任务重新回到日历上、不再停留于逾期状态（详见 overdueRescheduler）。
   */
  private async rescheduleOverdueTasks() {
    try {
      const { overdueRescheduler } = await import("../overdueRescheduler");
      await overdueRescheduler.runForAllUsers();
    } catch (error) {
      logger.error("[CronService] Failed to reschedule overdue tasks:", error);
    }
  }

  private async checkReviewReminders() {
    const today = new Date().toISOString().split("T")[0];

    const { data: overdueReviews, error } = await getSupabaseAdmin()
      .from("study_cards")
      .select("id, user_id, knowledge_point_id, next_review")
      .lte("next_review", new Date().toISOString())
      .limit(100);

    if (error) {
      logger.error("[CronService] Failed to fetch review reminders:", error);
      return;
    }

    if (!overdueReviews || overdueReviews.length === 0) return;

    const userReviews = new Map<string, number>();
    for (const review of overdueReviews) {
      const count = userReviews.get(review.user_id) ?? 0;
      userReviews.set(review.user_id, count + 1);
    }

    for (const [userId, count] of userReviews) {
      try {
        // 免打扰时段不推送复习提醒
        const inDnd = await notificationService.isInDoNotDisturb(
          getSupabaseAdmin(),
          userId,
        );
        if (inDnd) continue;

        appEventBus.publish<NotificationNeededPayload>(
          "notification_needed",
          {
            userId,
            type: "review_reminder",
            message: i18next.t("scheduler.api.messages.pendingReviewCount", { count }),
            data: { count, date: today },
            cacheKeys: [["study", "review"]],
          },
          userId,
          "cron_service",
        );
      } catch (error) {
        logger.error(`[CronService] Failed to send review reminder to ${userId}:`, error);
      }
    }
  }

  private async aggregatePeriodicTaskProgress() {
    try {
      const { periodicTaskService } = await import("../periodicTaskService");
      await periodicTaskService.aggregateAllProgress(getSupabaseAdmin());
    } catch (error) {
      logger.error("[CronService] Failed to aggregate periodic task progress:", error);
    }
  }

  private async checkPeriodicStreaks() {
    try {
      const { data: users, error } = await getSupabaseAdmin()
        .from("user_focus_stats")
        .select("user_id");

      if (error) {
        logger.error("[CronService] Failed to fetch active users:", error);
        return;
      }

      if (!users || users.length === 0) return;

      const { periodicTaskService } = await import("../periodicTaskService");

      for (const user of users) {
        try {
          await periodicTaskService.checkPeriodicStreak(user.user_id);
        } catch (error) {
          logger.error(`[CronService] Failed to check streak for user ${user.user_id}:`, error);
        }
      }
    } catch (error) {
      logger.error("[CronService] Failed to check periodic streaks:", error);
    }
  }

  private async calibrateAchievementProgress(): Promise<void> {
    try {
      const { achievementEngine } = await import("../../achievements/achievementEngine");
      const { data: users } = await getSupabaseAdmin()
        .from("user_focus_stats")
        .select("user_id");
      if (!users || users.length === 0) return;
      for (const user of users) {
        try {
          await achievementEngine.calibrateAllProgress(user.user_id);
        } catch (error) {
          logger.error(`[CronService] Achievement calibration failed for user ${user.user_id}:`, error);
        }
      }
    } catch (error) {
      logger.error("[CronService] Achievement calibration job failed:", error);
    }
  }

  /**
   * 每日回填：扫描所有拥有图谱/知识点的用户，补全其缺失的 embedding。
   * 任一用户存在失败时向该用户推送底部右侧错误通知（由前端消费）。
   */
  private async backfillMissingEmbeddings() {
    try {
      const admin = getSupabaseAdmin();
      const userIds = new Set<string>();

      const [graphRes, pointRes] = await Promise.all([
        admin
          .from("knowledge_graphs")
          .select("user_id")
          .is("deleted_at", null),
        admin.from("knowledge_points").select("owner_id"),
      ]);

      if (graphRes.error) {
        logger.error("[CronService] Failed to fetch graph owners:", graphRes.error);
      } else {
        for (const r of graphRes.data ?? []) userIds.add(r.user_id);
      }
      if (pointRes.error) {
        logger.error("[CronService] Failed to fetch knowledge point owners:", pointRes.error);
      } else {
        for (const r of pointRes.data ?? []) userIds.add(r.owner_id);
      }

      for (const userId of userIds) {
        try {
          const result = await embeddingService.backfillMissingEmbeddings(admin, userId);
          if (result.failed > 0) {
            appEventBus.publish<NotificationNeededPayload>(
              "notification_needed",
              {
                userId,
                type: "embedding_backfill_failed",
                message: "",
                data: { processed: result.processed, failed: result.failed },
                cacheKeys: [],
              },
              userId,
              "cron_service",
            );
          }
        } catch (error) {
          logger.error(`[CronService] Embedding backfill failed for user ${userId}:`, error);
          appEventBus.publish<NotificationNeededPayload>(
            "notification_needed",
            {
              userId,
              type: "embedding_backfill_failed",
              message: "",
              data: { processed: 0, failed: 1 },
              cacheKeys: [],
            },
            userId,
            "cron_service",
          );
        }
      }
    } catch (error) {
      logger.error("[CronService] Embedding backfill job failed:", error);
    }
  }
}

export const schedulerCronService = new SchedulerCronService();
export { SchedulerCronService };

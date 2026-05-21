import { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "../../../supabase";
import { logger } from "../../../utils/logger";
import { appEventBus } from "../../core/eventBus";
import type { ScheduleExecutedPayload } from "../../../../shared/types/scheduler";
import type { NotificationNeededPayload } from "../../../../shared/types/events";

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
      .select("id, user_id, schedule_type, schedule_config, task_template_id")
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
      try {
        const taskCreated = await this.executeSchedule(getSupabaseAdmin(), schedule);

        await appEventBus.publish<ScheduleExecutedPayload>(
          "schedule_executed",
          {
            scheduleId: schedule.id,
            scheduleType: schedule.schedule_type,
            taskCreated,
          },
          schedule.user_id,
          "cron_service",
        );

        await this.updateScheduleNextRun(getSupabaseAdmin(), schedule);
      } catch (error) {
        logger.error(`[CronService] Failed to execute schedule ${schedule.id}:`, error);
      }
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
    const { data: template } = await supabase
      .from("user_tasks")
      .select("title, description, queue_level, priority, tags, task_type")
      .eq("id", schedule.task_template_id)
      .is("deleted_at", null)
      .single();

    if (!template) {
      logger.warn(`[CronService] Template task ${schedule.task_template_id} not found`);
      return undefined;
    }

    const { count } = await supabase
      .from("user_tasks")
      .select("*", { count: "exact", head: true })
      .eq("user_id", schedule.user_id)
      .eq("queue_level", template.queue_level ?? 0)
      .is("deleted_at", null);

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

  private async updateScheduleNextRun(
    supabase: SupabaseClient,
    schedule: {
      id: string;
      user_id: string;
      schedule_type: string;
      schedule_config: Record<string, unknown>;
    },
  ) {
    const nextRunAt = this.calculateNextRun(
      schedule.schedule_type,
      schedule.schedule_config,
    );

    await supabase
      .from("task_schedules")
      .update({
        last_run_at: new Date().toISOString(),
        next_run_at: nextRunAt,
      })
      .eq("id", schedule.id);
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

  private async checkReviewReminders() {
    const today = new Date().toISOString().split("T")[0];

    const { data: overdueReviews, error } = await getSupabaseAdmin()
      .from("knowledge_review_tasks")
      .select("id, user_id, knowledge_point_id, next_review_date")
      .lte("next_review_date", new Date().toISOString())
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
        await appEventBus.publish<NotificationNeededPayload>(
          "notification_needed",
          {
            userId,
            type: "review_reminder",
            message: `你有 ${count} 个待复习的知识点`,
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
}

export const schedulerCronService = new SchedulerCronService();
export { SchedulerCronService };

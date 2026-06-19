import { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "../../utils/logger";
import { AppError } from "../../middleware/errorHandler";
import { ErrorCodes } from "../../../shared/types/errorCodes";

class ScheduleService {
  calculateNextRunAt(
    scheduleType: "daily" | "weekly" | "custom" | "smart",
    scheduleConfig: Record<string, unknown>,
  ): Date {
    const now = new Date();
    const time = (scheduleConfig.time as string) || "09:00";
    const [hours, minutes] = time.split(":").map(Number);

    const nextRun = new Date();
    nextRun.setHours(hours, minutes, 0, 0);

    switch (scheduleType) {
      case "daily": {
        if (nextRun <= now) {
          nextRun.setDate(nextRun.getDate() + 1);
        }
        return nextRun;
      }

      case "weekly": {
        const days = (scheduleConfig.days as number[]) || [1];
        const currentDay = now.getDay();
        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();

        let minDiff = 7;
        for (const targetDay of days) {
          let diff = targetDay - currentDay;
          if (diff < 0) diff += 7;
          if (diff === 0) {
            const targetMinutes = hours * 60 + minutes;
            const currentMinutes = currentHour * 60 + currentMinute;
            if (targetMinutes <= currentMinutes) {
              diff = 7;
            }
          }
          if (diff < minDiff) {
            minDiff = diff;
          }
        }

        nextRun.setDate(nextRun.getDate() + minDiff);
        return nextRun;
      }

      case "custom": {
        const intervalDays = (scheduleConfig.interval_days as number) || 1;
        if (nextRun <= now) {
          nextRun.setDate(nextRun.getDate() + intervalDays);
        }
        return nextRun;
      }

      case "smart": {
        const baseInterval = (scheduleConfig.base_interval as number) || 3;
        if (nextRun <= now) {
          nextRun.setDate(nextRun.getDate() + baseInterval);
        }
        return nextRun;
      }

      default:
        return nextRun;
    }
  }

  async listSchedules(
    supabase: SupabaseClient,
    userId: string,
  ): Promise<Array<Record<string, unknown>>> {
    const { data: schedules, error } = await supabase
      .from("task_schedules")
      .select(
        `
      *,
      task_template:user_tasks(
        id,
        title,
        description,
        queue_level,
        estimated_duration,
        tags,
        priority
      )
    `,
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      logger.error("Get schedules error:", error);
      throw new AppError(ErrorCodes.DATABASE_QUERY_ERROR, {
        message: "获取周期性任务列表失败",
      });
    }

    return schedules as Array<Record<string, unknown>>;
  }

  async createSchedule(
    supabase: SupabaseClient,
    userId: string,
    data: {
      task_template_id: string;
      schedule_type: "daily" | "weekly" | "custom" | "smart";
      schedule_config?: Record<string, unknown>;
      is_active?: boolean;
    },
  ): Promise<Record<string, unknown>> {
    const { task_template_id, schedule_type, schedule_config, is_active } =
      data;

    const { data: taskTemplate, error: taskError } = await supabase
      .from("user_tasks")
      .select("id, user_id")
      .eq("id", task_template_id)
      .eq("user_id", userId)
      .single();

    if (taskError || !taskTemplate) {
      throw new AppError(ErrorCodes.RESOURCE_TASK_NOT_FOUND, {
        message: "任务模板不存在或不属于当前用户",
      });
    }

    const nextRunAt = this.calculateNextRunAt(schedule_type, schedule_config || {});

    const { data: schedule, error } = await supabase
      .from("task_schedules")
      .insert({
        user_id: userId,
        task_template_id,
        schedule_type,
        schedule_config: schedule_config || {},
        next_run_at: nextRunAt.toISOString(),
        is_active: is_active ?? true,
      })
      .select()
      .single();

    if (error) {
      logger.error("Create schedule error:", error);
      throw new AppError(ErrorCodes.SCHEDULER_TASK_CREATION_FAILED, {
        message: "创建周期性任务配置失败",
      });
    }

    return schedule as Record<string, unknown>;
  }

  async updateSchedule(
    supabase: SupabaseClient,
    userId: string,
    scheduleId: string,
    data: {
      schedule_config?: Record<string, unknown>;
      is_active?: boolean;
    },
  ): Promise<Record<string, unknown>> {
    const { schedule_config, is_active } = data;

    const { data: existingSchedule, error: fetchError } = await supabase
      .from("task_schedules")
      .select("*")
      .eq("id", scheduleId)
      .eq("user_id", userId)
      .single();

    if (fetchError || !existingSchedule) {
      throw new AppError(ErrorCodes.NOT_FOUND, {
        message: "周期配置不存在",
      });
    }

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (schedule_config !== undefined) {
      updateData.schedule_config = schedule_config;
      updateData.next_run_at = this.calculateNextRunAt(
        existingSchedule.schedule_type as
          | "daily"
          | "weekly"
          | "custom"
          | "smart",
        schedule_config,
      ).toISOString();
    }

    if (is_active !== undefined) {
      updateData.is_active = is_active;
    }

    const { data: schedule, error } = await supabase
      .from("task_schedules")
      .update(updateData)
      .eq("id", scheduleId)
      .eq("user_id", userId)
      .select()
      .single();

    if (error) {
      logger.error("Update schedule error:", error);
      throw new AppError(ErrorCodes.DATABASE_QUERY_ERROR, {
        message: "更新周期配置失败",
      });
    }

    return schedule as Record<string, unknown>;
  }

  async deleteSchedule(
    supabase: SupabaseClient,
    userId: string,
    scheduleId: string,
  ): Promise<void> {
    const { error } = await supabase
      .from("task_schedules")
      .delete()
      .eq("id", scheduleId)
      .eq("user_id", userId);

    if (error) {
      logger.error("Delete schedule error:", error);
      throw new AppError(ErrorCodes.DATABASE_QUERY_ERROR, {
        message: "删除周期配置失败",
      });
    }
  }

  async runSchedule(
    supabase: SupabaseClient,
    userId: string,
    scheduleId: string,
  ): Promise<{ task: Record<string, unknown>; schedule: Record<string, unknown> }> {
    const { data: schedule, error: scheduleError } = await supabase
      .from("task_schedules")
      .select(
        `
        *,
        task_template:user_tasks(
          id,
          title,
          description,
          queue_level,
          estimated_duration,
          tags,
          priority,
          knowledge_point_id
        )
      `,
      )
      .eq("id", scheduleId)
      .eq("user_id", userId)
      .single();

    if (scheduleError || !schedule) {
      throw new AppError(ErrorCodes.NOT_FOUND, {
        message: "周期配置不存在",
      });
    }

    const template = schedule.task_template;
    if (!template) {
      throw new AppError(ErrorCodes.RESOURCE_TASK_NOT_FOUND, {
        message: "任务模板不存在",
      });
    }

    const { count } = await supabase
      .from("user_tasks")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("queue_level", template.queue_level ?? 0)
      .is("deleted_at", null);

    const { data: task, error: taskError } = await supabase
      .from("user_tasks")
      .insert({
        user_id: userId,
        title: template.title,
        description: template.description,
        queue_level: template.queue_level ?? 0,
        position: count ?? 0,
        estimated_duration: template.estimated_duration,
        tags: template.tags ?? [],
        priority: template.priority ?? 0,
        knowledge_point_id: template.knowledge_point_id,
        status: "pending",
        task_type: "one_time",
      })
      .select()
      .single();

    if (taskError) {
      logger.error("Create task from schedule error:", taskError);
      throw new AppError(ErrorCodes.SCHEDULER_TASK_EXECUTION_FAILED, {
        message: "手动运行调度失败",
      });
    }

    const nextRunAt = this.calculateNextRunAt(
      schedule.schedule_type as "daily" | "weekly" | "custom" | "smart",
      schedule.schedule_config,
    );

    await supabase
      .from("task_schedules")
      .update({
        last_run_at: new Date().toISOString(),
        next_run_at: nextRunAt.toISOString(),
      })
      .eq("id", scheduleId);

    return {
      task: task as Record<string, unknown>,
      schedule: {
        ...schedule,
        last_run_at: new Date().toISOString(),
        next_run_at: nextRunAt.toISOString(),
      } as Record<string, unknown>,
    };
  }
}

export const scheduleService = new ScheduleService();

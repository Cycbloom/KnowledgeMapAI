import { Router, type Response } from "express";
import { requireAuth, type AuthRequest } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { z } from "zod";
import {
  createTaskScheduleSchema,
  updateTaskScheduleSchema,
  taskScheduleParamsSchema,
} from "../../schemas/index";
import { logger } from "../../utils/logger";

const router = Router();

const uuidParamsSchema = z.object({
  id: z.string().uuid("无效的调度ID"),
});

function calculateNextRunAt(
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

router.get(
  "/schedules",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      return res
        .status(500)
        .json({ error: "Database connection not available" });
    }

    const { data: schedules, error } = await supabase
      .from("task_schedules")
      .select(
        `
      *,
      task_template:scheduled_tasks(
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
      .eq("user_id", req.user.id)
      .order("created_at", { ascending: false });

    if (error) {
      logger.error("Get schedules error:", error);
      return res.status(500).json({ error: "获取周期性任务列表失败" });
    }

    res.json({ success: true, data: schedules });
  },
);

router.post(
  "/schedules",
  requireAuth,
  validate({ body: createTaskScheduleSchema }),
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      return res
        .status(500)
        .json({ error: "Database connection not available" });
    }

    const { task_template_id, schedule_type, schedule_config, is_active } =
      req.body;

    const { data: taskTemplate, error: taskError } = await supabase
      .from("scheduled_tasks")
      .select("id, user_id")
      .eq("id", task_template_id)
      .eq("user_id", req.user.id)
      .single();

    if (taskError || !taskTemplate) {
      return res.status(404).json({ error: "任务模板不存在或不属于当前用户" });
    }

    const nextRunAt = calculateNextRunAt(schedule_type, schedule_config || {});

    const { data: schedule, error } = await supabase
      .from("task_schedules")
      .insert({
        user_id: req.user.id,
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
      return res.status(500).json({ error: "创建周期性任务配置失败" });
    }

    res.status(201).json({ success: true, data: schedule });
  },
);

router.put(
  "/schedules/:id",
  requireAuth,
  validate({
    params: taskScheduleParamsSchema,
    body: updateTaskScheduleSchema,
  }),
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      return res
        .status(500)
        .json({ error: "Database connection not available" });
    }

    const { id } = req.params;
    const { schedule_config, is_active } = req.body;

    const { data: existingSchedule, error: fetchError } = await supabase
      .from("task_schedules")
      .select("*")
      .eq("id", id)
      .eq("user_id", req.user.id)
      .single();

    if (fetchError || !existingSchedule) {
      return res.status(404).json({ error: "周期配置不存在" });
    }

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (schedule_config !== undefined) {
      updateData.schedule_config = schedule_config;
      updateData.next_run_at = calculateNextRunAt(
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
      .eq("id", id)
      .eq("user_id", req.user.id)
      .select()
      .single();

    if (error) {
      logger.error("Update schedule error:", error);
      return res.status(500).json({ error: "更新周期配置失败" });
    }

    res.json({ success: true, data: schedule });
  },
);

router.delete(
  "/schedules/:id",
  requireAuth,
  validate({ params: taskScheduleParamsSchema }),
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      return res
        .status(500)
        .json({ error: "Database connection not available" });
    }

    const { id } = req.params;

    const { error } = await supabase
      .from("task_schedules")
      .delete()
      .eq("id", id)
      .eq("user_id", req.user.id);

    if (error) {
      logger.error("Delete schedule error:", error);
      return res.status(500).json({ error: "删除周期配置失败" });
    }

    res.json({ success: true });
  },
);

router.post(
  "/schedules/:id/run",
  requireAuth,
  validate({ params: uuidParamsSchema }),
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      return res
        .status(500)
        .json({ error: "Database connection not available" });
    }

    const { id } = req.params;

    const { data: schedule, error: scheduleError } = await supabase
      .from("task_schedules")
      .select(
        `
        *,
        task_template:scheduled_tasks(
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
      .eq("id", id)
      .eq("user_id", req.user.id)
      .single();

    if (scheduleError || !schedule) {
      return res.status(404).json({ error: "周期配置不存在" });
    }

    const template = schedule.task_template;
    if (!template) {
      return res.status(404).json({ error: "任务模板不存在" });
    }

    const { count } = await supabase
      .from("scheduled_tasks")
      .select("*", { count: "exact", head: true })
      .eq("user_id", req.user.id)
      .eq("queue_level", template.queue_level ?? 0)
      .is("deleted_at", null);

    const { data: task, error: taskError } = await supabase
      .from("scheduled_tasks")
      .insert({
        user_id: req.user.id,
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
      return res.status(500).json({ error: "手动运行调度失败" });
    }

    const nextRunAt = calculateNextRunAt(
      schedule.schedule_type as "daily" | "weekly" | "custom" | "smart",
      schedule.schedule_config,
    );

    await supabase
      .from("task_schedules")
      .update({
        last_run_at: new Date().toISOString(),
        next_run_at: nextRunAt.toISOString(),
      })
      .eq("id", id);

    res.status(201).json({
      success: true,
      data: {
        task,
        schedule: {
          ...schedule,
          last_run_at: new Date().toISOString(),
          next_run_at: nextRunAt.toISOString(),
        },
      },
    });
  },
);

export default router;

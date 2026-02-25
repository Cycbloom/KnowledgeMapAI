import { Router, type Response } from "express";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { z } from "zod";
import {
  createScheduledTaskSchema,
  updateScheduledTaskSchema,
  moveTaskSchema,
  reorderTasksSchema,
} from "../schemas/index.js";
import { aiService } from "../services/ai/index.js";
import { logger } from "../utils/logger.js";

const router = Router();

const getTasksQuerySchema = z.object({
  status: z
    .enum(["pending", "in_progress", "paused", "completed", "cancelled"])
    .optional(),
  queue_level: z.coerce.number().int().min(0).max(2).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

const uuidParamsSchema = z.object({
  id: z.string().uuid("无效的任务ID"),
});

const getExecutionsQuerySchema = z.object({
  task_id: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

const getStatsQuerySchema = z.object({
  period: z.enum(["day", "week", "month"]).optional().default("week"),
});

const getHeatmapQuerySchema = z.object({
  year: z.coerce.number().int().optional(),
  month: z.coerce.number().int().min(1).max(12).optional(),
});

router.post(
  "/tasks",
  requireAuth,
  validate(createScheduledTaskSchema),
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      return res
        .status(500)
        .json({ error: "Database connection not available" });
    }

    const {
      title,
      description,
      queue_level,
      estimated_duration,
      deadline,
      tags,
      knowledge_point_id,
      priority,
    } = req.body;

    const { count } = await supabase
      .from("scheduled_tasks")
      .select("*", { count: "exact", head: true })
      .eq("user_id", req.user.id)
      .eq("queue_level", queue_level ?? 0)
      .is("deleted_at", null);

    const { data: task, error } = await supabase
      .from("scheduled_tasks")
      .insert({
        user_id: req.user.id,
        title,
        description,
        queue_level: queue_level ?? 0,
        position: count ?? 0,
        estimated_duration,
        deadline,
        tags: tags ?? [],
        knowledge_point_id,
        priority: priority ?? 0,
        status: "pending",
      })
      .select()
      .single();

    if (error) {
      console.error("Create task error:", error);
      return res.status(500).json({ error: "创建任务失败" });
    }

    res.status(201).json({ success: true, data: task });
  }
);

router.get(
  "/tasks",
  requireAuth,
  validate({ query: getTasksQuerySchema }),
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      return res
        .status(500)
        .json({ error: "Database connection not available" });
    }

    const { status, queue_level, limit, offset } = req.query as unknown as z.infer<
      typeof getTasksQuerySchema
    >;

    let query = supabase
      .from("scheduled_tasks")
      .select("*", { count: "exact" })
      .eq("user_id", req.user.id)
      .is("deleted_at", null)
      .order("queue_level", { ascending: true })
      .order("position", { ascending: true });

    if (status) {
      query = query.eq("status", status);
    }
    if (queue_level !== undefined) {
      query = query.eq("queue_level", queue_level);
    }

    const {
      data: tasks,
      error,
      count,
    } = await query.range(offset, offset + limit - 1);

    if (error) {
      console.error("Get tasks error:", error);
      return res.status(500).json({ error: "获取任务列表失败" });
    }

    res.json({ success: true, data: tasks, total: count });
  }
);

router.get(
  "/tasks/:id",
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

    const { data: task, error } = await supabase
      .from("scheduled_tasks")
      .select("*")
      .eq("id", id)
      .eq("user_id", req.user.id)
      .is("deleted_at", null)
      .single();

    if (error || !task) {
      return res.status(404).json({ error: "任务不存在" });
    }

    res.json({ success: true, data: task });
  }
);

router.put(
  "/tasks/:id",
  requireAuth,
  validate({ params: uuidParamsSchema, body: updateScheduledTaskSchema }),
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      return res
        .status(500)
        .json({ error: "Database connection not available" });
    }

    const { id } = req.params;
    const updateData = req.body;

    const { data: task, error } = await supabase
      .from("scheduled_tasks")
      .update(updateData)
      .eq("id", id)
      .eq("user_id", req.user.id)
      .is("deleted_at", null)
      .select()
      .single();

    if (error || !task) {
      return res.status(404).json({ error: "任务不存在或更新失败" });
    }

    res.json({ success: true, data: task });
  }
);

router.delete(
  "/tasks/:id",
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

    const { error } = await supabase
      .from("scheduled_tasks")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", req.user.id);

    if (error) {
      return res.status(500).json({ error: "删除任务失败" });
    }

    res.json({ success: true });
  }
);

router.post(
  "/tasks/:id/start",
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

    const { data: task, error: taskError } = await supabase
      .from("scheduled_tasks")
      .update({ status: "in_progress" })
      .eq("id", id)
      .eq("user_id", req.user.id)
      .is("deleted_at", null)
      .select()
      .single();

    if (taskError || !task) {
      return res.status(404).json({ error: "任务不存在" });
    }

    const { data: execution, error: execError } = await supabase
      .from("task_executions")
      .insert({
        task_id: id,
        user_id: req.user.id,
        started_at: new Date().toISOString(),
        queue_level: task.queue_level,
      })
      .select()
      .single();

    if (execError) {
      console.error("Create execution error:", execError);
    }

    res.json({ success: true, data: { task, execution } });
  }
);

router.post(
  "/tasks/:id/pause",
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

    const { data: execution } = await supabase
      .from("task_executions")
      .select("*")
      .eq("task_id", id)
      .eq("user_id", req.user.id)
      .is("ended_at", null)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let duration = 0;
    if (execution) {
      const startedAt = new Date(execution.started_at);
      const endedAt = new Date();
      duration = Math.floor((endedAt.getTime() - startedAt.getTime()) / 1000);

      await supabase
        .from("task_executions")
        .update({
          ended_at: endedAt.toISOString(),
          duration,
          status: "interrupted",
        })
        .eq("id", execution.id);
    }

    const { data: task, error: taskError } = await supabase
      .from("scheduled_tasks")
      .update({ status: "paused" })
      .eq("id", id)
      .eq("user_id", req.user.id)
      .is("deleted_at", null)
      .select()
      .single();

    if (taskError || !task) {
      return res.status(404).json({ error: "任务不存在" });
    }

    res.json({ success: true, data: { task, duration } });
  }
);

router.post(
  "/tasks/:id/complete",
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
    const { actual_duration } = req.body;

    const { data: execution } = await supabase
      .from("task_executions")
      .select("*")
      .eq("task_id", id)
      .eq("user_id", req.user.id)
      .is("ended_at", null)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (execution) {
      const startedAt = new Date(execution.started_at);
      const endedAt = new Date();
      const duration = Math.floor(
        (endedAt.getTime() - startedAt.getTime()) / 1000
      );

      await supabase
        .from("task_executions")
        .update({
          ended_at: endedAt.toISOString(),
          duration,
          status: "completed",
        })
        .eq("id", execution.id);
    }

    const { data: task, error: taskError } = await supabase
      .from("scheduled_tasks")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        actual_duration: actual_duration ?? undefined,
      })
      .eq("id", id)
      .eq("user_id", req.user.id)
      .is("deleted_at", null)
      .select()
      .single();

    if (taskError || !task) {
      return res.status(404).json({ error: "任务不存在" });
    }

    res.json({ success: true, data: task });
  }
);

router.post(
  "/tasks/:id/demote",
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

    const { data: currentTask, error: fetchError } = await supabase
      .from("scheduled_tasks")
      .select("*")
      .eq("id", id)
      .eq("user_id", req.user.id)
      .is("deleted_at", null)
      .single();

    if (fetchError || !currentTask) {
      return res.status(404).json({ error: "任务不存在" });
    }

    const newQueueLevel = Math.min(currentTask.queue_level + 1, 2);

    if (newQueueLevel === currentTask.queue_level) {
      return res.status(400).json({ error: "任务已在最低优先级队列" });
    }

    const { count } = await supabase
      .from("scheduled_tasks")
      .select("*", { count: "exact", head: true })
      .eq("user_id", req.user.id)
      .eq("queue_level", newQueueLevel)
      .is("deleted_at", null);

    const { data: task, error } = await supabase
      .from("scheduled_tasks")
      .update({
        queue_level: newQueueLevel,
        position: count ?? 0,
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: "任务降级失败" });
    }

    res.json({ success: true, data: task });
  }
);

router.get("/queues", requireAuth, async (req: AuthRequest, res: Response) => {
  const supabase = req.supabase;
  if (!supabase) {
    return res.status(500).json({ error: "Database connection not available" });
  }

  const { data: tasks, error } = await supabase
    .from("scheduled_tasks")
    .select("*")
    .eq("user_id", req.user.id)
    .is("deleted_at", null)
    .in("status", ["pending", "in_progress", "paused"])
    .order("queue_level", { ascending: true })
    .order("position", { ascending: true });

  if (error) {
    return res.status(500).json({ error: "获取队列失败" });
  }

  const queues = {
    q0: tasks?.filter((t) => t.queue_level === 0) ?? [],
    q1: tasks?.filter((t) => t.queue_level === 1) ?? [],
    q2: tasks?.filter((t) => t.queue_level === 2) ?? [],
  };

  res.json({ success: true, data: queues });
});

router.put(
  "/tasks/reorder",
  requireAuth,
  validate({ body: reorderTasksSchema }),
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      return res
        .status(500)
        .json({ error: "Database connection not available" });
    }

    const { queue_level, task_ids } = req.body;

    const updates = task_ids.map((taskId: string, index: number) => ({
      id: taskId,
      position: index,
      queue_level,
    }));

    for (const update of updates) {
      await supabase
        .from("scheduled_tasks")
        .update({ position: update.position, queue_level: update.queue_level })
        .eq("id", update.id)
        .eq("user_id", req.user.id);
    }

    res.json({ success: true });
  }
);

router.put(
  "/tasks/:id/move",
  requireAuth,
  validate({ params: uuidParamsSchema, body: moveTaskSchema }),
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      return res
        .status(500)
        .json({ error: "Database connection not available" });
    }

    const { id } = req.params;
    const { target_queue } = req.body;

    const { count } = await supabase
      .from("scheduled_tasks")
      .select("*", { count: "exact", head: true })
      .eq("user_id", req.user.id)
      .eq("queue_level", target_queue)
      .is("deleted_at", null);

    const { data: task, error } = await supabase
      .from("scheduled_tasks")
      .update({
        queue_level: target_queue,
        position: count ?? 0,
      })
      .eq("id", id)
      .eq("user_id", req.user.id)
      .is("deleted_at", null)
      .select()
      .single();

    if (error || !task) {
      return res.status(404).json({ error: "任务不存在或移动失败" });
    }

    res.json({ success: true, data: task });
  }
);

router.get(
  "/executions",
  requireAuth,
  validate({ query: getExecutionsQuerySchema }),
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      return res
        .status(500)
        .json({ error: "Database connection not available" });
    }

    const { task_id, limit, offset } = req.query as unknown as z.infer<
      typeof getExecutionsQuerySchema
    >;

    let query = supabase
      .from("task_executions")
      .select("*, scheduled_tasks(title, queue_level)", { count: "exact" })
      .eq("user_id", req.user.id)
      .order("started_at", { ascending: false });

    if (task_id) {
      query = query.eq("task_id", task_id);
    }

    const {
      data: executions,
      error,
      count,
    } = await query.range(offset, offset + limit - 1);

    if (error) {
      return res.status(500).json({ error: "获取执行历史失败" });
    }

    res.json({ success: true, data: executions, total: count });
  }
);

router.get(
  "/executions/:id",
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

    const { data: execution, error } = await supabase
      .from("task_executions")
      .select("*, scheduled_tasks(title, description, queue_level)")
      .eq("id", id)
      .eq("user_id", req.user.id)
      .single();

    if (error || !execution) {
      return res.status(404).json({ error: "执行记录不存在" });
    }

    res.json({ success: true, data: execution });
  }
);

router.get(
  "/settings",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      return res
        .status(500)
        .json({ error: "Database connection not available" });
    }

    const { data: settings, error } = await supabase
      .from("task_settings")
      .select("*")
      .eq("user_id", req.user.id)
      .maybeSingle();

    if (error) {
      return res.status(500).json({ error: "获取设置失败" });
    }

    if (!settings) {
      const { data: newSettings, error: createError } = await supabase
        .from("task_settings")
        .insert({ user_id: req.user.id })
        .select()
        .single();

      if (createError) {
        return res.status(500).json({ error: "创建设置失败" });
      }

      return res.json({ success: true, data: newSettings });
    }

    res.json({ success: true, data: settings });
  }
);

router.put(
  "/settings",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      return res
        .status(500)
        .json({ error: "Database connection not available" });
    }

    const allowedFields = [
      "q0_time_slice",
      "q1_time_slice",
      "q2_time_slice",
      "break_duration",
      "sound_enabled",
      "notification_enabled",
    ];
    const updateData: Record<string, unknown> = {};

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: "没有有效的更新字段" });
    }

    const { data: settings, error } = await supabase
      .from("task_settings")
      .update(updateData)
      .eq("user_id", req.user.id)
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: "更新设置失败" });
    }

    res.json({ success: true, data: settings });
  }
);

router.get(
  "/stats",
  requireAuth,
  validate({ query: getStatsQuerySchema }),
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      return res
        .status(500)
        .json({ error: "Database connection not available" });
    }

    const { period } = req.query as z.infer<typeof getStatsQuerySchema>;

    const now = new Date();
    let startDate: Date;

    switch (period) {
      case "day":
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case "week":
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "month":
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
    }

    const { data: completedTasks, error: tasksError } = await supabase
      .from("scheduled_tasks")
      .select("id, actual_duration, queue_level, completed_at")
      .eq("user_id", req.user.id)
      .eq("status", "completed")
      .gte("completed_at", startDate.toISOString());

    if (tasksError) {
      return res.status(500).json({ error: "获取统计失败" });
    }

    const { data: executions, error: execError } = await supabase
      .from("task_executions")
      .select("duration, status")
      .eq("user_id", req.user.id)
      .gte("started_at", startDate.toISOString());

    if (execError) {
      return res.status(500).json({ error: "获取执行统计失败" });
    }

    const totalTasks = completedTasks?.length ?? 0;
    const totalDuration =
      executions?.reduce((sum, e) => sum + (e.duration ?? 0), 0) ?? 0;

    const queueStats = {
      q0: completedTasks?.filter((t) => t.queue_level === 0).length ?? 0,
      q1: completedTasks?.filter((t) => t.queue_level === 1).length ?? 0,
      q2: completedTasks?.filter((t) => t.queue_level === 2).length ?? 0,
    };

    res.json({
      success: true,
      data: {
        total_tasks: totalTasks,
        total_duration: totalDuration,
        queue_stats: queueStats,
        period,
        start_date: startDate.toISOString(),
        end_date: now.toISOString(),
      },
    });
  }
);

router.get(
  "/heatmap",
  requireAuth,
  validate({ query: getHeatmapQuerySchema }),
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      return res
        .status(500)
        .json({ error: "Database connection not available" });
    }

    const { year, month } = req.query as z.infer<typeof getHeatmapQuerySchema>;

    const targetYear = year ?? new Date().getFullYear();
    const startDate = month
      ? new Date(targetYear, month - 1, 1)
      : new Date(targetYear, 0, 1);
    const endDate = month
      ? new Date(targetYear, month, 0)
      : new Date(targetYear, 11, 31);

    const { data: executions, error } = await supabase
      .from("task_executions")
      .select("started_at, duration")
      .eq("user_id", req.user.id)
      .gte("started_at", startDate.toISOString())
      .lte("started_at", endDate.toISOString());

    if (error) {
      return res.status(500).json({ error: "获取热力图数据失败" });
    }

    const heatmapData: Record<
      string,
      { count: number; total_duration: number }
    > = {};

    for (const exec of executions ?? []) {
      const date = new Date(exec.started_at).toISOString().split("T")[0];
      if (!heatmapData[date]) {
        heatmapData[date] = { count: 0, total_duration: 0 };
      }
      heatmapData[date].count++;
      heatmapData[date].total_duration += exec.duration ?? 0;
    }

    const result = Object.entries(heatmapData).map(([date, data]) => ({
      date,
      count: data.count,
      total_duration: data.total_duration,
    }));

    res.json({ success: true, data: result });
  }
);

router.post(
  "/generate-details",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      const { title, context } = req.body;

      if (!title || typeof title !== "string") {
        return res.status(400).json({ error: "请提供任务标题" });
      }

      const result = await aiService.generateTaskDetails(title, {
        context,
        userId: req.user.id,
      });

      res.json({ success: true, data: result });
    } catch (error) {
      const err = error as Error;
      res.status(500).json({ error: err.message || "AI 生成任务详情失败" });
    }
  }
);

import { taskRecommendationService } from "../services/taskRecommendationService.js";
import { schedulerService } from "../services/schedulerService.js";

const createFocusSessionSchema = z.object({
  task_id: z.string().uuid().optional(),
  started_at: z.string().datetime(),
  ended_at: z.string().datetime().optional(),
  duration: z.number().int().min(0).optional(),
  pomodoro_count: z.number().int().min(0).optional(),
  white_noise_type: z.string().optional(),
  is_break: z.boolean().optional(),
});

const getFocusSessionsQuerySchema = z.object({
  from_date: z.string().datetime().optional(),
  to_date: z.string().datetime().optional(),
  task_id: z.string().uuid().optional(),
  is_break: z.coerce.boolean().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
});

const getMonthlyStatsQuerySchema = z.object({
  year: z.coerce.number().int().optional(),
  month: z.coerce.number().int().min(1).max(12).optional(),
});

router.post(
  "/focus-sessions",
  requireAuth,
  validate({ body: createFocusSessionSchema }),
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      return res.status(500).json({ error: "Database connection not available" });
    }

    try {
      const session = await schedulerService.createFocusSession(supabase, req.user.id, req.body);
      res.status(201).json({ success: true, data: session });
    } catch (error) {
      const err = error as Error;
      logger.error("Create focus session error:", err);
      res.status(500).json({ error: err.message || "创建专注会话失败" });
    }
  }
);

router.put(
  "/focus-sessions/:id",
  requireAuth,
  validate({ params: uuidParamsSchema }),
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      return res.status(500).json({ error: "Database connection not available" });
    }

    const { id } = req.params;
    const updates = req.body;

    try {
      const session = await schedulerService.updateFocusSession(supabase, id, req.user.id, updates);
      res.json({ success: true, data: session });
    } catch (error) {
      const err = error as Error;
      res.status(500).json({ error: err.message || "更新专注会话失败" });
    }
  }
);

router.get(
  "/focus-sessions",
  requireAuth,
  validate({ query: getFocusSessionsQuerySchema }),
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      return res.status(500).json({ error: "Database connection not available" });
    }

    const { from_date, to_date, task_id, is_break, limit } = req.query as unknown as z.infer<typeof getFocusSessionsQuerySchema>;

    try {
      const sessions = await schedulerService.getFocusSessions(supabase, req.user.id, {
        from_date,
        to_date,
        task_id,
        is_break,
        limit,
      });
      res.json({ success: true, data: sessions });
    } catch (error) {
      const err = error as Error;
      res.status(500).json({ error: err.message || "获取专注会话失败" });
    }
  }
);

router.get("/focus-stats", requireAuth, async (req: AuthRequest, res: Response) => {
  const supabase = req.supabase;
  if (!supabase) {
    return res.status(500).json({ error: "Database connection not available" });
  }

  try {
    const stats = await schedulerService.getUserFocusStats(supabase, req.user.id);
    res.json({ success: true, data: stats });
  } catch (error) {
    const err = error as Error;
    res.status(500).json({ error: err.message || "获取专注统计失败" });
  }
});

router.get(
  "/focus-stats/daily",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      return res.status(500).json({ error: "Database connection not available" });
    }

    const { date } = req.query;

    try {
      const stats = await schedulerService.getDailyFocusStats(supabase, req.user.id, date as string);
      res.json({ success: true, data: stats });
    } catch (error) {
      const err = error as Error;
      res.status(500).json({ error: err.message || "获取每日统计失败" });
    }
  }
);

router.get(
  "/focus-stats/weekly",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      return res.status(500).json({ error: "Database connection not available" });
    }

    const { week_start } = req.query;

    try {
      const stats = await schedulerService.getWeeklyFocusStats(supabase, req.user.id, week_start as string);
      res.json({ success: true, data: stats });
    } catch (error) {
      const err = error as Error;
      res.status(500).json({ error: err.message || "获取周统计失败" });
    }
  }
);

router.get(
  "/focus-stats/monthly",
  requireAuth,
  validate({ query: getMonthlyStatsQuerySchema }),
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      return res.status(500).json({ error: "Database connection not available" });
    }

    const { year, month } = req.query as z.infer<typeof getMonthlyStatsQuerySchema>;

    try {
      const stats = await schedulerService.getMonthlyFocusStats(supabase, req.user.id, year, month);
      res.json({ success: true, data: stats });
    } catch (error) {
      const err = error as Error;
      res.status(500).json({ error: err.message || "获取月统计失败" });
    }
  }
);

router.get(
  "/focus-stats/heatmap",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      return res.status(500).json({ error: "Database connection not available" });
    }

    const year = req.query.year ? parseInt(req.query.year as string) : undefined;

    try {
      const data = await schedulerService.getYearlyHeatmap(supabase, req.user.id, year);
      res.json({ success: true, data });
    } catch (error) {
      const err = error as Error;
      res.status(500).json({ error: err.message || "获取热力图数据失败" });
    }
  }
);

router.get("/achievements", requireAuth, async (req: AuthRequest, res: Response) => {
  const supabase = req.supabase;
  if (!supabase) {
    return res.status(500).json({ error: "Database connection not available" });
  }

  try {
    const achievements = await schedulerService.getAllAchievements(supabase);
    res.json({ success: true, data: achievements });
  } catch (error) {
    const err = error as Error;
    res.status(500).json({ error: err.message || "获取成就列表失败" });
  }
});

router.get("/achievements/user", requireAuth, async (req: AuthRequest, res: Response) => {
  const supabase = req.supabase;
  if (!supabase) {
    return res.status(500).json({ error: "Database connection not available" });
  }

  try {
    const achievements = await schedulerService.getUserAchievements(supabase, req.user.id);
    res.json({ success: true, data: achievements });
  } catch (error) {
    const err = error as Error;
    res.status(500).json({ error: err.message || "获取用户成就失败" });
  }
});

router.post("/achievements/check", requireAuth, async (req: AuthRequest, res: Response) => {
  const supabase = req.supabase;
  if (!supabase) {
    return res.status(500).json({ error: "Database connection not available" });
  }

  try {
    const result = await schedulerService.checkAndUnlockAchievements(supabase, req.user.id);
    res.json({ success: true, data: result });
  } catch (error) {
    const err = error as Error;
    res.status(500).json({ error: err.message || "检查成就失败" });
  }
});

router.get(
  "/recommendations",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      return res
        .status(500)
        .json({ error: "Database connection not available" });
    }

    try {
      const recommendations = await taskRecommendationService.getTaskRecommendations(
        supabase,
        req.user.id,
        { currentTime: new Date() }
      );

      res.json({ success: true, data: recommendations });
    } catch (error) {
      const err = error as Error;
      console.error("Get recommendations error:", err);
      res.status(500).json({ error: err.message || "获取任务推荐失败" });
    }
  }
);

router.get(
  "/smart-suggestions",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      return res
        .status(500)
        .json({ error: "Database connection not available" });
    }

    try {
      const suggestions = await taskRecommendationService.getSmartSuggestions(
        supabase,
        req.user.id,
        { currentTime: new Date() }
      );

      res.json({ success: true, data: suggestions });
    } catch (error) {
      const err = error as Error;
      console.error("Get smart suggestions error:", err);
      res.status(500).json({ error: err.message || "获取智能建议失败" });
    }
  }
);

router.post(
  "/analyze-priority",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      const { title, description } = req.body;

      if (!title || typeof title !== "string") {
        return res.status(400).json({ error: "请提供任务标题" });
      }

      const result = taskRecommendationService.analyzePriorityFromText(
        title,
        description
      );

      res.json({ success: true, data: result });
    } catch (error) {
      const err = error as Error;
      res.status(500).json({ error: err.message || "分析优先级失败" });
    }
  }
);

router.get(
  "/efficiency-data",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      return res
        .status(500)
        .json({ error: "Database connection not available" });
    }

    const days = req.query.days ? Number(req.query.days) : 30;

    try {
      const efficiencyData = await taskRecommendationService.calculateEfficiencyData(
        supabase,
        req.user.id,
        days
      );

      res.json({ success: true, data: efficiencyData });
    } catch (error) {
      const err = error as Error;
      console.error("Get efficiency data error:", err);
      res.status(500).json({ error: err.message || "获取效率数据失败" });
    }
  }
);

const createTemplateSchema = z.object({
  name: z.string().min(1, "模板名称不能为空").max(50, "模板名称不能超过50个字符"),
  description: z.string().max(200, "描述不能超过200个字符").optional(),
  category: z.enum(["study", "work", "life", "health", "custom"]).optional(),
  title_template: z.string().min(1, "标题模板不能为空").max(100, "标题模板不能超过100个字符"),
  description_template: z.string().max(500, "描述模板不能超过500个字符").optional(),
  estimated_duration: z.number().int().min(1).max(480).optional(),
  tags: z.array(z.string()).max(5, "最多5个标签").optional(),
  priority: z.number().int().min(1).max(4).optional(),
  is_default: z.boolean().optional(),
});

const updateTemplateSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  description: z.string().max(200).optional(),
  category: z.enum(["study", "work", "life", "health", "custom"]).optional(),
  title_template: z.string().min(1).max(100).optional(),
  description_template: z.string().max(500).optional(),
  estimated_duration: z.number().int().min(1).max(480).optional(),
  tags: z.array(z.string()).max(5).optional(),
  priority: z.number().int().min(1).max(4).optional(),
  is_default: z.boolean().optional(),
});

const getTemplatesQuerySchema = z.object({
  category: z.enum(["study", "work", "life", "health", "custom"]).optional(),
  search: z.string().max(50).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

const applyTemplateSchema = z.object({
  placeholders: z.record(z.string()).optional(),
  queue_level: z.number().int().min(0).max(2).optional(),
  knowledge_point_id: z.string().uuid().optional(),
  deadline: z.string().datetime().optional(),
});

router.get(
  "/templates",
  requireAuth,
  validate({ query: getTemplatesQuerySchema }),
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      return res.status(500).json({ error: "Database connection not available" });
    }

    const { category, search, limit, offset } = req.query as unknown as z.infer<typeof getTemplatesQuerySchema>;

    let query = supabase
      .from("task_templates")
      .select("*", { count: "exact" })
      .or(`user_id.eq.${req.user.id},is_system.eq.true`)
      .order("is_system", { ascending: true })
      .order("category", { ascending: true })
      .order("name", { ascending: true })
      .range(offset, offset + limit - 1);

    if (category) {
      query = query.eq("category", category);
    }
    if (search) {
      query = query.or(`name.ilike.%${search}%,title_template.ilike.%${search}%`);
    }

    const { data: templates, error, count } = await query;

    if (error) {
      console.error("Get templates error:", error);
      return res.status(500).json({ error: "获取模板列表失败" });
    }

    res.json({ success: true, data: templates, total: count });
  }
);

router.get(
  "/templates/categories",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      return res.status(500).json({ error: "Database connection not available" });
    }

    const { data: templates, error } = await supabase
      .from("task_templates")
      .select("category")
      .or(`user_id.eq.${req.user.id},is_system.eq.true`);

    if (error) {
      return res.status(500).json({ error: "获取分类失败" });
    }

    const categories = [
      { value: "study", label: "学习", icon: "📚", color: "blue" },
      { value: "work", label: "工作", icon: "💼", color: "purple" },
      { value: "life", label: "生活", icon: "🏠", color: "green" },
      { value: "health", label: "健康", icon: "💪", color: "red" },
      { value: "custom", label: "自定义", icon: "⭐", color: "amber" },
    ];

    const categoryCounts: Record<string, number> = {};
    for (const t of templates || []) {
      categoryCounts[t.category] = (categoryCounts[t.category] || 0) + 1;
    }

    const result = categories.map((cat) => ({
      ...cat,
      count: categoryCounts[cat.value] || 0,
    }));

    res.json({ success: true, data: result });
  }
);

router.get(
  "/templates/:id",
  requireAuth,
  validate({ params: uuidParamsSchema }),
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      return res.status(500).json({ error: "Database connection not available" });
    }

    const { id } = req.params;

    const { data: template, error } = await supabase
      .from("task_templates")
      .select("*")
      .eq("id", id)
      .or(`user_id.eq.${req.user.id},is_system.eq.true`)
      .single();

    if (error || !template) {
      return res.status(404).json({ error: "模板不存在" });
    }

    res.json({ success: true, data: template });
  }
);

router.post(
  "/templates",
  requireAuth,
  validate({ body: createTemplateSchema }),
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      return res.status(500).json({ error: "Database connection not available" });
    }

    const {
      name,
      description,
      category,
      title_template,
      description_template,
      estimated_duration,
      tags,
      priority,
      is_default,
    } = req.body;

    const { data: template, error } = await supabase
      .from("task_templates")
      .insert({
        user_id: req.user.id,
        name,
        description,
        category: category ?? "custom",
        title_template,
        description_template,
        estimated_duration: estimated_duration ?? 25,
        tags: tags ?? [],
        priority: priority ?? 2,
        is_default: is_default ?? false,
        is_system: false,
      })
      .select()
      .single();

    if (error) {
      logger.error("Create template error:", error);
      return res.status(500).json({ error: "创建模板失败" });
    }

    res.status(201).json({ success: true, data: template });
  }
);

router.put(
  "/templates/:id",
  requireAuth,
  validate({ params: uuidParamsSchema, body: updateTemplateSchema }),
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      return res.status(500).json({ error: "Database connection not available" });
    }

    const { id } = req.params;
    const updateData = req.body;

    const { data: template, error } = await supabase
      .from("task_templates")
      .update({
        ...updateData,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("user_id", req.user.id)
      .eq("is_system", false)
      .select()
      .single();

    if (error || !template) {
      return res.status(404).json({ error: "模板不存在或无法更新" });
    }

    res.json({ success: true, data: template });
  }
);

router.delete(
  "/templates/:id",
  requireAuth,
  validate({ params: uuidParamsSchema }),
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      return res.status(500).json({ error: "Database connection not available" });
    }

    const { id } = req.params;

    const { error } = await supabase
      .from("task_templates")
      .delete()
      .eq("id", id)
      .eq("user_id", req.user.id)
      .eq("is_system", false);

    if (error) {
      return res.status(500).json({ error: "删除模板失败" });
    }

    res.json({ success: true });
  }
);

router.post(
  "/templates/:id/apply",
  requireAuth,
  validate({ params: uuidParamsSchema, body: applyTemplateSchema }),
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      return res.status(500).json({ error: "Database connection not available" });
    }

    const { id } = req.params;
    const { placeholders, queue_level, knowledge_point_id, deadline } = req.body;

    const { data: template, error: templateError } = await supabase
      .from("task_templates")
      .select("*")
      .eq("id", id)
      .or(`user_id.eq.${req.user.id},is_system.eq.true`)
      .single();

    if (templateError || !template) {
      return res.status(404).json({ error: "模板不存在" });
    }

    let title = template.title_template;
    let description = template.description_template;

    if (placeholders) {
      for (const [key, value] of Object.entries(placeholders)) {
        const placeholder = `{{${key}}}`;
        title = title.replace(new RegExp(placeholder, "g"), value as string);
        if (description) {
          description = description.replace(new RegExp(placeholder, "g"), value as string);
        }
      }
    }

    const unresolvedPlaceholders = title.match(/\{\{[^}]+\}\}/g);
    if (unresolvedPlaceholders) {
      for (const placeholder of unresolvedPlaceholders) {
        const key = placeholder.slice(2, -2);
        title = title.replace(placeholder, key);
        if (description) {
          description = description.replace(placeholder, key);
        }
      }
    }

    const { count } = await supabase
      .from("scheduled_tasks")
      .select("*", { count: "exact", head: true })
      .eq("user_id", req.user.id)
      .eq("queue_level", queue_level ?? 0)
      .is("deleted_at", null);

    const { data: task, error: taskError } = await supabase
      .from("scheduled_tasks")
      .insert({
        user_id: req.user.id,
        title,
        description,
        queue_level: queue_level ?? 0,
        position: count ?? 0,
        estimated_duration: template.estimated_duration,
        tags: template.tags,
        priority: template.priority,
        knowledge_point_id,
        deadline,
        status: "pending",
      })
      .select()
      .single();

    if (taskError) {
      console.error("Create task from template error:", taskError);
      return res.status(500).json({ error: "从模板创建任务失败" });
    }

    await supabase
      .from("task_templates")
      .update({ usage_count: template.usage_count + 1 })
      .eq("id", id);

    res.status(201).json({ success: true, data: task });
  }
);

router.post(
  "/templates/:id/duplicate",
  requireAuth,
  validate({ params: uuidParamsSchema }),
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      return res.status(500).json({ error: "Database connection not available" });
    }

    const { id } = req.params;
    const { name } = req.body;

    const { data: original, error: fetchError } = await supabase
      .from("task_templates")
      .select("*")
      .eq("id", id)
      .or(`user_id.eq.${req.user.id},is_system.eq.true`)
      .single();

    if (fetchError || !original) {
      return res.status(404).json({ error: "模板不存在" });
    }

    const { data: template, error } = await supabase
      .from("task_templates")
      .insert({
        user_id: req.user.id,
        name: name || `${original.name} (副本)`,
        description: original.description,
        category: original.category,
        title_template: original.title_template,
        description_template: original.description_template,
        estimated_duration: original.estimated_duration,
        tags: original.tags,
        priority: original.priority,
        is_default: false,
        is_system: false,
      })
      .select()
      .single();

    if (error) {
      logger.error("Duplicate template error:", error);
      return res.status(500).json({ error: "复制模板失败" });
    }

    res.status(201).json({ success: true, data: template });
  }
);

router.post(
  "/templates/:id/set-default",
  requireAuth,
  validate({ params: uuidParamsSchema }),
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      return res.status(500).json({ error: "Database connection not available" });
    }

    const { id } = req.params;

    const { data: template, error: fetchError } = await supabase
      .from("task_templates")
      .select("category")
      .eq("id", id)
      .eq("user_id", req.user.id)
      .single();

    if (fetchError || !template) {
      return res.status(404).json({ error: "模板不存在" });
    }

    await supabase
      .from("task_templates")
      .update({ is_default: false })
      .eq("user_id", req.user.id)
      .eq("category", template.category);

    const { data: updated, error } = await supabase
      .from("task_templates")
      .update({ is_default: true })
      .eq("id", id)
      .eq("user_id", req.user.id)
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: "设置默认模板失败" });
    }

    res.json({ success: true, data: updated });
  }
);

export default router;

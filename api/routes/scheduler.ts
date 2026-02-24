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

    const { status, queue_level, limit, offset } = req.query as z.infer<
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

    const { task_id, limit, offset } = req.query as z.infer<
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

export default router;

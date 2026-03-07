import { Router, type Response } from "express";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { z } from "zod";
import {
  createScheduledTaskSchema,
  updateScheduledTaskSchema,
  moveTaskSchema,
  reorderTasksSchema,
  createTimeSlotSchema,
  updateTimeSlotSchema,
  timeSlotParamsSchema,
  createProgressPlanSchema,
  updateProgressSchema,
  createTaskDependencySchema,
  taskDependencyParamsSchema,
  createTaskScheduleSchema,
  updateTaskScheduleSchema,
  taskScheduleParamsSchema,
} from "../schemas/index.js";
import { aiService } from "../services/ai/index.js";
import { taskRecommendationService } from "../services/taskRecommendationService.js";
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
      task_type,
      total_duration,
      progress_mode,
      context,
      parent_task_id,
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
        task_type: task_type ?? "one_time",
        total_duration,
        progress_mode: progress_mode ?? "average",
        progress_percentage: 0,
        context,
        parent_task_id,
      })
      .select()
      .single();

    if (error) {
      console.error("Create task error:", error);
      return res.status(500).json({ error: "创建任务失败" });
    }

    res.status(201).json({ success: true, data: task });
  },
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

    const { status, queue_level, limit, offset } =
      req.query as unknown as z.infer<typeof getTasksQuerySchema>;

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
  },
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
  },
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
  },
);

router.get(
  "/tasks/:id/detail",
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
      .select("*")
      .eq("id", id)
      .eq("user_id", req.user.id)
      .is("deleted_at", null)
      .single();

    if (taskError || !task) {
      return res.status(404).json({ error: "任务不存在" });
    }

    const { data: dependencies } = await supabase
      .from("task_dependencies")
      .select(
        "id, dependency_type, created_at, depends_on_task_id, scheduled_tasks!task_dependencies_depends_on_task_id_fkey(id, title, description, status, queue_level, priority)",
      )
      .eq("task_id", id)
      .eq("user_id", req.user.id);

    const formattedDependencies = (dependencies || []).map((dep) => ({
      id: dep.id,
      dependency_type: dep.dependency_type,
      created_at: dep.created_at,
      task: dep.scheduled_tasks,
    }));

    const { data: dependents } = await supabase
      .from("task_dependencies")
      .select(
        "id, dependency_type, created_at, task_id, scheduled_tasks!task_dependencies_task_id_fkey(id, title, description, status, queue_level, priority)",
      )
      .eq("depends_on_task_id", id)
      .eq("user_id", req.user.id);

    const formattedDependents = (dependents || []).map((dep) => ({
      id: dep.id,
      dependency_type: dep.dependency_type,
      created_at: dep.created_at,
      task: dep.scheduled_tasks,
    }));

    let progressPlans: unknown[] = [];
    if (task.task_type === "long_term" || task.progress_mode) {
      const { data: plans } = await supabase
        .from("task_progress_plans")
        .select("*")
        .eq("task_id", id)
        .order("plan_date", { ascending: true });

      progressPlans = plans || [];
    }

    const { data: executions } = await supabase
      .from("task_executions")
      .select("*")
      .eq("task_id", id)
      .eq("user_id", req.user.id)
      .order("started_at", { ascending: false })
      .limit(20);

    const { data: settings } = await supabase
      .from("task_settings")
      .select("*")
      .eq("user_id", req.user.id)
      .maybeSingle();

    let requiredTimeSlots: number | null = null;
    if (task.total_duration && settings) {
      requiredTimeSlots = calculateRequiredTimeSlots(
        task.total_duration,
        task.queue_level,
        settings,
      );
    }

    res.json({
      success: true,
      data: {
        ...task,
        dependencies: formattedDependencies,
        dependents: formattedDependents,
        progress_plans: progressPlans,
        executions: executions || [],
        required_time_slots: requiredTimeSlots,
      },
    });
  },
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
  },
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
  },
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
  },
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
  },
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
        (endedAt.getTime() - startedAt.getTime()) / 1000,
      );

      await supabase
        .from("task_executions")
        .update({
          ended_at: endedAt.toISOString(),
          duration,
          status: "completed",
        })
        .eq("id", execution.id);
    } else {
      const { data: lastExecution } = await supabase
        .from("task_executions")
        .select("*")
        .eq("task_id", id)
        .eq("user_id", req.user.id)
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (lastExecution) {
        await supabase
          .from("task_executions")
          .update({
            status: "completed",
          })
          .eq("id", lastExecution.id);
      } else {
        await supabase.from("task_executions").insert({
          task_id: id,
          user_id: req.user.id,
          started_at: new Date().toISOString(),
          ended_at: new Date().toISOString(),
          duration: 0,
          status: "completed",
        });
      }
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
  },
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
  },
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
  },
);

router.get(
  "/tasks/:id/executions",
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

    const { data: task } = await supabase
      .from("scheduled_tasks")
      .select("id")
      .eq("id", id)
      .eq("user_id", req.user.id)
      .is("deleted_at", null)
      .single();

    if (!task) {
      return res.status(404).json({ error: "任务不存在" });
    }

    const { data: executions, error } = await supabase
      .from("task_executions")
      .select("*")
      .eq("task_id", id)
      .order("started_at", { ascending: false });

    if (error) {
      return res.status(500).json({ error: "获取执行记录失败" });
    }

    res.json({ success: true, data: executions });
  },
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
  },
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
  },
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
  },
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
  },
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
  },
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
  },
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
  },
);

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
      return res
        .status(500)
        .json({ error: "Database connection not available" });
    }

    try {
      const session = await schedulerService.createFocusSession(
        supabase,
        req.user.id,
        req.body,
      );
      res.status(201).json({ success: true, data: session });
    } catch (error) {
      const err = error as Error;
      logger.error("Create focus session error:", err);
      res.status(500).json({ error: err.message || "创建专注会话失败" });
    }
  },
);

router.put(
  "/focus-sessions/:id",
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
    const updates = req.body;

    try {
      const session = await schedulerService.updateFocusSession(
        supabase,
        id,
        req.user.id,
        updates,
      );
      res.json({ success: true, data: session });
    } catch (error) {
      const err = error as Error;
      res.status(500).json({ error: err.message || "更新专注会话失败" });
    }
  },
);

router.get(
  "/focus-sessions",
  requireAuth,
  validate({ query: getFocusSessionsQuerySchema }),
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      return res
        .status(500)
        .json({ error: "Database connection not available" });
    }

    const { from_date, to_date, task_id, is_break, limit } =
      req.query as unknown as z.infer<typeof getFocusSessionsQuerySchema>;

    try {
      const sessions = await schedulerService.getFocusSessions(
        supabase,
        req.user.id,
        {
          from_date,
          to_date,
          task_id,
          is_break,
          limit,
        },
      );
      res.json({ success: true, data: sessions });
    } catch (error) {
      const err = error as Error;
      res.status(500).json({ error: err.message || "获取专注会话失败" });
    }
  },
);

router.get(
  "/focus-stats",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      return res
        .status(500)
        .json({ error: "Database connection not available" });
    }

    try {
      const stats = await schedulerService.getUserFocusStats(
        supabase,
        req.user.id,
      );
      res.json({ success: true, data: stats });
    } catch (error) {
      const err = error as Error;
      res.status(500).json({ error: err.message || "获取专注统计失败" });
    }
  },
);

router.get(
  "/focus-stats/daily",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      return res
        .status(500)
        .json({ error: "Database connection not available" });
    }

    const { date } = req.query;

    try {
      const stats = await schedulerService.getDailyFocusStats(
        supabase,
        req.user.id,
        date as string,
      );
      res.json({ success: true, data: stats });
    } catch (error) {
      const err = error as Error;
      res.status(500).json({ error: err.message || "获取每日统计失败" });
    }
  },
);

router.get(
  "/focus-stats/weekly",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      return res
        .status(500)
        .json({ error: "Database connection not available" });
    }

    const { week_start } = req.query;

    try {
      const stats = await schedulerService.getWeeklyFocusStats(
        supabase,
        req.user.id,
        week_start as string,
      );
      res.json({ success: true, data: stats });
    } catch (error) {
      const err = error as Error;
      res.status(500).json({ error: err.message || "获取周统计失败" });
    }
  },
);

router.get(
  "/focus-stats/monthly",
  requireAuth,
  validate({ query: getMonthlyStatsQuerySchema }),
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      return res
        .status(500)
        .json({ error: "Database connection not available" });
    }

    const { year, month } = req.query as z.infer<
      typeof getMonthlyStatsQuerySchema
    >;

    try {
      const stats = await schedulerService.getMonthlyFocusStats(
        supabase,
        req.user.id,
        year,
        month,
      );
      res.json({ success: true, data: stats });
    } catch (error) {
      const err = error as Error;
      res.status(500).json({ error: err.message || "获取月统计失败" });
    }
  },
);

router.get(
  "/focus-stats/heatmap",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      return res
        .status(500)
        .json({ error: "Database connection not available" });
    }

    const year = req.query.year
      ? parseInt(req.query.year as string)
      : undefined;

    try {
      const data = await schedulerService.getYearlyHeatmap(
        supabase,
        req.user.id,
        year,
      );
      res.json({ success: true, data });
    } catch (error) {
      const err = error as Error;
      res.status(500).json({ error: err.message || "获取热力图数据失败" });
    }
  },
);

router.get(
  "/achievements",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      return res
        .status(500)
        .json({ error: "Database connection not available" });
    }

    try {
      const achievements = await schedulerService.getAllAchievements(supabase);
      res.json({ success: true, data: achievements });
    } catch (error) {
      const err = error as Error;
      res.status(500).json({ error: err.message || "获取成就列表失败" });
    }
  },
);

router.get(
  "/achievements/user",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      return res
        .status(500)
        .json({ error: "Database connection not available" });
    }

    try {
      const achievements = await schedulerService.getUserAchievements(
        supabase,
        req.user.id,
      );
      res.json({ success: true, data: achievements });
    } catch (error) {
      const err = error as Error;
      res.status(500).json({ error: err.message || "获取用户成就失败" });
    }
  },
);

router.post(
  "/achievements/check",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      return res
        .status(500)
        .json({ error: "Database connection not available" });
    }

    try {
      const result = await schedulerService.checkAndUnlockAchievements(
        supabase,
        req.user.id,
      );
      res.json({ success: true, data: result });
    } catch (error) {
      const err = error as Error;
      res.status(500).json({ error: err.message || "检查成就失败" });
    }
  },
);

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
      const recommendations =
        await taskRecommendationService.getTaskRecommendations(
          supabase,
          req.user.id,
          { currentTime: new Date() },
        );

      res.json({ success: true, data: recommendations });
    } catch (error) {
      const err = error as Error;
      console.error("Get recommendations error:", err);
      res.status(500).json({ error: err.message || "获取任务推荐失败" });
    }
  },
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
        { currentTime: new Date() },
      );

      res.json({ success: true, data: suggestions });
    } catch (error) {
      const err = error as Error;
      console.error("Get smart suggestions error:", err);
      res.status(500).json({ error: err.message || "获取智能建议失败" });
    }
  },
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
        description,
      );

      res.json({ success: true, data: result });
    } catch (error) {
      const err = error as Error;
      res.status(500).json({ error: err.message || "分析优先级失败" });
    }
  },
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
      const efficiencyData =
        await taskRecommendationService.calculateEfficiencyData(
          supabase,
          req.user.id,
          days,
        );

      res.json({ success: true, data: efficiencyData });
    } catch (error) {
      const err = error as Error;
      console.error("Get efficiency data error:", err);
      res.status(500).json({ error: err.message || "获取效率数据失败" });
    }
  },
);

const createTemplateSchema = z.object({
  name: z
    .string()
    .min(1, "模板名称不能为空")
    .max(50, "模板名称不能超过50个字符"),
  description: z.string().max(200, "描述不能超过200个字符").optional(),
  category: z.enum(["study", "work", "life", "health", "custom"]).optional(),
  title_template: z
    .string()
    .min(1, "标题模板不能为空")
    .max(100, "标题模板不能超过100个字符"),
  description_template: z
    .string()
    .max(500, "描述模板不能超过500个字符")
    .optional(),
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
      return res
        .status(500)
        .json({ error: "Database connection not available" });
    }

    const { category, search, limit, offset } = req.query as unknown as z.infer<
      typeof getTemplatesQuerySchema
    >;

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
      query = query.or(
        `name.ilike.%${search}%,title_template.ilike.%${search}%`,
      );
    }

    const { data: templates, error, count } = await query;

    if (error) {
      console.error("Get templates error:", error);
      return res.status(500).json({ error: "获取模板列表失败" });
    }

    res.json({ success: true, data: templates, total: count });
  },
);

router.get(
  "/templates/categories",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      return res
        .status(500)
        .json({ error: "Database connection not available" });
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
  },
);

router.get(
  "/templates/:id",
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
  },
);

router.post(
  "/templates",
  requireAuth,
  validate({ body: createTemplateSchema }),
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      return res
        .status(500)
        .json({ error: "Database connection not available" });
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
  },
);

router.put(
  "/templates/:id",
  requireAuth,
  validate({ params: uuidParamsSchema, body: updateTemplateSchema }),
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      return res
        .status(500)
        .json({ error: "Database connection not available" });
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
  },
);

router.delete(
  "/templates/:id",
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
      .from("task_templates")
      .delete()
      .eq("id", id)
      .eq("user_id", req.user.id)
      .eq("is_system", false);

    if (error) {
      return res.status(500).json({ error: "删除模板失败" });
    }

    res.json({ success: true });
  },
);

router.post(
  "/templates/:id/apply",
  requireAuth,
  validate({ params: uuidParamsSchema, body: applyTemplateSchema }),
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      return res
        .status(500)
        .json({ error: "Database connection not available" });
    }

    const { id } = req.params;
    const { placeholders, queue_level, knowledge_point_id, deadline } =
      req.body;

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
          description = description.replace(
            new RegExp(placeholder, "g"),
            value as string,
          );
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
  },
);

router.post(
  "/templates/:id/duplicate",
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
  },
);

router.post(
  "/templates/:id/set-default",
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
  },
);

router.get(
  "/time-slots",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      return res
        .status(500)
        .json({ error: "Database connection not available" });
    }

    const { data: timeSlots, error } = await supabase
      .from("user_time_slots")
      .select("*")
      .eq("user_id", req.user.id)
      .order("day_of_week", { ascending: true, nullsFirst: true })
      .order("start_time", { ascending: true });

    if (error) {
      logger.error("Get time slots error:", error);
      return res.status(500).json({ error: "获取时间段设置失败" });
    }

    const weekViewData: Record<number, typeof timeSlots> = {
      0: [],
      1: [],
      2: [],
      3: [],
      4: [],
      5: [],
      6: [],
    };

    const globalSlots: typeof timeSlots = [];

    for (const slot of timeSlots ?? []) {
      if (slot.day_of_week === null) {
        globalSlots.push(slot);
      } else {
        weekViewData[slot.day_of_week].push(slot);
      }
    }

    res.json({
      success: true,
      data: {
        slots: timeSlots,
        weekView: weekViewData,
        globalSlots,
      },
    });
  },
);

router.post(
  "/time-slots",
  requireAuth,
  validate({ body: createTimeSlotSchema }),
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      return res
        .status(500)
        .json({ error: "Database connection not available" });
    }

    const { day_of_week, start_time, end_time, is_available, label } = req.body;

    const startTimeParts = start_time.split(":").map(Number);
    const endTimeParts = end_time.split(":").map(Number);
    const startMinutes = startTimeParts[0] * 60 + startTimeParts[1];
    const endMinutes = endTimeParts[0] * 60 + endTimeParts[1];

    if (endMinutes <= startMinutes) {
      return res.status(400).json({ error: "结束时间必须晚于开始时间" });
    }

    let existingSlots = await supabase
      .from("user_time_slots")
      .select("*")
      .eq("user_id", req.user.id);

    if (day_of_week !== null && day_of_week !== undefined) {
      existingSlots = await supabase
        .from("user_time_slots")
        .select("*")
        .eq("user_id", req.user.id)
        .eq("day_of_week", day_of_week);
    }

    if (existingSlots.data && existingSlots.data.length > 0) {
      for (const slot of existingSlots.data) {
        const existingStart = slot.start_time.split(":").map(Number);
        const existingEnd = slot.end_time.split(":").map(Number);
        const existingStartMinutes = existingStart[0] * 60 + existingStart[1];
        const existingEndMinutes = existingEnd[0] * 60 + existingEnd[1];

        const hasOverlap =
          startMinutes < existingEndMinutes &&
          endMinutes > existingStartMinutes;

        if (hasOverlap) {
          return res.status(400).json({
            error: "时间段与现有时间段冲突",
            conflictingSlot: slot,
          });
        }
      }
    }

    const { data: timeSlot, error } = await supabase
      .from("user_time_slots")
      .insert({
        user_id: req.user.id,
        day_of_week: day_of_week ?? null,
        start_time,
        end_time,
        is_available: is_available ?? true,
        label,
      })
      .select()
      .single();

    if (error) {
      logger.error("Create time slot error:", error);
      return res.status(500).json({ error: "创建时间段失败" });
    }

    res.status(201).json({ success: true, data: timeSlot });
  },
);

router.put(
  "/time-slots/:id",
  requireAuth,
  validate({ params: timeSlotParamsSchema, body: updateTimeSlotSchema }),
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      return res
        .status(500)
        .json({ error: "Database connection not available" });
    }

    const { id } = req.params;
    const { start_time, end_time, is_available, label } = req.body;

    const { data: existingSlot, error: fetchError } = await supabase
      .from("user_time_slots")
      .select("*")
      .eq("id", id)
      .eq("user_id", req.user.id)
      .single();

    if (fetchError || !existingSlot) {
      return res.status(404).json({ error: "时间段不存在" });
    }

    const finalStartTime = start_time ?? existingSlot.start_time;
    const finalEndTime = end_time ?? existingSlot.end_time;

    const startTimeParts = finalStartTime.split(":").map(Number);
    const endTimeParts = finalEndTime.split(":").map(Number);
    const startMinutes = startTimeParts[0] * 60 + startTimeParts[1];
    const endMinutes = endTimeParts[0] * 60 + endTimeParts[1];

    if (endMinutes <= startMinutes) {
      return res.status(400).json({ error: "结束时间必须晚于开始时间" });
    }

    if (start_time || end_time) {
      const { data: otherSlots } = await supabase
        .from("user_time_slots")
        .select("*")
        .eq("user_id", req.user.id)
        .neq("id", id);

      const slotsToCheck =
        existingSlot.day_of_week !== null
          ? otherSlots?.filter(
              (s) => s.day_of_week === existingSlot.day_of_week,
            )
          : otherSlots?.filter((s) => s.day_of_week === null);

      for (const slot of slotsToCheck ?? []) {
        const existingStart = slot.start_time.split(":").map(Number);
        const existingEnd = slot.end_time.split(":").map(Number);
        const existingStartMinutes = existingStart[0] * 60 + existingStart[1];
        const existingEndMinutes = existingEnd[0] * 60 + existingEnd[1];

        const hasOverlap =
          startMinutes < existingEndMinutes &&
          endMinutes > existingStartMinutes;

        if (hasOverlap) {
          return res.status(400).json({
            error: "时间段与现有时间段冲突",
            conflictingSlot: slot,
          });
        }
      }
    }

    const updateData: Record<string, unknown> = {};
    if (start_time !== undefined) updateData.start_time = start_time;
    if (end_time !== undefined) updateData.end_time = end_time;
    if (is_available !== undefined) updateData.is_available = is_available;
    if (label !== undefined) updateData.label = label;

    const { data: timeSlot, error } = await supabase
      .from("user_time_slots")
      .update(updateData)
      .eq("id", id)
      .eq("user_id", req.user.id)
      .select()
      .single();

    if (error) {
      logger.error("Update time slot error:", error);
      return res.status(500).json({ error: "更新时间段失败" });
    }

    res.json({ success: true, data: timeSlot });
  },
);

router.delete(
  "/time-slots/:id",
  requireAuth,
  validate({ params: timeSlotParamsSchema }),
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      return res
        .status(500)
        .json({ error: "Database connection not available" });
    }

    const { id } = req.params;

    const { error } = await supabase
      .from("user_time_slots")
      .delete()
      .eq("id", id)
      .eq("user_id", req.user.id);

    if (error) {
      logger.error("Delete time slot error:", error);
      return res.status(500).json({ error: "删除时间段失败" });
    }

    res.json({ success: true });
  },
);

interface TaskSettings {
  q0_time_slice: number;
  q1_time_slice: number;
  q2_time_slice: number;
  break_duration: number;
  sound_enabled: boolean;
  notification_enabled: boolean;
}

function calculateRequiredTimeSlots(
  totalDurationMinutes: number,
  queueLevel: number,
  taskSettings: TaskSettings,
): number {
  const timeSlice =
    queueLevel === 0
      ? taskSettings.q0_time_slice
      : queueLevel === 1
        ? taskSettings.q1_time_slice
        : taskSettings.q2_time_slice;

  return Math.ceil(totalDurationMinutes / timeSlice);
}

async function checkCircularDependency(
  supabase: any,
  taskId: string,
  dependsOnTaskId: string,
  userId: string,
): Promise<boolean> {
  const visited = new Set<string>();
  const queue: string[] = [dependsOnTaskId];

  while (queue.length > 0) {
    const currentTaskId = queue.shift()!;

    if (currentTaskId === taskId) {
      return true;
    }

    if (visited.has(currentTaskId)) {
      continue;
    }
    visited.add(currentTaskId);

    const { data: dependencies } = await supabase
      .from("task_dependencies")
      .select("depends_on_task_id")
      .eq("task_id", currentTaskId)
      .eq("user_id", userId);

    for (const dep of dependencies || []) {
      if (!visited.has(dep.depends_on_task_id)) {
        queue.push(dep.depends_on_task_id);
      }
    }
  }

  return false;
}

router.post(
  "/tasks/:id/dependencies",
  requireAuth,
  validate({ params: uuidParamsSchema, body: createTaskDependencySchema }),
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      return res
        .status(500)
        .json({ error: "Database connection not available" });
    }

    const { id } = req.params;
    const { depends_on_task_id, dependency_type } = req.body;

    if (id === depends_on_task_id) {
      return res.status(400).json({ error: "任务不能依赖自身" });
    }

    const { data: tasks, error: tasksError } = await supabase
      .from("scheduled_tasks")
      .select("id")
      .in("id", [id, depends_on_task_id])
      .eq("user_id", req.user.id)
      .is("deleted_at", null);

    if (tasksError) {
      return res.status(500).json({ error: "查询任务失败" });
    }

    if (!tasks || tasks.length !== 2) {
      return res.status(404).json({ error: "一个或多个任务不存在" });
    }

    const { data: existingDep } = await supabase
      .from("task_dependencies")
      .select("id")
      .eq("task_id", id)
      .eq("depends_on_task_id", depends_on_task_id)
      .eq("user_id", req.user.id)
      .maybeSingle();

    if (existingDep) {
      return res.status(400).json({ error: "该依赖关系已存在" });
    }

    const hasCircular = await checkCircularDependency(
      supabase,
      id,
      depends_on_task_id,
      req.user.id,
    );

    if (hasCircular) {
      return res.status(400).json({ error: "添加此依赖会形成循环依赖" });
    }

    const { data: dependency, error } = await supabase
      .from("task_dependencies")
      .insert({
        task_id: id,
        depends_on_task_id,
        dependency_type: dependency_type ?? "strict",
        user_id: req.user.id,
      })
      .select()
      .single();

    if (error) {
      console.error("Create dependency error:", error);
      return res.status(500).json({ error: "创建依赖关系失败" });
    }

    res.status(201).json({ success: true, data: dependency });
  },
);

router.delete(
  "/tasks/:id/dependencies/:dependencyId",
  requireAuth,
  validate({ params: taskDependencyParamsSchema }),
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      return res
        .status(500)
        .json({ error: "Database connection not available" });
    }

    const { id, dependencyId } = req.params;

    const { error } = await supabase
      .from("task_dependencies")
      .delete()
      .eq("id", dependencyId)
      .eq("task_id", id)
      .eq("user_id", req.user.id);

    if (error) {
      return res.status(500).json({ error: "删除依赖关系失败" });
    }

    res.json({ success: true });
  },
);

router.get(
  "/tasks/:id/dependencies",
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

    const { data: task } = await supabase
      .from("scheduled_tasks")
      .select("id")
      .eq("id", id)
      .eq("user_id", req.user.id)
      .is("deleted_at", null)
      .maybeSingle();

    if (!task) {
      return res.status(404).json({ error: "任务不存在" });
    }

    const { data: dependencies, error } = await supabase
      .from("task_dependencies")
      .select(
        "id, dependency_type, created_at, depends_on_task_id, scheduled_tasks!task_dependencies_depends_on_task_id_fkey(id, title, description, status, queue_level, priority)",
      )
      .eq("task_id", id)
      .eq("user_id", req.user.id);

    if (error) {
      console.error("Get dependencies error:", error);
      return res.status(500).json({ error: "获取依赖列表失败" });
    }

    const formattedDeps = (dependencies || []).map((dep) => ({
      id: dep.id,
      dependency_type: dep.dependency_type,
      created_at: dep.created_at,
      task: dep.scheduled_tasks,
    }));

    res.json({ success: true, data: formattedDeps });
  },
);

router.get(
  "/tasks/:id/dependents",
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

    const { data: task } = await supabase
      .from("scheduled_tasks")
      .select("id")
      .eq("id", id)
      .eq("user_id", req.user.id)
      .is("deleted_at", null)
      .maybeSingle();

    if (!task) {
      return res.status(404).json({ error: "任务不存在" });
    }

    const { data: dependents, error } = await supabase
      .from("task_dependencies")
      .select(
        "id, dependency_type, created_at, task_id, scheduled_tasks!task_dependencies_task_id_fkey(id, title, description, status, queue_level, priority)",
      )
      .eq("depends_on_task_id", id)
      .eq("user_id", req.user.id);

    if (error) {
      console.error("Get dependents error:", error);
      return res.status(500).json({ error: "获取后置任务列表失败" });
    }

    const formattedDeps = (dependents || []).map((dep) => ({
      id: dep.id,
      dependency_type: dep.dependency_type,
      created_at: dep.created_at,
      task: dep.scheduled_tasks,
    }));

    res.json({ success: true, data: formattedDeps });
  },
);

function calculateDaysBetween(startDate: Date, endDate: Date): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  const diffTime = Math.abs(end.getTime() - start.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays + 1;
}

function generateAverageAllocations(
  days: number,
): Array<{ percentage: number }> {
  const basePercentage = 100 / days;
  const allocations: Array<{ percentage: number }> = [];
  let remaining = 100;

  for (let i = 0; i < days; i++) {
    if (i === days - 1) {
      allocations.push({ percentage: Math.round(remaining * 100) / 100 });
    } else {
      const percentage = Math.round(basePercentage * 100) / 100;
      allocations.push({ percentage });
      remaining -= percentage;
    }
  }

  return allocations;
}

function generateDecreasingAllocations(
  days: number,
): Array<{ percentage: number }> {
  const allocations: Array<{ percentage: number }> = [];
  const totalWeight = (days * (days + 1)) / 2;
  let remaining = 100;

  for (let i = 0; i < days; i++) {
    let percentage: number;
    if (i === days - 1) {
      percentage = Math.round(remaining * 100) / 100;
    } else {
      const weight = days - i;
      percentage = Math.round((weight / totalWeight) * 100 * 100) / 100;
      remaining -= percentage;
    }
    allocations.push({ percentage: Math.max(0, percentage) });
  }

  const total = allocations.reduce((sum, a) => sum + a.percentage, 0);
  if (Math.abs(total - 100) > 0.01 && allocations.length > 0) {
    allocations[allocations.length - 1].percentage =
      Math.round(
        (allocations[allocations.length - 1].percentage + (100 - total)) * 100,
      ) / 100;
  }

  return allocations;
}

function generateIncreasingAllocations(
  days: number,
): Array<{ percentage: number }> {
  const decreasing = generateDecreasingAllocations(days);
  return decreasing.reverse();
}

function generateProgressAllocations(
  startDate: Date,
  endDate: Date,
  mode: "average" | "decreasing" | "increasing" | "custom",
  customAllocations?: Array<{ date: string; percentage: number }>,
): Array<{ date: string; percentage: number }> {
  if (mode === "custom" && customAllocations && customAllocations.length > 0) {
    const total = customAllocations.reduce((sum, a) => sum + a.percentage, 0);
    if (Math.abs(total - 100) > 0.01) {
      throw new Error("自定义进度分配百分比总和必须等于100");
    }
    return customAllocations.sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );
  }

  const days = calculateDaysBetween(startDate, endDate);
  let allocations: Array<{ percentage: number }>;

  switch (mode) {
    case "average":
      allocations = generateAverageAllocations(days);
      break;
    case "decreasing":
      allocations = generateDecreasingAllocations(days);
      break;
    case "increasing":
      allocations = generateIncreasingAllocations(days);
      break;
    default:
      allocations = generateAverageAllocations(days);
  }

  const result: Array<{ date: string; percentage: number }> = [];
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);

  for (let i = 0; i < days; i++) {
    const date = new Date(start);
    date.setDate(date.getDate() + i);
    result.push({
      date: date.toISOString().split("T")[0],
      percentage: allocations[i].percentage,
    });
  }

  return result;
}

router.post(
  "/tasks/:id/progress-plan",
  requireAuth,
  validate({ params: uuidParamsSchema, body: createProgressPlanSchema }),
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      return res
        .status(500)
        .json({ error: "Database connection not available" });
    }

    const { id } = req.params;
    const { start_date, end_date, progress_mode, custom_allocations } =
      req.body;

    const { data: task, error: taskError } = await supabase
      .from("scheduled_tasks")
      .select("*")
      .eq("id", id)
      .eq("user_id", req.user.id)
      .is("deleted_at", null)
      .single();

    if (taskError || !task) {
      return res.status(404).json({ error: "任务不存在" });
    }

    try {
      const allocations = generateProgressAllocations(
        new Date(start_date),
        new Date(end_date),
        progress_mode,
        custom_allocations,
      );

      const { error: deleteError } = await supabase
        .from("task_progress_plans")
        .delete()
        .eq("task_id", id);

      if (deleteError) {
        logger.error("Delete existing progress plans error:", deleteError);
      }

      const plansToInsert = allocations.map((allocation) => ({
        task_id: id,
        user_id: req.user.id,
        plan_date: allocation.date,
        planned_percentage: allocation.percentage,
        actual_percentage: 0,
      }));

      const { data: plans, error: insertError } = await supabase
        .from("task_progress_plans")
        .insert(plansToInsert)
        .select();

      if (insertError) {
        logger.error("Insert progress plans error:", insertError);
        return res.status(500).json({ error: "创建进度计划失败" });
      }

      await supabase
        .from("scheduled_tasks")
        .update({
          progress_mode,
          progress_percentage: 0,
        })
        .eq("id", id);

      res.status(201).json({ success: true, data: plans });
    } catch (error) {
      const err = error as Error;
      logger.error("Generate progress allocations error:", err);
      res.status(400).json({ error: err.message || "生成进度计划失败" });
    }
  },
);

router.put(
  "/tasks/:id/progress-plan",
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
    const { plan_date, planned_percentage, notes } = req.body;

    if (!plan_date) {
      return res.status(400).json({ error: "请提供计划日期" });
    }

    const { data: task, error: taskError } = await supabase
      .from("scheduled_tasks")
      .select("id")
      .eq("id", id)
      .eq("user_id", req.user.id)
      .is("deleted_at", null)
      .single();

    if (taskError || !task) {
      return res.status(404).json({ error: "任务不存在" });
    }

    const updateData: Record<string, unknown> = {};
    if (planned_percentage !== undefined) {
      updateData.planned_percentage = planned_percentage;
    }
    if (notes !== undefined) {
      updateData.notes = notes;
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: "没有有效的更新字段" });
    }

    const { data: plan, error } = await supabase
      .from("task_progress_plans")
      .update(updateData)
      .eq("task_id", id)
      .eq("plan_date", plan_date)
      .select()
      .single();

    if (error || !plan) {
      return res.status(404).json({ error: "进度计划不存在或更新失败" });
    }

    res.json({ success: true, data: plan });
  },
);

router.get(
  "/tasks/:id/progress-plan",
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
      .select("id, title, progress_mode, progress_percentage")
      .eq("id", id)
      .eq("user_id", req.user.id)
      .is("deleted_at", null)
      .single();

    if (taskError || !task) {
      return res.status(404).json({ error: "任务不存在" });
    }

    const { data: plans, error } = await supabase
      .from("task_progress_plans")
      .select("*")
      .eq("task_id", id)
      .order("plan_date", { ascending: true });

    if (error) {
      logger.error("Get progress plans error:", error);
      return res.status(500).json({ error: "获取进度计划失败" });
    }

    res.json({
      success: true,
      data: {
        task,
        plans: plans || [],
      },
    });
  },
);

router.post(
  "/tasks/:id/progress",
  requireAuth,
  validate({ params: uuidParamsSchema, body: updateProgressSchema }),
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      return res
        .status(500)
        .json({ error: "Database connection not available" });
    }

    const { id } = req.params;
    const { date, percentage, notes } = req.body;

    const progressDate = date || new Date().toISOString().split("T")[0];

    const { data: task, error: taskError } = await supabase
      .from("scheduled_tasks")
      .select("*")
      .eq("id", id)
      .eq("user_id", req.user.id)
      .is("deleted_at", null)
      .single();

    if (taskError || !task) {
      return res.status(404).json({ error: "任务不存在" });
    }

    const { data: plan, error: planError } = await supabase
      .from("task_progress_plans")
      .select("*")
      .eq("task_id", id)
      .eq("plan_date", progressDate)
      .single();

    if (planError || !plan) {
      return res.status(404).json({ error: "该日期没有进度计划" });
    }

    const { error: updatePlanError } = await supabase
      .from("task_progress_plans")
      .update({
        actual_percentage: percentage,
        notes: notes || plan.notes,
      })
      .eq("id", plan.id);

    if (updatePlanError) {
      logger.error("Update progress plan error:", updatePlanError);
      return res.status(500).json({ error: "更新进度失败" });
    }

    const { data: allPlans, error: allPlansError } = await supabase
      .from("task_progress_plans")
      .select("actual_percentage, planned_percentage")
      .eq("task_id", id);

    if (allPlansError) {
      logger.error("Get all plans error:", allPlansError);
    }

    let totalProgress = 0;
    if (allPlans && allPlans.length > 0) {
      const totalActual = allPlans.reduce(
        (sum, p) => sum + (p.actual_percentage || 0),
        0,
      );
      totalProgress = Math.min(100, Math.round(totalActual));
    }

    const taskUpdateData: Record<string, unknown> = {
      progress_percentage: totalProgress,
    };

    if (totalProgress >= 100) {
      taskUpdateData.status = "completed";
      taskUpdateData.completed_at = new Date().toISOString();
    }

    const { data: updatedTask, error: updateTaskError } = await supabase
      .from("scheduled_tasks")
      .update(taskUpdateData)
      .eq("id", id)
      .select()
      .single();

    if (updateTaskError) {
      logger.error("Update task progress error:", updateTaskError);
      return res.status(500).json({ error: "更新任务进度失败" });
    }

    res.json({
      success: true,
      data: {
        task: updatedTask,
        daily_progress: {
          date: progressDate,
          percentage,
          notes,
        },
        total_progress: totalProgress,
      },
    });
  },
);

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

// =====================================================
// SUBTASKS API
// =====================================================

const createSubtaskSchema = z.object({
  body: z.object({
    title: z.string().min(1, "标题不能为空"),
    description: z.string().optional(),
    priority: z.number().int().min(0).optional(),
    estimated_duration: z.number().int().min(0).optional(),
    due_date: z.string().datetime().optional(),
  }),
  params: z.object({
    id: z.string().uuid("无效的任务ID"),
  }),
});

const updateSubtaskSchema = z.object({
  body: z.object({
    title: z.string().min(1, "标题不能为空").optional(),
    description: z.string().optional(),
    status: z.enum(["pending", "in_progress", "completed"]).optional(),
    priority: z.number().int().min(0).optional(),
    estimated_duration: z.number().int().min(0).optional(),
    actual_duration: z.number().int().min(0).optional(),
    due_date: z.string().datetime().optional().nullable(),
  }),
  params: z.object({
    id: z.string().uuid("无效的任务ID"),
    subtaskId: z.string().uuid("无效的子任务ID"),
  }),
});

const subtaskParamsSchema = z.object({
  id: z.string().uuid("无效的任务ID"),
  subtaskId: z.string().uuid("无效的子任务ID"),
});

router.post(
  "/tasks/:id/subtasks",
  requireAuth,
  validate(createSubtaskSchema),
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      return res
        .status(500)
        .json({ error: "Database connection not available" });
    }

    const { id } = req.params;
    const { title, description, priority, estimated_duration, due_date } =
      req.body;

    const { data: task } = await supabase
      .from("scheduled_tasks")
      .select("id")
      .eq("id", id)
      .eq("user_id", req.user.id)
      .is("deleted_at", null)
      .single();

    if (!task) {
      return res.status(404).json({ error: "任务不存在" });
    }

    const { count } = await supabase
      .from("task_subtasks")
      .select("*", { count: "exact", head: true })
      .eq("task_id", id);

    const { data: subtask, error } = await supabase
      .from("task_subtasks")
      .insert({
        task_id: id,
        title,
        description,
        priority: priority ?? 0,
        position: count ?? 0,
        estimated_duration,
        due_date,
        status: "pending",
      })
      .select()
      .single();

    if (error) {
      logger.error("Create subtask error:", error);
      return res.status(500).json({ error: "创建子任务失败" });
    }

    res.status(201).json({ success: true, data: subtask });
  },
);

router.get(
  "/tasks/:id/subtasks",
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

    const { data: task } = await supabase
      .from("scheduled_tasks")
      .select("id")
      .eq("id", id)
      .eq("user_id", req.user.id)
      .is("deleted_at", null)
      .single();

    if (!task) {
      return res.status(404).json({ error: "任务不存在" });
    }

    const { data: subtasks, error } = await supabase
      .from("task_subtasks")
      .select("*")
      .eq("task_id", id)
      .order("position", { ascending: true });

    if (error) {
      logger.error("Get subtasks error:", error);
      return res.status(500).json({ error: "获取子任务列表失败" });
    }

    res.json({ success: true, data: subtasks });
  },
);

router.put(
  "/tasks/:id/subtasks/:subtaskId",
  requireAuth,
  validate(updateSubtaskSchema),
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      return res
        .status(500)
        .json({ error: "Database connection not available" });
    }

    const { id, subtaskId } = req.params;
    const updates = req.body;

    const { data: task } = await supabase
      .from("scheduled_tasks")
      .select("id")
      .eq("id", id)
      .eq("user_id", req.user.id)
      .is("deleted_at", null)
      .single();

    if (!task) {
      return res.status(404).json({ error: "任务不存在" });
    }

    if (updates.status === "completed") {
      updates.completed_at = new Date().toISOString();
    }

    const { data: subtask, error } = await supabase
      .from("task_subtasks")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", subtaskId)
      .eq("task_id", id)
      .select()
      .single();

    if (error) {
      logger.error("Update subtask error:", error);
      return res.status(500).json({ error: "更新子任务失败" });
    }

    if (!subtask) {
      return res.status(404).json({ error: "子任务不存在" });
    }

    res.json({ success: true, data: subtask });
  },
);

router.delete(
  "/tasks/:id/subtasks/:subtaskId",
  requireAuth,
  validate({ params: subtaskParamsSchema }),
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      return res
        .status(500)
        .json({ error: "Database connection not available" });
    }

    const { id, subtaskId } = req.params;

    const { error } = await supabase
      .from("task_subtasks")
      .delete()
      .eq("id", subtaskId)
      .eq("task_id", id);

    if (error) {
      logger.error("Delete subtask error:", error);
      return res.status(500).json({ error: "删除子任务失败" });
    }

    res.json({ success: true });
  },
);

// =====================================================
// TASK LINKS API
// =====================================================

const createLinkSchema = z.object({
  body: z.object({
    link_type: z.enum(["web", "file", "api"]).default("web"),
    title: z.string().optional(),
    url: z.string().min(1, "链接地址不能为空"),
    description: z.string().optional(),
    icon: z.string().optional(),
    metadata: z.record(z.any()).optional(),
  }),
  params: z.object({
    id: z.string().uuid("无效的任务ID"),
  }),
});

const updateLinkSchema = z.object({
  body: z.object({
    title: z.string().optional(),
    description: z.string().optional(),
    icon: z.string().optional(),
    metadata: z.record(z.any()).optional(),
  }),
  params: z.object({
    id: z.string().uuid("无效的任务ID"),
    linkId: z.string().uuid("无效的链接ID"),
  }),
});

const linkParamsSchema = z.object({
  id: z.string().uuid("无效的任务ID"),
  linkId: z.string().uuid("无效的链接ID"),
});

router.post(
  "/tasks/:id/links",
  requireAuth,
  validate(createLinkSchema),
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      return res
        .status(500)
        .json({ error: "Database connection not available" });
    }

    const { id } = req.params;
    const { link_type, title, url, description, icon, metadata } = req.body;

    const { data: task } = await supabase
      .from("scheduled_tasks")
      .select("id")
      .eq("id", id)
      .eq("user_id", req.user.id)
      .is("deleted_at", null)
      .single();

    if (!task) {
      return res.status(404).json({ error: "任务不存在" });
    }

    const { count } = await supabase
      .from("task_links")
      .select("*", { count: "exact", head: true })
      .eq("task_id", id);

    const { data: link, error } = await supabase
      .from("task_links")
      .insert({
        task_id: id,
        link_type,
        title: title || url,
        url,
        description,
        icon,
        metadata: metadata || {},
        position: count ?? 0,
      })
      .select()
      .single();

    if (error) {
      logger.error("Create link error:", error);
      return res.status(500).json({ error: "创建链接失败" });
    }

    res.status(201).json({ success: true, data: link });
  },
);

router.get(
  "/tasks/:id/links",
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

    const { data: task } = await supabase
      .from("scheduled_tasks")
      .select("id")
      .eq("id", id)
      .eq("user_id", req.user.id)
      .is("deleted_at", null)
      .single();

    if (!task) {
      return res.status(404).json({ error: "任务不存在" });
    }

    const { data: links, error } = await supabase
      .from("task_links")
      .select("*")
      .eq("task_id", id)
      .order("position", { ascending: true });

    if (error) {
      logger.error("Get links error:", error);
      return res.status(500).json({ error: "获取链接列表失败" });
    }

    res.json({ success: true, data: links });
  },
);

router.put(
  "/tasks/:id/links/:linkId",
  requireAuth,
  validate(updateLinkSchema),
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      return res
        .status(500)
        .json({ error: "Database connection not available" });
    }

    const { id, linkId } = req.params;
    const updates = req.body;

    const { data: task } = await supabase
      .from("scheduled_tasks")
      .select("id")
      .eq("id", id)
      .eq("user_id", req.user.id)
      .is("deleted_at", null)
      .single();

    if (!task) {
      return res.status(404).json({ error: "任务不存在" });
    }

    const { data: link, error } = await supabase
      .from("task_links")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", linkId)
      .eq("task_id", id)
      .select()
      .single();

    if (error) {
      logger.error("Update link error:", error);
      return res.status(500).json({ error: "更新链接失败" });
    }

    if (!link) {
      return res.status(404).json({ error: "链接不存在" });
    }

    res.json({ success: true, data: link });
  },
);

router.delete(
  "/tasks/:id/links/:linkId",
  requireAuth,
  validate({ params: linkParamsSchema }),
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      return res
        .status(500)
        .json({ error: "Database connection not available" });
    }

    const { id, linkId } = req.params;

    const { error } = await supabase
      .from("task_links")
      .delete()
      .eq("id", linkId)
      .eq("task_id", id);

    if (error) {
      logger.error("Delete link error:", error);
      return res.status(500).json({ error: "删除链接失败" });
    }

    res.json({ success: true });
  },
);

// =====================================================
// TASK KNOWLEDGE POINTS API
// =====================================================

const createTaskKPSchema = z.object({
  body: z.object({
    knowledge_point_id: z.string().uuid("无效的知识点ID"),
    relevance_score: z.number().int().min(0).max(100).optional(),
    is_primary: z.boolean().optional(),
    notes: z.string().optional(),
  }),
  params: z.object({
    id: z.string().uuid("无效的任务ID"),
  }),
});

const updateTaskKPSchema = z.object({
  body: z.object({
    relevance_score: z.number().int().min(0).max(100).optional(),
    is_primary: z.boolean().optional(),
    notes: z.string().optional(),
  }),
  params: z.object({
    id: z.string().uuid("无效的任务ID"),
    kpId: z.string().uuid("无效的知识点关联ID"),
  }),
});

const taskKPParamsSchema = z.object({
  id: z.string().uuid("无效的任务ID"),
  kpId: z.string().uuid("无效的知识点关联ID"),
});

router.post(
  "/tasks/:id/knowledge-points",
  requireAuth,
  validate(createTaskKPSchema),
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      return res
        .status(500)
        .json({ error: "Database connection not available" });
    }

    const { id } = req.params;
    const { knowledge_point_id, relevance_score, is_primary, notes } = req.body;

    const { data: task } = await supabase
      .from("scheduled_tasks")
      .select("id")
      .eq("id", id)
      .eq("user_id", req.user.id)
      .is("deleted_at", null)
      .single();

    if (!task) {
      return res.status(404).json({ error: "任务不存在" });
    }

    const { data: kp } = await supabase
      .from("knowledge_points")
      .select("id, title, content")
      .eq("id", knowledge_point_id)
      .or(`visibility.eq.public,owner_id.eq.${req.user.id}`)
      .single();

    if (!kp) {
      return res.status(404).json({ error: "知识点不存在或无权访问" });
    }

    if (is_primary) {
      await supabase
        .from("task_knowledge_points")
        .update({ is_primary: false })
        .eq("task_id", id);
    }

    const { data: taskKP, error } = await supabase
      .from("task_knowledge_points")
      .insert({
        task_id: id,
        knowledge_point_id,
        relevance_score: relevance_score ?? 100,
        is_primary: is_primary ?? false,
        notes,
      })
      .select(
        `
        *,
        knowledge_point:knowledge_points(id, title, content, visibility)
      `,
      )
      .single();

    if (error) {
      logger.error("Create task KP error:", error);
      return res.status(500).json({ error: "关联知识点失败" });
    }

    res.status(201).json({ success: true, data: taskKP });
  },
);

router.get(
  "/tasks/:id/knowledge-points",
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

    const { data: task } = await supabase
      .from("scheduled_tasks")
      .select("id")
      .eq("id", id)
      .eq("user_id", req.user.id)
      .is("deleted_at", null)
      .single();

    if (!task) {
      return res.status(404).json({ error: "任务不存在" });
    }

    const { data: taskKPs, error } = await supabase
      .from("task_knowledge_points")
      .select(
        `
        *,
        knowledge_point:knowledge_points(id, title, content, visibility, owner_id)
      `,
      )
      .eq("task_id", id)
      .order("is_primary", { ascending: false })
      .order("created_at", { ascending: true });

    if (error) {
      logger.error("Get task KPs error:", error);
      return res.status(500).json({ error: "获取知识点关联失败" });
    }

    res.json({ success: true, data: taskKPs });
  },
);

router.put(
  "/tasks/:id/knowledge-points/:kpId",
  requireAuth,
  validate(updateTaskKPSchema),
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      return res
        .status(500)
        .json({ error: "Database connection not available" });
    }

    const { id, kpId } = req.params;
    const updates = req.body;

    const { data: task } = await supabase
      .from("scheduled_tasks")
      .select("id")
      .eq("id", id)
      .eq("user_id", req.user.id)
      .is("deleted_at", null)
      .single();

    if (!task) {
      return res.status(404).json({ error: "任务不存在" });
    }

    if (updates.is_primary) {
      await supabase
        .from("task_knowledge_points")
        .update({ is_primary: false })
        .eq("task_id", id);
    }

    const { data: taskKP, error } = await supabase
      .from("task_knowledge_points")
      .update(updates)
      .eq("id", kpId)
      .eq("task_id", id)
      .select(
        `
        *,
        knowledge_point:knowledge_points(id, title, content, visibility)
      `,
      )
      .single();

    if (error) {
      logger.error("Update task KP error:", error);
      return res.status(500).json({ error: "更新知识点关联失败" });
    }

    if (!taskKP) {
      return res.status(404).json({ error: "知识点关联不存在" });
    }

    res.json({ success: true, data: taskKP });
  },
);

router.delete(
  "/tasks/:id/knowledge-points/:kpId",
  requireAuth,
  validate({ params: taskKPParamsSchema }),
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      return res
        .status(500)
        .json({ error: "Database connection not available" });
    }

    const { id, kpId } = req.params;

    const { error } = await supabase
      .from("task_knowledge_points")
      .delete()
      .eq("id", kpId)
      .eq("task_id", id);

    if (error) {
      logger.error("Delete task KP error:", error);
      return res.status(500).json({ error: "取消知识点关联失败" });
    }

    res.json({ success: true });
  },
);

// =====================================================
// TASK NOTES API
// =====================================================

const updateNotesBodySchema = z.object({
  notes: z.string(),
});

router.put(
  "/tasks/:id/notes",
  requireAuth,
  validate({ params: uuidParamsSchema, body: updateNotesBodySchema }),
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      return res
        .status(500)
        .json({ error: "Database connection not available" });
    }

    const { id } = req.params;
    const { notes } = req.body;

    const { data: task, error } = await supabase
      .from("scheduled_tasks")
      .update({ notes, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", req.user.id)
      .is("deleted_at", null)
      .select()
      .single();

    if (error) {
      logger.error("Update notes error:", error);
      return res.status(500).json({ error: "更新笔记失败" });
    }

    if (!task) {
      return res.status(404).json({ error: "任务不存在" });
    }

    res.json({ success: true, data: task });
  },
);

// =====================================================
// SMART RECOMMENDATION API
// =====================================================

router.get(
  "/smart-recommendation",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      return res
        .status(500)
        .json({ error: "Database connection not available" });
    }

    try {
      const recommendation =
        await taskRecommendationService.getSmartRecommendation(
          supabase,
          req.user.id,
          { currentTime: new Date() },
        );

      res.json({ success: true, data: recommendation });
    } catch (error) {
      logger.error("Get smart recommendation error:", error);
      res.status(500).json({ error: "获取智能推荐失败" });
    }
  },
);

router.get(
  "/tasks/:id/dynamic-priority",
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

    const dynamicPriority =
      taskRecommendationService.calculateDynamicPriority(task);

    res.json({ success: true, data: dynamicPriority });
  },
);

router.get(
  "/tasks/:id/dependency-check",
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

    const depCheck = await taskRecommendationService.checkTaskDependencies(
      supabase,
      id,
      req.user.id,
    );

    res.json({ success: true, data: depCheck });
  },
);

import { taskAnalyticsService } from "../services/taskAnalyticsService.js";

router.get(
  "/analytics",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      return res
        .status(500)
        .json({ error: "Database connection not available" });
    }

    try {
      const analytics = await taskAnalyticsService.getAnalytics(
        supabase,
        req.user.id,
      );
      res.json({ success: true, data: analytics });
    } catch (error) {
      logger.error("Get task analytics error:", error);
      res.status(500).json({ error: "获取任务分析数据失败" });
    }
  },
);

router.post(
  "/analytics/insights",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      return res
        .status(500)
        .json({ error: "Database connection not available" });
    }

    try {
      const insights = await taskAnalyticsService.generateInsights(
        supabase,
        req.user.id,
      );
      res.json({ success: true, data: insights });
    } catch (error) {
      logger.error("Generate insights error:", error);
      res.status(500).json({ error: "生成洞察失败" });
    }
  },
);

export default router;

import { Router, type Response } from "express";
import { requireAuth, type AuthRequest } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { z } from "zod";
import {
  createScheduledTaskSchema,
  updateScheduledTaskSchema,
  moveTaskSchema,
  reorderTasksSchema,
} from "../../schemas/index";
import { logger } from "../../utils/logger";
import { taskStateMachine } from "../../services/scheduler/core/stateMachine";

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
      logger.error("Create task error:", error);
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
      logger.error("Get tasks error:", error);
      return res.status(500).json({ error: "获取任务列表失败" });
    }

    if (tasks && tasks.length > 0) {
      const taskIds = tasks.map((t) => t.id);
      const { data: subtaskStats } = await supabase
        .from("task_subtasks")
        .select("task_id, status")
        .in("task_id", taskIds);

      const subtaskCounts = new Map<
        string,
        { total: number; completed: number }
      >();
      if (subtaskStats) {
        for (const st of subtaskStats) {
          const existing = subtaskCounts.get(st.task_id) || {
            total: 0,
            completed: 0,
          };
          existing.total++;
          if (st.status === "completed") {
            existing.completed++;
          }
          subtaskCounts.set(st.task_id, existing);
        }
      }

      for (const task of tasks) {
        const stats = subtaskCounts.get(task.id);
        (task as any).subtask_count = stats?.total || 0;
        (task as any).subtask_completed = stats?.completed || 0;
        (task as any).has_subtasks = (stats?.total || 0) > 0;
      }
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
        "id, task_id, depends_on_task_id, dependency_type, created_at, depends_on_task:scheduled_tasks!task_dependencies_depends_on_task_id_fkey(id, title, description, status, queue_level, priority)",
      )
      .eq("task_id", id);

    const { data: dependents } = await supabase
      .from("task_dependencies")
      .select(
        "id, task_id, depends_on_task_id, dependency_type, created_at, task:scheduled_tasks!task_dependencies_task_id_fkey(id, title, description, status, queue_level, priority)",
      )
      .eq("depends_on_task_id", id);

    const { data: progressPlans } = await supabase
      .from("task_progress_plans")
      .select("*")
      .eq("task_id", id)
      .order("plan_date", { ascending: true });

    const { data: executions } = await supabase
      .from("task_executions")
      .select("*")
      .eq("task_id", id)
      .order("started_at", { ascending: false })
      .limit(20);

    const { data: subtasks } = await supabase
      .from("task_subtasks")
      .select("*")
      .eq("task_id", id)
      .order("position", { ascending: true });

    const requiredTimeSlots = task.estimated_duration
      ? Math.ceil(task.estimated_duration / 25)
      : undefined;

    const subtaskCount = subtasks?.length || 0;
    const subtaskCompleted = subtasks?.filter((s) => s.status === "completed").length || 0;

    const taskDetail = {
      ...task,
      dependencies: dependencies || [],
      dependents: dependents || [],
      progress_plans: progressPlans || [],
      executions: executions || [],
      subtasks: subtasks || [],
      required_time_slots: requiredTimeSlots,
      subtask_count: subtaskCount,
      subtask_completed: subtaskCompleted,
      has_subtasks: subtaskCount > 0,
    };

    res.json({ success: true, data: taskDetail });
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

    const { data: currentTask } = await supabase
      .from("scheduled_tasks")
      .select("status")
      .eq("id", id)
      .eq("user_id", req.user.id)
      .is("deleted_at", null)
      .single();

    if (!currentTask) {
      return res.status(404).json({ error: "任务不存在" });
    }

    const result = await taskStateMachine.transition(
      supabase,
      id,
      req.user.id,
      currentTask.status,
      "in_progress",
    );

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json({ success: true, data: { task: result.task, execution: result.execution } });
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

    const { data: currentTask } = await supabase
      .from("scheduled_tasks")
      .select("status")
      .eq("id", id)
      .eq("user_id", req.user.id)
      .is("deleted_at", null)
      .single();

    if (!currentTask) {
      return res.status(404).json({ error: "任务不存在" });
    }

    const result = await taskStateMachine.transition(
      supabase,
      id,
      req.user.id,
      currentTask.status,
      "paused",
    );

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json({ success: true, data: { task: result.task, duration: result.execution?.duration ?? 0 } });
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

    const { data: currentTask } = await supabase
      .from("scheduled_tasks")
      .select("status")
      .eq("id", id)
      .eq("user_id", req.user.id)
      .is("deleted_at", null)
      .single();

    if (!currentTask) {
      return res.status(404).json({ error: "任务不存在" });
    }

    const result = await taskStateMachine.transition(
      supabase,
      id,
      req.user.id,
      currentTask.status,
      "completed",
      { actual_duration: actual_duration ?? undefined },
    );

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json({ success: true, data: result.task });
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

  if (tasks && tasks.length > 0) {
    const taskIds = tasks.map((t) => t.id);
    const { data: subtaskStats } = await supabase
      .from("task_subtasks")
      .select("task_id, status")
      .in("task_id", taskIds);

    const subtaskCounts = new Map<
      string,
      { total: number; completed: number }
    >();
    if (subtaskStats) {
      for (const st of subtaskStats) {
        const existing = subtaskCounts.get(st.task_id) || {
          total: 0,
          completed: 0,
        };
        existing.total++;
        if (st.status === "completed") {
          existing.completed++;
        }
        subtaskCounts.set(st.task_id, existing);
      }
    }

    for (const task of tasks) {
      const stats = subtaskCounts.get(task.id);
      (task as any).subtask_count = stats?.total || 0;
      (task as any).subtask_completed = stats?.completed || 0;
      (task as any).has_subtasks = (stats?.total || 0) > 0;
    }
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

export default router;

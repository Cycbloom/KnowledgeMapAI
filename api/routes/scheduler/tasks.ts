import { Router, type Response } from "express";
import { requireAuth, type AuthRequest } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { z } from "zod";
import {
  createUserTaskSchema,
  updateUserTaskSchema,
  moveTaskSchema,
  reorderTasksSchema,
} from "../../schemas/index";
import { taskStateMachine } from "../../services/scheduler/core";
import { taskService } from "../../services/scheduler";
import { AppError } from "../../middleware/errorHandler";
import { ErrorCodes } from "../../../shared/types/errorCodes";

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
  validate(createUserTaskSchema),
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      throw new AppError("Database connection not available", 500, ErrorCodes.INTERNAL_ERROR);
    }

    const task = await taskService.createTaskFull(supabase, req.user.id, req.body);
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
      throw new AppError("Database connection not available", 500, ErrorCodes.INTERNAL_ERROR);
    }

    const { status, queue_level, limit, offset } =
      req.query as unknown as z.infer<typeof getTasksQuerySchema>;

    const { tasks: tasksData, total } = await taskService.listTasksWithStats(
      supabase, req.user.id, { status, queue_level, limit, offset }
    );
    res.json({ success: true, data: tasksData, total });
  },
);

router.put(
  "/tasks/reorder",
  requireAuth,
  validate({ body: reorderTasksSchema }),
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      throw new AppError("Database connection not available", 500, ErrorCodes.INTERNAL_ERROR);
    }

    const { queue_level, task_ids } = req.body;
    await taskService.reorderTasks(supabase, req.user.id, queue_level, task_ids);
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
      throw new AppError("Database connection not available", 500, ErrorCodes.INTERNAL_ERROR);
    }

    const { id } = req.params;

    const task = await taskService.getTask(supabase, id, req.user.id);
    if (!task) {
      throw new AppError("任务不存在", 404, ErrorCodes.NOT_FOUND);
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
      throw new AppError("Database connection not available", 500, ErrorCodes.INTERNAL_ERROR);
    }

    const { id } = req.params;

    const taskDetail = await taskService.getTaskDetail(supabase, req.user.id, id);
    if (!taskDetail) {
      throw new AppError("任务不存在", 404, ErrorCodes.NOT_FOUND);
    }
    res.json({ success: true, data: taskDetail });
  },
);

router.put(
  "/tasks/:id",
  requireAuth,
  validate({ params: uuidParamsSchema, body: updateUserTaskSchema }),
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      throw new AppError("Database connection not available", 500, ErrorCodes.INTERNAL_ERROR);
    }

    const { id } = req.params;
    const updateData = req.body;

    const task = await taskService.updateTask(supabase, id, req.user.id, updateData);
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
      throw new AppError("Database connection not available", 500, ErrorCodes.INTERNAL_ERROR);
    }

    const { id } = req.params;

    await taskService.deleteTask(supabase, id, req.user.id);
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
      throw new AppError("Database connection not available", 500, ErrorCodes.INTERNAL_ERROR);
    }

    const { id } = req.params;

    const currentStatus = await taskService.getTaskStatus(supabase, id, req.user.id);
    if (!currentStatus) {
      throw new AppError("任务不存在", 404, ErrorCodes.NOT_FOUND);
    }

    const result = await taskStateMachine.transition(
      supabase,
      id,
      req.user.id,
      currentStatus,
      "in_progress",
    );

    if (!result.success) {
      throw new AppError(result.error || "状态转换失败", 400, ErrorCodes.VALIDATION_ERROR);
    }

    res.json({
      success: true,
      data: { task: result.task, execution: result.execution },
    });
  },
);

router.post(
  "/tasks/:id/pause",
  requireAuth,
  validate({ params: uuidParamsSchema }),
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      throw new AppError("Database connection not available", 500, ErrorCodes.INTERNAL_ERROR);
    }

    const { id } = req.params;

    const currentStatus = await taskService.getTaskStatus(supabase, id, req.user.id);
    if (!currentStatus) {
      throw new AppError("任务不存在", 404, ErrorCodes.NOT_FOUND);
    }

    const result = await taskStateMachine.transition(
      supabase,
      id,
      req.user.id,
      currentStatus,
      "paused",
    );

    if (!result.success) {
      throw new AppError(result.error || "状态转换失败", 400, ErrorCodes.VALIDATION_ERROR);
    }

    res.json({
      success: true,
      data: { task: result.task, duration: result.execution?.duration ?? 0 },
    });
  },
);

router.post(
  "/tasks/:id/complete",
  requireAuth,
  validate({ params: uuidParamsSchema }),
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      throw new AppError("Database connection not available", 500, ErrorCodes.INTERNAL_ERROR);
    }

    const { id } = req.params;
    const { actual_duration } = req.body;

    const currentStatus = await taskService.getTaskStatus(supabase, id, req.user.id);
    if (!currentStatus) {
      throw new AppError("任务不存在", 404, ErrorCodes.NOT_FOUND);
    }

    const result = await taskStateMachine.transition(
      supabase,
      id,
      req.user.id,
      currentStatus,
      "completed",
      { actual_duration: actual_duration ?? undefined },
    );

    if (!result.success) {
      throw new AppError(result.error || "状态转换失败", 400, ErrorCodes.VALIDATION_ERROR);
    }

    res.json({ success: true, data: result.task });
  },
);

router.get("/queues", requireAuth, async (req: AuthRequest, res: Response) => {
  const supabase = req.supabase;
  if (!supabase) {
    throw new AppError("Database connection not available", 500, ErrorCodes.INTERNAL_ERROR);
  }

  const includeCompleted = req.query.include_completed === "true";
  const includeCancelled = req.query.include_cancelled === "true";

  const queues = await taskService.listQueuesWithStats(
    supabase, req.user.id, { includeCompleted, includeCancelled }
  );
  res.json({ success: true, data: queues });
});

router.put(
  "/tasks/:id/move",
  requireAuth,
  validate({ params: uuidParamsSchema, body: moveTaskSchema }),
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      throw new AppError("Database connection not available", 500, ErrorCodes.INTERNAL_ERROR);
    }

    const { id } = req.params;
    const { target_queue } = req.body;

    const task = await taskService.moveTaskToQueue(
      supabase, id, req.user.id, target_queue
    );
    res.json({ success: true, data: task });
  },
);

router.patch(
  "/tasks/:id/progress",
  requireAuth,
  validate({ params: uuidParamsSchema }),
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      throw new AppError("Database connection not available", 500, ErrorCodes.INTERNAL_ERROR);
    }

    const { id: taskId } = req.params;
    const { progress_percentage, actual_duration_add } = req.body;

    const task = await taskService.updateTaskProgress(
      supabase, req.user.id, taskId, { progress_percentage, actual_duration_add }
    );
    res.json({ success: true, data: task });
  },
);

router.patch(
  "/tasks/:id/execution/tick",
  requireAuth,
  validate({ params: uuidParamsSchema }),
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      throw new AppError("Database connection not available", 500, ErrorCodes.INTERNAL_ERROR);
    }

    const userId = req.user.id;
    const { id: taskId } = req.params;
    const { duration_seconds } = req.body;

    if (!duration_seconds || typeof duration_seconds !== "number" || duration_seconds <= 0) {
      throw new AppError("duration_seconds must be a positive number", 400, ErrorCodes.VALIDATION_ERROR);
    }

    const execution = await taskService.updateExecutionAfterTimeSlice(
      supabase,
      taskId,
      userId,
      duration_seconds,
    );

    res.json({ success: true, data: execution });
  },
);

export default router;

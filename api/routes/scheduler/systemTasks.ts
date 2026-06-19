import { Router, type Response } from "express";
import { requireAuth, type AuthRequest } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { z } from "zod";
import { systemTaskService } from "../../services/scheduler";
import type { SystemTaskStatus } from "../../../shared/types/scheduler";
import { AppError } from "../../middleware/errorHandler";
import { ErrorCodes } from "../../../shared/types/errorCodes";

const router = Router();

const getSystemTasksQuerySchema = z.object({
  status: z
    .enum(["pending", "in_progress", "completed", "failed", "cancelled"])
    .optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
});

const uuidParamsSchema = z.object({
  id: z.string().uuid("无效的任务ID"),
});

const createSystemTaskSchema = z.object({
  task_type: z.enum(["graph_expansion", "ai_generation", "knowledge_sync", "review_generation"]),
  title: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  priority: z.number().int().min(1).max(10).optional(),
  input_data: z.record(z.unknown()).optional(),
  max_retries: z.number().int().min(0).max(10).optional(),
  scheduled_at: z.string().datetime().optional(),
});

router.get(
  "/system-tasks",
  requireAuth,
  validate({ query: getSystemTasksQuerySchema }),
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      throw new AppError("Database connection not available", 500, ErrorCodes.INTERNAL_ERROR);
    }

    const { status, limit } = req.query as unknown as z.infer<typeof getSystemTasksQuerySchema>;

    const tasks = await systemTaskService.getTasks(supabase, req.user.id, {
      status: status as SystemTaskStatus | undefined,
      limit,
    });

    res.json({ success: true, data: tasks });
  },
);

router.post(
  "/system-tasks",
  requireAuth,
  validate({ body: createSystemTaskSchema }),
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      throw new AppError("Database connection not available", 500, ErrorCodes.INTERNAL_ERROR);
    }

    const task = await systemTaskService.createTask(supabase, req.user.id, req.body);

    res.status(201).json({ success: true, data: task });
  },
);

router.post(
  "/system-tasks/:id/retry",
  requireAuth,
  validate({ params: uuidParamsSchema }),
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      throw new AppError("Database connection not available", 500, ErrorCodes.INTERNAL_ERROR);
    }

    const { id } = req.params;

    await systemTaskService.retryTask(supabase, id);

    const task = await systemTaskService.getTaskById(supabase, id, req.user.id);

    res.json({ success: true, data: task });
  },
);

router.post(
  "/system-tasks/:id/cancel",
  requireAuth,
  validate({ params: uuidParamsSchema }),
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      throw new AppError("Database connection not available", 500, ErrorCodes.INTERNAL_ERROR);
    }

    const { id } = req.params;

    await systemTaskService.cancelTask(supabase, id);

    const task = await systemTaskService.getTaskById(supabase, id, req.user.id);

    res.json({ success: true, data: task });
  },
);

router.get(
  "/system-tasks/stats",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      throw new AppError("Database connection not available", 500, ErrorCodes.INTERNAL_ERROR);
    }

    const stats = await systemTaskService.getTaskStats(supabase, req.user.id);

    res.json({ success: true, data: stats });
  },
);

export default router;

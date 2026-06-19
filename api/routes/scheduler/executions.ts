import { Router, type Response } from "express";
import { requireAuth, type AuthRequest } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { z } from "zod";
import { taskExecutionService } from "../../services/scheduler";
import { AppError } from "../../middleware/errorHandler";
import { ErrorCodes } from "../../../shared/types/errorCodes";

const router = Router();

const uuidParamsSchema = z.object({
  id: z.string().uuid("无效的ID"),
});

const getExecutionsQuerySchema = z.object({
  task_id: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

router.get(
  "/tasks/:id/executions",
  requireAuth,
  validate({ params: uuidParamsSchema }),
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      throw new AppError("Database connection not available", 500, ErrorCodes.INTERNAL_ERROR);
    }

    const { id } = req.params;

    const executions = await taskExecutionService.listByTask(
      supabase,
      req.user.id,
      id,
    );

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
      throw new AppError("Database connection not available", 500, ErrorCodes.INTERNAL_ERROR);
    }

    const { task_id, limit, offset } = req.query as unknown as z.infer<
      typeof getExecutionsQuerySchema
    >;

    const result = await taskExecutionService.list(supabase, req.user.id, {
      task_id,
      limit,
      offset,
    });

    res.json({ success: true, data: result.data, total: result.total });
  },
);

router.get(
  "/executions/:id",
  requireAuth,
  validate({ params: uuidParamsSchema }),
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      throw new AppError("Database connection not available", 500, ErrorCodes.INTERNAL_ERROR);
    }

    const { id } = req.params;

    const execution = await taskExecutionService.get(
      supabase,
      req.user.id,
      id,
    );

    res.json({ success: true, data: execution });
  },
);

export default router;

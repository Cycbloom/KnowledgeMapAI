import { Router, type Response } from "express";
import { requireAuth, type AuthRequest } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { z } from "zod";
import {
  createProgressPlanSchema,
  updateProgressSchema,
} from "../../schemas/index";
import { progressPlanService } from "../../services/scheduler";
import { AppError } from "../../middleware/errorHandler";
import { ErrorCodes } from "../../../shared/types/errorCodes";

const router = Router();

const uuidParamsSchema = z.object({
  id: z.string().uuid("无效的任务ID"),
});

router.post(
  "/tasks/:id/progress-plan",
  requireAuth,
  validate({ params: uuidParamsSchema, body: createProgressPlanSchema }),
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      throw new AppError("Database connection not available", 500, ErrorCodes.INTERNAL_ERROR);
    }

    const { id } = req.params;
    const { start_date, end_date, progress_mode, custom_allocations } =
      req.body;

    try {
      const plans = await progressPlanService.createProgressPlan(
        supabase,
        req.user.id,
        id,
        { start_date, end_date, progress_mode, custom_allocations },
      );
      res.status(201).json({ success: true, data: plans });
    } catch (error) {
      const err = error as Error & { statusCode?: number };
      throw new AppError(err.message || "生成进度计划失败", err.statusCode || 400, ErrorCodes.INTERNAL_ERROR);
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
      throw new AppError("Database connection not available", 500, ErrorCodes.INTERNAL_ERROR);
    }

    const { id } = req.params;
    const { plan_date, planned_percentage, notes } = req.body;

    try {
      const plan = await progressPlanService.updateProgressPlan(
        supabase,
        req.user.id,
        id,
        { plan_date, planned_percentage, notes },
      );
      res.json({ success: true, data: plan });
    } catch (error) {
      const err = error as Error & { statusCode?: number };
      throw new AppError(err.message, err.statusCode || 500, ErrorCodes.INTERNAL_ERROR);
    }
  },
);

router.get(
  "/tasks/:id/progress-plan",
  requireAuth,
  validate({ params: uuidParamsSchema }),
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      throw new AppError("Database connection not available", 500, ErrorCodes.INTERNAL_ERROR);
    }

    const { id } = req.params;

    try {
      const result = await progressPlanService.listProgressPlans(
        supabase,
        req.user.id,
        id,
      );
      res.json({ success: true, data: result });
    } catch (error) {
      const err = error as Error & { statusCode?: number };
      throw new AppError(err.message, err.statusCode || 500, ErrorCodes.INTERNAL_ERROR);
    }
  },
);

router.post(
  "/tasks/:id/progress",
  requireAuth,
  validate({ params: uuidParamsSchema, body: updateProgressSchema }),
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      throw new AppError("Database connection not available", 500, ErrorCodes.INTERNAL_ERROR);
    }

    const { id } = req.params;
    const { date, percentage, notes } = req.body;

    try {
      const result = await progressPlanService.updateProgress(
        supabase,
        req.user.id,
        id,
        { date, percentage, notes },
      );
      res.json({ success: true, data: result });
    } catch (error) {
      const err = error as Error & { statusCode?: number };
      throw new AppError(err.message, err.statusCode || 500, ErrorCodes.INTERNAL_ERROR);
    }
  },
);

export default router;

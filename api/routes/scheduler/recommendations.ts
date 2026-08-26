import { Router, type Response } from "express";
import { requireAuth, type AuthRequest } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { z } from "zod";
import { aiService } from "../../services/ai";
import { taskRecommendationService } from "../../services/scheduler";
import { AppError } from "../../middleware/errorHandler";
import { ErrorCodes } from "../../../shared/types/errorCodes";

const router = Router();

const uuidParamsSchema = z.object({
  id: z.string().uuid("无效的任务ID"),
});

router.post(
  "/generate-details",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const { title, context } = req.body;

    if (!title || typeof title !== "string") {
      throw new AppError("请提供任务标题", 400, ErrorCodes.VALIDATION_ERROR);
    }

    const result = await aiService.generateTaskDetails(title, {
      context,
      userId: req.user.id,
    });

    res.json({ success: true, data: result });
  },
);

router.get(
  "/recommendations",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      throw new AppError("Database connection not available", 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }

    const recommendations =
      await taskRecommendationService.getTaskRecommendations(
        supabase,
        req.user.id,
        { currentTime: new Date() },
      );

    res.json({ success: true, data: recommendations });
  },
);

router.get(
  "/smart-suggestions",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      throw new AppError("Database connection not available", 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }

    const suggestions = await taskRecommendationService.getSmartSuggestions(
      supabase,
      req.user.id,
      { currentTime: new Date() },
    );

    res.json({ success: true, data: suggestions });
  },
);

router.post(
  "/analyze-priority",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const { title, description } = req.body;

    if (!title || typeof title !== "string") {
      throw new AppError("请提供任务标题", 400, ErrorCodes.VALIDATION_ERROR);
    }

    const result = taskRecommendationService.analyzePriorityFromText(
      title,
      description,
    );

    res.json({ success: true, data: result });
  },
);

router.get(
  "/efficiency-data",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      throw new AppError("Database connection not available", 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }

    const days = req.query.days ? Number(req.query.days) : 30;

    const efficiencyData =
      await taskRecommendationService.calculateEfficiencyData(
        supabase,
        req.user.id,
        days,
      );

    res.json({ success: true, data: efficiencyData });
  },
);

router.get(
  "/smart-recommendation",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      throw new AppError("Database connection not available", 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }

    const recommendation =
      await taskRecommendationService.getSmartRecommendation(
        supabase,
        req.user.id,
        { currentTime: new Date() },
      );

    res.json({ success: true, data: recommendation });
  },
);

router.get(
  "/tasks/:id/dynamic-priority",
  requireAuth,
  validate({ params: uuidParamsSchema }),
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      throw new AppError("Database connection not available", 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }

    const { id } = req.params;

    const task = await taskRecommendationService.getTaskById(
      supabase,
      id,
      req.user.id,
    );

    if (!task) {
      throw new AppError("任务不存在", 404, ErrorCodes.RESOURCE_NOT_FOUND);
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
      throw new AppError("Database connection not available", 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
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

export default router;

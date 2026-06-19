import { Router, type Response } from "express";
import { requireAuth, type AuthRequest } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { z } from "zod";
import { aiService } from "../../services/ai";
import { taskRecommendationService } from "../../services/scheduler";
import { logger } from "../../utils/logger";
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
    try {
      const { title, context } = req.body;

      if (!title || typeof title !== "string") {
        throw new AppError("请提供任务标题", 400, ErrorCodes.VALIDATION_ERROR);
      }

      const result = await aiService.generateTaskDetails(title, {
        context,
        userId: req.user.id,
      });

      res.json({ success: true, data: result });
    } catch (error) {
      const err = error as Error;
      throw new AppError(err.message || "AI 生成任务详情失败", 500, ErrorCodes.INTERNAL_ERROR);
    }
  },
);

router.get(
  "/recommendations",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      throw new AppError("Database connection not available", 500, ErrorCodes.INTERNAL_ERROR);
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
      logger.error("Get recommendations error:", err);
      throw new AppError(err.message || "获取任务推荐失败", 500, ErrorCodes.INTERNAL_ERROR);
    }
  },
);

router.get(
  "/smart-suggestions",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      throw new AppError("Database connection not available", 500, ErrorCodes.INTERNAL_ERROR);
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
      logger.error("Get smart suggestions error:", err);
      throw new AppError(err.message || "获取智能建议失败", 500, ErrorCodes.INTERNAL_ERROR);
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
        throw new AppError("请提供任务标题", 400, ErrorCodes.VALIDATION_ERROR);
      }

      const result = taskRecommendationService.analyzePriorityFromText(
        title,
        description,
      );

      res.json({ success: true, data: result });
    } catch (error) {
      const err = error as Error;
      throw new AppError(err.message || "分析优先级失败", 500, ErrorCodes.INTERNAL_ERROR);
    }
  },
);

router.get(
  "/efficiency-data",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      throw new AppError("Database connection not available", 500, ErrorCodes.INTERNAL_ERROR);
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
      logger.error("Get efficiency data error:", err);
      throw new AppError(err.message || "获取效率数据失败", 500, ErrorCodes.INTERNAL_ERROR);
    }
  },
);

router.get(
  "/smart-recommendation",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      throw new AppError("Database connection not available", 500, ErrorCodes.INTERNAL_ERROR);
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
      throw new AppError("获取智能推荐失败", 500, ErrorCodes.INTERNAL_ERROR);
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
      throw new AppError("Database connection not available", 500, ErrorCodes.INTERNAL_ERROR);
    }

    const { id } = req.params;

    const task = await taskRecommendationService.getTaskById(
      supabase,
      id,
      req.user.id,
    );

    if (!task) {
      throw new AppError("任务不存在", 404, ErrorCodes.NOT_FOUND);
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
      throw new AppError("Database connection not available", 500, ErrorCodes.INTERNAL_ERROR);
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

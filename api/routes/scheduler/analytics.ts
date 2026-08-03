import { Router, type Response } from "express";
import { requireAuth, type AuthRequest } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { z } from "zod";
import { taskStatService, taskAnalyticsService } from "../../services/scheduler";
import { AppError } from "../../middleware/errorHandler";
import { ErrorCodes } from "../../../shared/types/errorCodes";

const router = Router();

const getStatsQuerySchema = z.object({
  period: z.enum(["day", "week", "month"]).optional().default("week"),
});

const getHeatmapQuerySchema = z.object({
  year: z.coerce.number().int().optional(),
  month: z.coerce.number().int().min(1).max(12).optional(),
});

router.get(
  "/stats",
  requireAuth,
  validate({ query: getStatsQuerySchema }),
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      throw new AppError("Database connection not available", 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }

    const { period } = req.query as z.infer<typeof getStatsQuerySchema>;

    const data = await taskStatService.getStats(
      supabase,
      req.user.id,
      period,
    );

    res.json({ success: true, data });
  },
);

router.get(
  "/heatmap",
  requireAuth,
  validate({ query: getHeatmapQuerySchema }),
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      throw new AppError("Database connection not available", 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }

    const { year, month } = req.query as z.infer<typeof getHeatmapQuerySchema>;

    const data = await taskStatService.getHeatmap(
      supabase,
      req.user.id,
      year,
      month,
    );

    res.json({ success: true, data });
  },
);

router.get(
  "/analytics",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      throw new AppError("Database connection not available", 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }

    try {
      const analytics = await taskAnalyticsService.getAnalytics(
        supabase,
        req.user.id,
      );
      res.json({ success: true, data: analytics });
    } catch (_error) {
      throw new AppError("获取任务分析数据失败", 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }
  },
);

router.post(
  "/analytics/insights",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      throw new AppError("Database connection not available", 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }

    try {
      const insights = await taskAnalyticsService.generateInsights(
        supabase,
        req.user.id,
      );
      res.json({ success: true, data: insights });
    } catch (_error) {
      throw new AppError("生成洞察失败", 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }
  },
);

export default router;

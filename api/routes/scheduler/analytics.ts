import { Router, type Response } from "express";
import { requireAuth, type AuthRequest } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { z } from "zod";
import { logger } from "../../utils/logger.js";
import { taskAnalyticsService } from "../../services/taskAnalyticsService.js";

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

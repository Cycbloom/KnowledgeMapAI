import { Router, type Response } from "express";
import { requireAuth, type AuthRequest } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { z } from "zod";
import { aiService } from "../../services/ai/index.js";
import { taskRecommendationService } from "../../services/taskRecommendationService.js";
import { logger } from "../../utils/logger.js";

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

export default router;

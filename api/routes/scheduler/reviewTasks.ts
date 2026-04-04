import { Router, type Response } from "express";
import { requireAuth, type AuthRequest } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { z } from "zod";
import { reviewTaskService } from "../../services/scheduler";
import { logger } from "../../utils/logger";

const router = Router();

const createReviewTaskSchema = z.object({
  knowledge_point_id: z.string().uuid("无效的知识点ID"),
  task_id: z.string().uuid("无效的任务ID"),
});

const updateReviewTaskSchema = z.object({
  quality: z.number().int().min(0).max(5, "质量分数必须在 0-5 之间"),
});

const knowledgePointParamsSchema = z.object({
  knowledgePointId: z.string().uuid("无效的知识点ID"),
});

const pendingQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

router.post(
  "/",
  requireAuth,
  validate({ body: createReviewTaskSchema }),
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      return res
        .status(500)
        .json({ error: "Database connection not available" });
    }

    const { knowledge_point_id, task_id } = req.body;

    try {
      const reviewTask = await reviewTaskService.createFirstReviewTask(
        supabase,
        req.user.id,
        { knowledge_point_id, task_id },
      );

      res.status(201).json({ success: true, data: reviewTask });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "创建复习任务失败";
      logger.error("Create review task error:", error);
      res.status(400).json({ error: errorMessage });
    }
  },
);

router.put(
  "/:knowledgePointId",
  requireAuth,
  validate({
    params: knowledgePointParamsSchema,
    body: updateReviewTaskSchema,
  }),
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      return res
        .status(500)
        .json({ error: "Database connection not available" });
    }

    const { knowledgePointId } = req.params;
    const { quality } = req.body;

    try {
      const updatedTask = await reviewTaskService.updateReviewTask(
        supabase,
        req.user.id,
        knowledgePointId,
        { quality },
      );

      res.json({ success: true, data: updatedTask });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "更新复习任务失败";
      logger.error("Update review task error:", error);
      res.status(400).json({ error: errorMessage });
    }
  },
);

router.get(
  "/pending",
  requireAuth,
  validate({ query: pendingQuerySchema }),
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      return res
        .status(500)
        .json({ error: "Database connection not available" });
    }

    const { limit } = req.query as unknown as z.infer<
      typeof pendingQuerySchema
    >;

    try {
      const pendingTasks = await reviewTaskService.getPendingReviewTasks(
        supabase,
        req.user.id,
        limit,
      );

      res.json({ success: true, data: pendingTasks });
    } catch (error) {
      logger.error("Get pending review tasks error:", error);
      res.status(500).json({ error: "获取待复习任务失败" });
    }
  },
);

router.get(
  "/stats",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      return res
        .status(500)
        .json({ error: "Database connection not available" });
    }

    try {
      const stats = await reviewTaskService.getReviewTaskStats(
        supabase,
        req.user.id,
      );

      res.json({ success: true, data: stats });
    } catch (error) {
      logger.error("Get review task stats error:", error);
      res.status(500).json({ error: "获取复习任务统计失败" });
    }
  },
);

router.get(
  "/:knowledgePointId",
  requireAuth,
  validate({ params: knowledgePointParamsSchema }),
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      return res
        .status(500)
        .json({ error: "Database connection not available" });
    }

    const { knowledgePointId } = req.params;

    try {
      const reviewTask = await reviewTaskService.getReviewTaskByKnowledgePoint(
        supabase,
        req.user.id,
        knowledgePointId,
      );

      if (!reviewTask) {
        return res.status(404).json({ error: "复习任务不存在" });
      }

      res.json({ success: true, data: reviewTask });
    } catch (error) {
      logger.error("Get review task error:", error);
      res.status(500).json({ error: "获取复习任务失败" });
    }
  },
);

router.delete(
  "/:knowledgePointId",
  requireAuth,
  validate({ params: knowledgePointParamsSchema }),
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      return res
        .status(500)
        .json({ error: "Database connection not available" });
    }

    const { knowledgePointId } = req.params;

    try {
      await reviewTaskService.deleteReviewTask(
        supabase,
        req.user.id,
        knowledgePointId,
      );

      res.json({ success: true });
    } catch (error) {
      logger.error("Delete review task error:", error);
      res.status(500).json({ error: "删除复习任务失败" });
    }
  },
);

export default router;

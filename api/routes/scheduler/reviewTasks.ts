import { Router, type Response } from "express";
import { requireAuth, type AuthRequest } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { z } from "zod";
import { reviewTaskService } from "../../services/scheduler";
import { logger } from "../../utils/logger";
import { AppError } from "../../middleware/errorHandler";
import { ErrorCodes } from "../../../shared/types/errorCodes";

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
      throw new AppError("Database connection not available", 500, ErrorCodes.INTERNAL_ERROR);
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
      throw new AppError(errorMessage, 400, ErrorCodes.VALIDATION_ERROR);
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
      throw new AppError("Database connection not available", 500, ErrorCodes.INTERNAL_ERROR);
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
      throw new AppError(errorMessage, 400, ErrorCodes.VALIDATION_ERROR);
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
      throw new AppError("Database connection not available", 500, ErrorCodes.INTERNAL_ERROR);
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
      throw new AppError("获取待复习任务失败", 500, ErrorCodes.INTERNAL_ERROR);
    }
  },
);

router.get(
  "/stats",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      throw new AppError("Database connection not available", 500, ErrorCodes.INTERNAL_ERROR);
    }

    try {
      const stats = await reviewTaskService.getReviewTaskStats(
        supabase,
        req.user.id,
      );

      res.json({ success: true, data: stats });
    } catch (error) {
      logger.error("Get review task stats error:", error);
      throw new AppError("获取复习任务统计失败", 500, ErrorCodes.INTERNAL_ERROR);
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
      throw new AppError("Database connection not available", 500, ErrorCodes.INTERNAL_ERROR);
    }

    const { knowledgePointId } = req.params;

    try {
      const reviewTask = await reviewTaskService.getReviewTaskByKnowledgePoint(
        supabase,
        req.user.id,
        knowledgePointId,
      );

      if (!reviewTask) {
        throw new AppError("复习任务不存在", 404, ErrorCodes.NOT_FOUND);
      }

      res.json({ success: true, data: reviewTask });
    } catch (error) {
      logger.error("Get review task error:", error);
      throw new AppError("获取复习任务失败", 500, ErrorCodes.INTERNAL_ERROR);
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
      throw new AppError("Database connection not available", 500, ErrorCodes.INTERNAL_ERROR);
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
      throw new AppError("删除复习任务失败", 500, ErrorCodes.INTERNAL_ERROR);
    }
  },
);

export default router;

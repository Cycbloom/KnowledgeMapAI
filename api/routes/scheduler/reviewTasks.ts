import { Router, type Response } from "express";
import { requireAuth, type AuthRequest } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { z } from "zod";
import { reviewTaskService } from "../../services/scheduler";
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
      throw new AppError("Database connection not available", 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }

    const { knowledge_point_id, task_id } = req.body;

    const reviewTask = await reviewTaskService.createFirstReviewTask(
      supabase,
      req.user.id,
      { knowledge_point_id, task_id },
    );

    res.status(201).json({ success: true, data: reviewTask });
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
      throw new AppError("Database connection not available", 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }

    const { knowledgePointId } = req.params;
    const { quality } = req.body;

    const updatedTask = await reviewTaskService.updateReviewTask(
      supabase,
      req.user.id,
      knowledgePointId,
      { quality },
    );

    res.json({ success: true, data: updatedTask });
  },
);

router.get(
  "/pending",
  requireAuth,
  validate({ query: pendingQuerySchema }),
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      throw new AppError("Database connection not available", 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }

    const { limit } = req.query as unknown as z.infer<
      typeof pendingQuerySchema
    >;

    const pendingTasks = await reviewTaskService.getPendingReviewTasks(
      supabase,
      req.user.id,
      limit,
    );

    res.json({ success: true, data: pendingTasks });
  },
);

router.get(
  "/stats",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      throw new AppError("Database connection not available", 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }

    const stats = await reviewTaskService.getReviewTaskStats(
      supabase,
      req.user.id,
    );

    res.json({ success: true, data: stats });
  },
);

router.get(
  "/:knowledgePointId",
  requireAuth,
  validate({ params: knowledgePointParamsSchema }),
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      throw new AppError("Database connection not available", 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }

    const { knowledgePointId } = req.params;

    const reviewTask = await reviewTaskService.getReviewTaskByKnowledgePoint(
      supabase,
      req.user.id,
      knowledgePointId,
    );

    if (!reviewTask) {
      throw new AppError("复习任务不存在", 404, ErrorCodes.RESOURCE_NOT_FOUND);
    }

    res.json({ success: true, data: reviewTask });
  },
);

router.delete(
  "/:knowledgePointId",
  requireAuth,
  validate({ params: knowledgePointParamsSchema }),
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      throw new AppError("Database connection not available", 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }

    const { knowledgePointId } = req.params;

    await reviewTaskService.deleteReviewTask(
      supabase,
      req.user.id,
      knowledgePointId,
    );

    res.json({ success: true });
  },
);

export default router;

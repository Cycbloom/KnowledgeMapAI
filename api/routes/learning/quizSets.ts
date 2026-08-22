import { Router, type Response } from "express";
import { requireAuth, type AuthedRequest } from "../../middleware/auth";
import { requireQuizSetOwnership } from "../../middleware/ownership";
import { validate } from "../../middleware/validate";
import {
  createQuizSetSchema,
  updateQuizSetSchema,
  generateQuizSchema,
  regenerateCardSchema,
  generationProgressParamsSchema,
  uuidParamsSchema,
} from "../../schemas/index";
import { quizSetsService } from "../../services/quiz";
import { asyncTaskService } from "../../services/asyncTaskService";
import { AppError } from "../../middleware/errorHandler";
import { ErrorCodes } from "../../../shared/types/errorCodes";
import type { QuizGenerationProgress } from "../../../shared/types/quiz";

const router = Router();

router.get(
  "/",
  requireAuth,
  async (req: AuthedRequest, res: Response) => {
    const { graph_id } = req.query;
    const data = await quizSetsService.list(
      req.supabase,
      req.user.id,
      graph_id as string | undefined,
    );
    res.json(data);
  },
);

router.get(
  "/generation/:taskId",
  requireAuth,
  validate(generationProgressParamsSchema),
  async (req: AuthedRequest, res: Response) => {
    const { taskId } = req.params;
    const task = await asyncTaskService.getTask(req.supabase, taskId, req.user.id);
    if (!task) {
      throw new AppError("生成任务不存在", 404, ErrorCodes.RESOURCE_NOT_FOUND);
    }
    const runtime = task.runtime_progress as
      | { percent?: number; current?: string; completed?: number; total?: number }
      | undefined;
    const statusMap: Record<string, QuizGenerationProgress["status"]> = {
      pending: "pending",
      in_progress: "in_progress",
      running: "in_progress",
      completed: "completed",
      failed: "failed",
      cancelled: "failed",
      paused: "pending",
    };
    res.json({
      status: statusMap[task.status] ?? "pending",
      total: runtime?.total ?? 0,
      completed: runtime?.completed ?? 0,
      current: runtime?.current,
      error: task.error_message,
    } satisfies QuizGenerationProgress);
  },
);

router.get(
  "/:id",
  requireAuth,
  validate(uuidParamsSchema),
  async (req: AuthedRequest, res: Response) => {
    const { id } = req.params;
    const data = await quizSetsService.get(req.supabase, req.user.id, id);
    res.json(data);
  },
);

router.post(
  "/",
  requireAuth,
  validate(createQuizSetSchema),
  async (req: AuthedRequest, res: Response) => {
    const { title, description, config, graph_id } = req.body;
    const data = await quizSetsService.create(req.supabase, req.user.id, {
      title,
      description,
      config,
      graph_id,
    });
    res.status(201).json(data);
  },
);

router.put(
  "/:id",
  requireAuth,
  validate(updateQuizSetSchema),
  requireQuizSetOwnership,
  async (req: AuthedRequest, res: Response) => {
    const { id } = req.params;
    const { title, description, config } = req.body;
    const data = await quizSetsService.update(req.supabase, req.user.id, id, {
      title,
      description,
      config,
    });
    res.json(data);
  },
);

router.delete(
  "/:id",
  requireAuth,
  validate(uuidParamsSchema),
  requireQuizSetOwnership,
  async (req: AuthedRequest, res: Response) => {
    const { id } = req.params;
    await quizSetsService.delete(req.supabase, req.user.id, id);
    res.json({ success: true, message: "测验集合已删除" });
  },
);

router.post(
  "/generate",
  requireAuth,
  validate(generateQuizSchema),
  async (req: AuthedRequest, res: Response) => {
    const { quiz_set_id, node_ids, config } = req.body;
    const result = await quizSetsService.generateCards(
      req.supabase,
      req.user.id,
      quiz_set_id,
      { node_ids, config },
    );
    res.json(result);
  },
);

router.post(
  "/:id/regenerate/:cardId",
  requireAuth,
  validate(regenerateCardSchema),
  async (req: AuthedRequest, res: Response) => {
    const { id, cardId } = req.params;
    const result = await quizSetsService.regenerateCard(
      req.supabase,
      req.user.id,
      id,
      cardId,
    );
    res.json(result);
  },
);

router.post(
  "/:id/cards",
  requireAuth,
  validate(uuidParamsSchema),
  async (req: AuthedRequest, res: Response) => {
    const { id } = req.params;
    const { card_id } = req.body;
    await quizSetsService.addCard(req.supabase, req.user.id, id, card_id);
    res.json({ success: true, message: "卡片已添加到测验集合" });
  },
);

router.delete(
  "/:id/cards/:cardId",
  requireAuth,
  validate(uuidParamsSchema),
  requireQuizSetOwnership,
  async (req: AuthedRequest, res: Response) => {
    const { id, cardId } = req.params;
    await quizSetsService.removeCard(req.supabase, req.user.id, id, cardId);
    res.json({ success: true, message: "卡片已从测验集合移除" });
  },
);

export default router;

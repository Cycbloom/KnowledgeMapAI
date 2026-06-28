import { Router, type Response } from "express";
import { requireAuth, type AuthedRequest } from "../middleware/auth";
import { validate } from "../middleware/validate";
import {
  createQuizSetSchema,
  updateQuizSetSchema,
  generateQuizSchema,
  regenerateCardSchema,
  uuidParamsSchema,
} from "../schemas/index";
import { quizSetsService } from "../services/quiz";

const router = Router();

router.get(
  "/quiz-sets",
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
  "/quiz-sets/:id",
  requireAuth,
  validate(uuidParamsSchema),
  async (req: AuthedRequest, res: Response) => {
    const { id } = req.params;
    const data = await quizSetsService.get(req.supabase, req.user.id, id);
    res.json(data);
  },
);

router.post(
  "/quiz-sets",
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
  "/quiz-sets/:id",
  requireAuth,
  validate(updateQuizSetSchema),
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
  "/quiz-sets/:id",
  requireAuth,
  validate(uuidParamsSchema),
  async (req: AuthedRequest, res: Response) => {
    const { id } = req.params;
    await quizSetsService.delete(req.supabase, req.user.id, id);
    res.json({ success: true, message: "测验集合已删除" });
  },
);

router.post(
  "/quiz-sets/generate",
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
  "/quiz-sets/:id/regenerate/:cardId",
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
  "/quiz-sets/:id/cards",
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
  "/quiz-sets/:id/cards/:cardId",
  requireAuth,
  validate(uuidParamsSchema),
  async (req: AuthedRequest, res: Response) => {
    const { id, cardId } = req.params;
    await quizSetsService.removeCard(req.supabase, req.user.id, id, cardId);
    res.json({ success: true, message: "卡片已从测验集合移除" });
  },
);

export default router;

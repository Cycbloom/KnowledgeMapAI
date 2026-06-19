import { Router, type Response } from "express";
import { requireAuth, type AuthRequest } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { learningPathRouteService } from "../services/study";
import { z } from "zod";

const router = Router();

const generatePathSchema = z.object({
  graph_id: z.string().uuid(),
  target_goal: z.string().min(5).max(500).optional(),
  target_knowledge_point_id: z.string().uuid().optional(),
  learning_style: z
    .enum(["sequential", "exploratory", "focused", "custom"])
    .default("sequential"),
  daily_time_minutes: z.number().min(5).max(240).default(30),
  current_knowledge: z.string().max(1000).optional(),
  provider: z.string().optional(),
  model: z.string().optional(),
});

router.post(
  "/generate",
  requireAuth,
  validate(generatePathSchema),
  async (req: AuthRequest, res: Response) => {
    const {
      graph_id,
      target_goal,
      target_knowledge_point_id,
      learning_style,
      daily_time_minutes,
      current_knowledge,
      provider,
      model,
    } = req.body;

    const learningPath = await learningPathRouteService.generatePath(
      req.supabase!,
      req.user.id,
      {
        graph_id,
        target_goal,
        target_knowledge_point_id,
        learning_style,
        daily_time_minutes,
        current_knowledge,
        provider,
        model,
      },
    );
    res.json(learningPath);
  },
);

router.get(
  "/progress/:graphId",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const { graphId } = req.params;

    const progress = await learningPathRouteService.getProgress(
      req.supabase!,
      req.user.id,
      graphId,
    );
    res.json(progress);
  },
);

const getQuestionsSchema = z.object({
  graph_id: z.string().uuid(),
});

router.post(
  "/questions",
  requireAuth,
  validate(getQuestionsSchema),
  async (req: AuthRequest, res: Response) => {
    const { graph_id } = req.body;

    const result = await learningPathRouteService.generateQuestions(
      req.supabase!,
      req.user.id,
      { graph_id },
    );
    res.json(result);
  },
);

export default router;

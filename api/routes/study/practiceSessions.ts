import { Router, type Response } from "express";
import { requireAuth, type AuthedRequest } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { z } from "zod";
import { subtaskQuizIntegrationService } from "../../services/scheduler";
import { asyncHandler } from "../../utils/asyncHandler";

const router = Router();

const startPracticeSchema = z.object({
  subtask_id: z.string().uuid(),
  knowledge_point_id: z.string().uuid(),
});

const completePracticeSchema = z.object({
  results: z.array(z.object({
    card_id: z.string().uuid(),
    correct: z.boolean(),
    time_spent: z.number().min(0),
    user_answer: z.string().optional(),
  })),
});

router.post(
  "/",
  requireAuth,
  validate({ body: startPracticeSchema }),
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    const { subtask_id, knowledge_point_id } = req.body;
    const session = await subtaskQuizIntegrationService.startPracticeSession(
      req.supabase,
      subtask_id,
      knowledge_point_id,
    );
    res.status(201).json({ success: true, data: session });
  }),
);

router.post(
  "/:id/complete",
  requireAuth,
  validate({ body: completePracticeSchema }),
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    const { results } = req.body;
    const subtaskId = req.params.id;
    const completionResult = await subtaskQuizIntegrationService.completePractice(
      req.supabase,
      subtaskId,
      results,
    );
    res.json({ success: true, data: completionResult });
  }),
);

export default router;

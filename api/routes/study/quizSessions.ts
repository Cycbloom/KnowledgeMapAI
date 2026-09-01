import { Router, type Response } from "express";
import { requireAuth, type AuthedRequest } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { z } from "zod";
import { subtaskQuizIntegrationService } from "../../services/scheduler";
import { asyncHandler } from "../../utils/asyncHandler";

const router = Router();

const startQuizSchema = z.object({
  subtask_id: z.string().uuid(),
  knowledge_point_id: z.string().uuid(),
});

const completeQuizSchema = z.object({
  results: z.array(z.object({
    card_id: z.string().uuid(),
    correct: z.boolean(),
    answer: z.string().optional(),
    time_spent: z.number().min(0),
  })),
});

const recordQuizAttemptSchema = z.object({
  quiz_set_id: z.string().uuid(),
  results: z.array(z.object({
    card_id: z.string().uuid(),
    correct: z.boolean(),
    user_answer: z.string().optional(),
    time_spent: z.number().min(0).optional(),
  })),
});

router.post(
  "/",
  requireAuth,
  validate({ body: startQuizSchema }),
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    const { subtask_id, knowledge_point_id } = req.body;
    const session = await subtaskQuizIntegrationService.startQuizSession(
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
  validate({ body: completeQuizSchema }),
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    const { results } = req.body;
    const subtaskId = req.params.id;
    const completionResult = await subtaskQuizIntegrationService.completeQuiz(
      req.supabase,
      subtaskId,
      results,
    );
    res.json({ success: true, data: completionResult });
  }),
);

router.post(
  "/record",
  requireAuth,
  validate({ body: recordQuizAttemptSchema }),
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    const { quiz_set_id, results } = req.body;
    const recordResult = await subtaskQuizIntegrationService.recordQuizAttempt(
      req.supabase,
      req.user.id,
      quiz_set_id,
      results,
    );
    res.status(201).json({ success: true, data: recordResult });
  }),
);

export default router;

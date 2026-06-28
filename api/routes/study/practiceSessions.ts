import { Router, type Response } from "express";
import { requireAuth, type AuthedRequest } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { z } from "zod";
import { subtaskQuizIntegrationService } from "../../services/scheduler";
import { logger } from "../../utils/logger";
import { AppError } from "../../middleware/errorHandler";
import { ErrorCodes } from "../../../shared/types/errorCodes";

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
  async (req: AuthedRequest, res: Response) => {
    const { subtask_id, knowledge_point_id } = req.body;
    try {
      const session = await subtaskQuizIntegrationService.startPracticeSession(
        req.supabase,
        subtask_id,
        knowledge_point_id,
      );
      res.status(201).json({ success: true, data: session });
    } catch (error) {
      if (error instanceof AppError) throw error;
      const errorMessage = error instanceof Error ? error.message : "创建练习会话失败";
      logger.error("Start practice session error:", error);
      throw new AppError(errorMessage, 400, ErrorCodes.VALIDATION_ERROR);
    }
  },
);

router.post(
  "/:id/complete",
  requireAuth,
  validate({ body: completePracticeSchema }),
  async (req: AuthedRequest, res: Response) => {
    const { results } = req.body;
    const subtaskId = req.params.id;
    try {
      const completionResult = await subtaskQuizIntegrationService.completePractice(
        req.supabase,
        subtaskId,
        results,
      );
      res.json({ success: true, data: completionResult });
    } catch (error) {
      if (error instanceof AppError) throw error;
      const errorMessage = error instanceof Error ? error.message : "完成练习会话失败";
      logger.error("Complete practice session error:", error);
      throw new AppError(errorMessage, 400, ErrorCodes.VALIDATION_ERROR);
    }
  },
);

export default router;

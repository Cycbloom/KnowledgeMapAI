import { Router, type Response } from "express";
import { requireAuth, type AuthRequest } from "../../middleware/auth";
import { z } from "zod";
import { validate } from "../../middleware/validate";
import { schedulerDecisionService } from "../../services/scheduler/schedulerDecisionService";

const router = Router();

const nextStepQuerySchema = z.object({
  overdue_threshold: z.coerce.number().int().min(1).max(20).optional(),
});

/** 调度决策：返回「现在最该做的下一步」（复习打断 / 队列推进） */
router.get(
  "/scheduler/next-step",
  requireAuth,
  validate({ query: nextStepQuerySchema }),
  async (req: AuthRequest, res: Response) => {
    const { overdue_threshold } = req.query as { overdue_threshold?: string };

    const decision = await schedulerDecisionService.getNextStep(
      req.supabase,
      req.user.id,
      {
        overdueThreshold: overdue_threshold
          ? Number(overdue_threshold)
          : undefined,
      },
    );

    res.json({ success: true, data: decision });
  },
);

/** 是否需要记忆打断（供 UI 提示） */
router.get(
  "/scheduler/review-interrupt",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const result = await schedulerDecisionService.needsReviewInterrupt(
      req.supabase,
      req.user.id,
    );
    res.json({ success: true, data: result });
  },
);

export default router;
import { Router, type Response } from "express";
import { requireAuth, type AuthRequest } from "../../middleware/auth";
import { schedulerDecisionEngine } from "../../services/scheduler/core/decisionEngine";
import { logger } from "../../utils/logger";

const router = Router();

router.get(
  "/recommendations",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      return res
        .status(500)
        .json({ error: "Database connection not available" });
    }

    const limit = req.query.limit
      ? parseInt(req.query.limit as string, 10)
      : 5;

    try {
      const recommendations =
        await schedulerDecisionEngine.getRecommendations(
          supabase,
          req.user.id,
          limit,
        );

      res.json({ success: true, data: recommendations });
    } catch (error) {
      const err = error as Error;
      logger.error("Decision engine recommendations error:", err);
      res
        .status(500)
        .json({ error: err.message || "获取决策引擎推荐失败" });
    }
  },
);

export default router;

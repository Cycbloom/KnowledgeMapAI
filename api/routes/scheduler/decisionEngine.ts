import { Router, type Response } from "express";
import { requireAuth, type AuthRequest } from "../../middleware/auth";
import { schedulerDecisionEngine } from "../../services/scheduler/core";
import { logger } from "../../utils/logger";
import { AppError } from "../../middleware/errorHandler";
import { ErrorCodes } from "../../../shared/types/errorCodes";

const router = Router();

router.get(
  "/recommendations",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      throw new AppError("Database connection not available", 500, ErrorCodes.INTERNAL_ERROR);
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
      throw new AppError(err.message || "获取决策引擎推荐失败", 500, ErrorCodes.INTERNAL_ERROR);
    }
  },
);

export default router;

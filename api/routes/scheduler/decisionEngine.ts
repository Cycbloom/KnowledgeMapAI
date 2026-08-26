import { Router, type Response } from "express";
import { requireAuth, type AuthRequest } from "../../middleware/auth";
import { schedulerDecisionEngine } from "../../services/scheduler/core";
import { AppError } from "../../middleware/errorHandler";
import { ErrorCodes } from "../../../shared/types/errorCodes";

const router = Router();

router.get(
  "/recommendations",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      throw new AppError("Database connection not available", 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }

    const limit = req.query.limit
      ? parseInt(req.query.limit as string, 10)
      : 5;

    const recommendations =
      await schedulerDecisionEngine.getRecommendations(
        supabase,
        req.user.id,
        limit,
      );

    res.json({ success: true, data: recommendations });
  },
);

export default router;

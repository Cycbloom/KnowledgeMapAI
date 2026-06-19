import { Router, type Response } from "express";
import { requireAuth, type AuthRequest } from "../../middleware/auth";
import { spacedRepetitionBridge } from "../../services/study";
import { AppError } from "../../middleware/errorHandler";
import { ErrorCodes } from "../../../shared/types/errorCodes";

const router = Router();

router.get(
  "/unified-review",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      throw new AppError("Database connection not available", 500, ErrorCodes.INTERNAL_ERROR);
    }

    const items = await spacedRepetitionBridge.getUnifiedReviewQueue(
      supabase,
      req.user.id,
    );

    res.json({ success: true, data: items });
  },
);

router.post(
  "/unified-review/:id/complete",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      throw new AppError("Database connection not available", 500, ErrorCodes.INTERNAL_ERROR);
    }

    const { id } = req.params;
    const { knowledge_point_id, quality_score } = req.body;

    const result = await spacedRepetitionBridge.processReviewCompletion(
      supabase,
      req.user.id,
      id,
      knowledge_point_id,
      quality_score,
    );

    if (!result) {
      throw new AppError("复习处理失败", 500, ErrorCodes.INTERNAL_ERROR);
    }

    res.json({ success: true, data: result });
  },
);

export default router;

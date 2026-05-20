import { Router, type Response } from "express";
import { requireAuth, type AuthRequest } from "../../middleware/auth";
import { spacedRepetitionBridge } from "../../services/study/spacedRepetitionBridge";

const router = Router();

router.get(
  "/unified-review",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      return res.status(500).json({ error: "Database connection not available" });
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
      return res.status(500).json({ error: "Database connection not available" });
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
      return res.status(500).json({ error: "复习处理失败" });
    }

    res.json({ success: true, data: result });
  },
);

export default router;

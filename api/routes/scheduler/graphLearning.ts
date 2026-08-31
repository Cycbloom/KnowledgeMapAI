import { Router, type Response } from "express";
import { requireAuth, type AuthedRequest } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { z } from "zod";
import { graphLearningLauncherService } from "../../services/scheduler/graphLearningLauncherService";

const router = Router();

const startLearningParamsSchema = z.object({
  graphId: z.string().uuid("无效的图谱ID"),
});

const startLearningBodySchema = z.object({
  daily_minutes: z.number().int().min(5).max(240).optional(),
});

/** 统一「开始学习图谱」入口：图谱大任务 → 学习路径 → 按路径重排子任务 */
router.post(
  "/graph-learning/:graphId/start",
  requireAuth,
  validate({ params: startLearningParamsSchema, body: startLearningBodySchema }),
  async (req: AuthedRequest, res: Response) => {
    const { graphId } = req.params;
    const { daily_minutes } = req.body;

    const result = await graphLearningLauncherService.startLearningForGraph(
      req.supabase,
      req.user.id,
      graphId,
      { daily_minutes },
    );

    res.json({ success: true, data: result });
  },
);

export default router;
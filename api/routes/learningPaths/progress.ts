// 学习路径进度跟踪路由：获取图谱进度、获取/更新路径进度

import { Router, type Response } from "express";
import { z } from "zod";
import { requireAuth, type AuthedRequest } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { learningPathService, learningPathRouteService } from "../../services/study";
import { uuidParamSchema, graphIdParamSchema } from "./shared";

const router = Router();

// 更新进度请求体 schema
const updateProgressSchema = z.object({
  node_id: z.string().uuid("无效的节点ID"),
  progress_percentage: z.number().min(0).max(100).optional(),
  time_spent: z.number().min(0).optional(),
  notes: z.string().max(1000).optional(),
});

// 获取指定图谱下的学习路径进度
router.get(
  "/progress/:graphId",
  requireAuth,
  validate({ params: graphIdParamSchema }),
  async (req: AuthedRequest, res: Response) => {
    const { graphId } = req.params;
    const progress = await learningPathRouteService.getProgress(
      req.supabase,
      req.user.id,
      graphId,
    );
    res.json(progress);
  },
);

// 获取学习路径进度
router.get(
  "/:id/progress",
  requireAuth,
  validate({ params: uuidParamSchema }),
  async (req: AuthedRequest, res: Response) => {
    const { id } = req.params;
    const data = await learningPathService.getPathProgress(
      req.supabase,
      id,
      req.user.id,
    );
    res.json(data);
  },
);

// 更新学习路径进度
router.put(
  "/:id/progress",
  requireAuth,
  validate({ params: uuidParamSchema, body: updateProgressSchema }),
  async (req: AuthedRequest, res: Response) => {
    const { id } = req.params;
    const { node_id, ...input } = req.body;

    const data = await learningPathService.updateProgress(
      req.supabase,
      id,
      node_id,
      req.user.id,
      input,
    );

    res.json(data);
  },
);

export default router;

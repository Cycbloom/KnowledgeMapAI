import { Router, type Response } from "express";
import { requireAuth, type AuthedRequest } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { z } from "zod";
import { learningFlowService } from "../../services/scheduler/learningFlowService";

const router = Router();

const completeLearningBodySchema = z.object({
  knowledge_point_id: z.string().uuid("无效的知识点ID"),
  task_id: z.string().uuid("无效的任务ID").optional(),
  graph_id: z.string().uuid("无效的图谱ID").optional(),
  material_duration_seconds: z.number().int().min(0).optional(),
});

const completeReviewParamsSchema = z.object({
  id: z.string().uuid("无效的子任务ID"),
});

/**
 * 【学习完成】读完材料后的统一推进入口。
 * 会：重算掌握度 → 从 learning 推进到首个非 learning 阶段 → 创建首次复习卡片 → 返回下一步推荐活动。
 */
router.post(
  "/learning-flow/complete-learning",
  requireAuth,
  validate({ body: completeLearningBodySchema }),
  async (req: AuthedRequest, res: Response) => {
    const { knowledge_point_id, task_id, graph_id, material_duration_seconds } = req.body;

    const result = await learningFlowService.completeLearning(req.supabase, {
      knowledgePointId: knowledge_point_id,
      userId: req.user.id,
      taskId: task_id,
      graphId: graph_id,
      materialDurationSeconds: material_duration_seconds,
    });

    res.json({ success: true, data: result });
  },
);

/**
 * 【复习完成】复习阶段完成后的统一推进入口。
 * review → practice，并返回下一步推荐活动。
 */
router.post(
  "/learning-flow/:id/complete-review",
  requireAuth,
  validate({ params: completeReviewParamsSchema }),
  async (req: AuthedRequest, res: Response) => {
    const { id } = req.params;

    const result = await learningFlowService.completeReview(req.supabase, {
      userId: req.user.id,
      subtaskId: id,
    });

    res.json({ success: true, data: result });
  },
);

export default router;
import { Router } from "express";
import { requireAuth, type AuthedRequest } from "../../middleware/auth";
import { preGenerationService } from "../../services/scheduler/preGenerationService";

const router = Router();

/**
 * 立即执行一轮 AI 预生成（供设置页「立即预生成」按钮调用）。
 */
router.post(
  "/pre-generation/run",
  requireAuth,
  async (req: AuthedRequest, res) => {
    const summary = await preGenerationService.runPreGeneration(
      req.supabase,
      req.user.id,
    );
    res.json(summary);
  },
);

/**
 * 预生成任务状态查询。可选 knowledge_point_id：
 * 传参时返回该知识点是否有在途预生成任务（学习模式用于避免重复调用 AI）。
 */
router.get(
  "/pre-generation/status",
  requireAuth,
  async (req: AuthedRequest, res) => {
    const knowledgePointId =
      typeof req.query.knowledge_point_id === "string"
        ? req.query.knowledge_point_id
        : undefined;
    const status = await preGenerationService.getStatus(
      req.supabase,
      req.user.id,
      knowledgePointId,
    );
    res.json(status);
  },
);

export default router;

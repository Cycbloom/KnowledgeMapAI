import { Router } from "express";
import { requireAuth, type AuthedRequest } from "../../middleware/auth";
import { embeddingService } from "../../services/ai";
import { autoGraphRouteService } from "../../services/graph";

const router = Router();

// 嵌入生成/状态查询依赖 req.supabase（用户级 client），必须挂认证
router.use(requireAuth);

router.post("/generate-embeddings", async (req: AuthedRequest, res) => {
  const { limit = 100 } = req.body || {};

  const result = await embeddingService.generateEmbeddingsBatch(
    req.supabase,
    Math.min(limit, 500),
  );

  res.json({
    success: true,
    ...result,
  });
});

router.get("/embedding-status", async (req: AuthedRequest, res) => {
  const status = embeddingService.getStatus();

  const embeddingStatus = await autoGraphRouteService.getEmbeddingStatus(
    req.supabase,
  );

  res.json({
    ...status,
    pendingCount: embeddingStatus.pendingCount,
  });
});

export default router;

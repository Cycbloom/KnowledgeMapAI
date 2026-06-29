import { Router } from "express";
import { type AuthedRequest } from "../../middleware/auth";
import { AppError } from "../../middleware/errorHandler";
import { ErrorCodes } from "../../../shared/types/errorCodes";
import { embeddingService } from "../../services/ai";
import { logger } from "../../utils/logger";
import { autoGraphRouteService } from "../../services/graph";

const router = Router();

router.post("/generate-embeddings", async (req: AuthedRequest, res) => {
  try {
    const { limit = 100 } = req.body || {};

    const result = await embeddingService.generateEmbeddingsBatch(
      req.supabase,
      Math.min(limit, 500),
    );

    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    const err = error as Error;
    logger.error("Generate embeddings error:", error);
    throw new AppError(
      err.message || "生成嵌入向量失败",
      500,
      ErrorCodes.SYSTEM_INTERNAL_ERROR,
    );
  }
});

router.get("/embedding-status", async (req: AuthedRequest, res) => {
  try {
    const status = embeddingService.getStatus();

    const embeddingStatus = await autoGraphRouteService.getEmbeddingStatus(
      req.supabase,
    );

    res.json({
      ...status,
      pendingCount: embeddingStatus.pendingCount,
    });
  } catch (error) {
    const err = error as Error;
    logger.error("Get embedding status error:", error);
    throw new AppError(
      err.message || "获取嵌入状态失败",
      500,
      ErrorCodes.SYSTEM_INTERNAL_ERROR,
    );
  }
});

export default router;

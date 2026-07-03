import { Router, type Response } from "express";
import { requireAuth, type AuthedRequest } from "../middleware/auth";
import { rateLimiters } from "../middleware/rateLimiter";
import { backlinkService } from "../services/graph";

const router = Router();

/**
 * GET /backlinks/search?q=xxx&graphId=xxx&limit=10
 * 搜索知识点（用于 [[ 节点选择器）
 *
 * 注意：必须定义在 /:knowledgePointId 之前，否则 "search" 会被当作
 * knowledgePointId 路径参数。
 */
router.get(
  "/search",
  requireAuth,
  async (req: AuthedRequest, res: Response) => {
    const query = (req.query.q as string) || "";
    const graphId = (req.query.graphId as string) || undefined;
    const limitParam = parseInt(req.query.limit as string, 10);
    const limit = Number.isFinite(limitParam)
      ? Math.min(Math.max(limitParam, 1), 20)
      : 10;

    const data = await backlinkService.searchKnowledgePoints(
      req.supabase,
      req.user.id,
      query,
      { graphId, limit },
    );
    res.json(data);
  },
);

/**
 * GET /backlinks/:knowledgePointId/outlinks
 * 获取某知识点的正向链接列表（它引用了谁）
 */
router.get(
  "/:knowledgePointId/outlinks",
  requireAuth,
  async (req: AuthedRequest, res: Response) => {
    const { knowledgePointId } = req.params;
    const data = await backlinkService.getOutlinks(
      req.supabase,
      req.user.id,
      knowledgePointId,
    );
    res.json(data);
  },
);

/**
 * GET /backlinks/:knowledgePointId/block-refs
 * 获取"引用了含 [[节点X]] 的块"的笔记列表（P3 块级反向链接）。
 *
 * 与 getBacklinks（基于 edges 关系）互补：本端点返回笔记块引用层面的关系，
 * 供节点详情侧边栏"引用此节点的块"子区块使用。
 *
 * 走 rateLimiters.general（read 限流）。
 */
router.get(
  "/:knowledgePointId/block-refs",
  requireAuth,
  rateLimiters.general,
  async (req: AuthedRequest, res: Response) => {
    const { knowledgePointId } = req.params;
    const data = await backlinkService.getBlockRefBacklinksForNode(
      req.supabase,
      req.user.id,
      knowledgePointId,
    );
    res.json(data);
  },
);

/**
 * GET /backlinks/:knowledgePointId
 * 获取某知识点的反向链接列表（谁引用了它）
 */
router.get(
  "/:knowledgePointId",
  requireAuth,
  async (req: AuthedRequest, res: Response) => {
    const { knowledgePointId } = req.params;
    const data = await backlinkService.getBacklinks(
      req.supabase,
      req.user.id,
      knowledgePointId,
    );
    res.json(data);
  },
);

export default router;

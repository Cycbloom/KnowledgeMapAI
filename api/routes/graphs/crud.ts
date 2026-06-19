import { Router, type Response } from "express";
import {
  requireAuth,
  optionalAuth,
  type AuthRequest,
} from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import {
  createGraphSchema,
  updateGraphSchema,
  uuidParamsSchema,
  shareGraphSchema,
} from "../../schemas/index";
import {
  graphService,
  graphDomainService,
  relationDiscoveryService,
  conceptAggregationService,
  graphCrudService,
} from "../../services/graph";
import { ErrorCodes } from "../../../shared/types/errorCodes";
import { AppError } from "../../middleware/errorHandler";
import { cacheService } from "../../services/common";
import { logger } from "../../utils/logger";
import { z } from "zod";

const checkTopicSchema = z.object({
  topic: z.string().min(2).max(200),
  exclude_graph_id: z.string().uuid().optional(),
});

const batchOperationSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(50),
});

const router = Router();

// List all graphs for the user (Auth Required)
router.get("/", requireAuth, async (req: AuthRequest, res: Response) => {
  const supabase = req.supabase!;
  const userId = req.user.id;
  const domainId = req.query.domain_id as string | undefined;
  const domainIdsStr = req.query.domain_ids as string | undefined;

  if (domainIdsStr || domainId) {
    const domainIds = domainIdsStr
      ? domainIdsStr
          .split(",")
          .map((id) => id.trim())
          .filter(Boolean)
      : domainId
        ? [domainId]
        : [];

    const data = await graphDomainService.listGraphsByDomains(
      supabase,
      userId,
      domainIds,
    );
    return res.json(data);
  }

  const data = await graphService.listGraphs(supabase, userId);
  res.json(data);
});

// List deleted graphs (Auth Required)
router.get("/trash", requireAuth, async (req: AuthRequest, res: Response) => {
  const data = await graphService.listTrash(req.supabase!, req.user.id);
  res.json(data);
});

router.get("/map", requireAuth, async (req: AuthRequest, res: Response) => {
  const data = await graphCrudService.getGraphMap(req.supabase!, req.user.id);
  res.json(data);
});

// Get all tags from user's graphs
router.get("/tags", requireAuth, async (req: AuthRequest, res: Response) => {
  const data = await graphCrudService.getTags(req.supabase!, req.user.id);
  res.json(data);
});

// Get all domains from user's graphs
router.get("/domains", requireAuth, async (req: AuthRequest, res: Response) => {
  const data = await graphCrudService.getDomains(req.supabase!, req.user.id);
  res.json(data);
});

router.get(
  "/map/analyze",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const data = await graphCrudService.analyzeMap(req.supabase!, req.user.id);
    res.json(data);
  },
);

// Check if a topic is duplicate (Auth Required)
router.post(
  "/check-topic",
  requireAuth,
  validate({ body: checkTopicSchema }),
  async (req: AuthRequest, res: Response) => {
    const { topic, exclude_graph_id } = req.body;

    const result = await graphService.checkTopicDuplicate(
      req.supabase!,
      req.user.id,
      topic,
      exclude_graph_id,
    );

    res.json({
      is_duplicate: result.isDuplicate,
      similar_graphs: result.similarGraphs,
    });
  },
);

// Create a new graph (Auth Required)
router.post(
  "/",
  requireAuth,
  validate({ body: createGraphSchema }),
  async (req: AuthRequest, res: Response) => {
    const { title, description, domains, template_type, preset_id } = req.body;
    const data = await graphService.createGraph(
      req.supabase!,
      req.user.id,
      title,
      description,
      { templateType: template_type, presetId: preset_id },
    );

    if (domains && Array.isArray(domains) && domains.length > 0) {
      await graphDomainService.updateGraphDomains(req.supabase!, data.id, domains);
    }

    res.status(201).json(data);
  },
);

router.get(
  "/intelligent-suggestions",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const userId = req.user.id;
    const graphIds = req.query.graph_ids
      ? (req.query.graph_ids as string).split(",")
      : undefined;

    try {
      const result = await relationDiscoveryService.getIntelligentSuggestions(
        req.supabase!,
        userId,
        { graph_ids: graphIds },
      );

      res.json(result);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "获取智能建议失败";
      throw new AppError(message, 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }
  },
);

// GET /api/graphs/:id/analysis/module-gaps - Detect new module needs
router.get(
  "/:id/analysis/module-gaps",
  requireAuth,
  validate({ params: uuidParamsSchema }),
  async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    try {
      const result = await conceptAggregationService.detectNewModuleNeeds(
        req.supabase!,
        id,
      );
      res.json(result);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "模块缺口分析失败";
      throw new AppError(message, 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }
  },
);

// GET /api/graphs/:id/analysis/module-overlap - Detect module overlaps
router.get(
  "/:id/analysis/module-overlap",
  requireAuth,
  validate({ params: uuidParamsSchema }),
  async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    try {
      const result = await conceptAggregationService.detectModuleOverlap(
        req.supabase!,
        id,
      );
      res.json(result);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "模块重叠分析失败";
      throw new AppError(message, 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }
  },
);

router.get(
  "/:id/research-progress",
  requireAuth,
  validate({ params: uuidParamsSchema }),
  async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    try {
      const data = await graphCrudService.getResearchProgress(req.supabase!, id);
      res.json(data);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "研究进度获取失败";
      throw new AppError(message, 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }
  },
);

router.get(
  "/:id/literature",
  requireAuth,
  validate({ params: uuidParamsSchema }),
  async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const moduleFilter = req.query.module as string | undefined;

    try {
      const data = await graphCrudService.getLiterature(req.supabase!, id, moduleFilter);
      res.json(data);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "文献库获取失败";
      throw new AppError(message, 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }
  },
);

router.get(
  "/:id",
  optionalAuth,
  validate({ params: uuidParamsSchema }),
  async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const userId = req.user?.id || null;

    const data = await graphService.getGraph(req.supabase!, id, userId);
    if (!data) {
      throw new AppError("未找到该图谱", 404, ErrorCodes.RESOURCE_GRAPH_NOT_FOUND);
    }

    if (userId && req.supabase) {
      graphDomainService.migrateGraphDomainIfNeeded(req.supabase!, id, userId).catch((err) =>
        logger.warn("懒迁移领域失败:", err),
      );
    }

    const domains = await graphDomainService.getGraphDomains(req.supabase!, id);

    res.json({ ...data, domains });
  },
);

// Update a graph (Auth Required - Owner Only)
router.put(
  "/:id",
  requireAuth,
  validate({ params: uuidParamsSchema, body: updateGraphSchema }),
  async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { domains, ...updates } = req.body;
    const data = await graphService.updateGraph(
      req.supabase!,
      id,
      req.user.id,
      updates,
    );

    if (domains) {
      await graphDomainService.updateGraphDomains(req.supabase!, id, domains);
    }

    res.json(data);
  },
);

// Toggle Public Status
router.put(
  "/:id/share",
  requireAuth,
  validate({ params: uuidParamsSchema, body: shareGraphSchema }),
  async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { is_public } = req.body;

    const data = await graphService.updateGraph(
      req.supabase!,
      id,
      req.user.id,
      { is_public },
    );
    res.json(data);
  },
);

// Toggle Favorite Status
router.put(
  "/:id/favorite",
  requireAuth,
  validate({ params: uuidParamsSchema }),
  async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { is_favorite } = req.body;

    if (typeof is_favorite !== "boolean") {
      throw new AppError(
        "is_favorite 必须是布尔值",
        400,
        ErrorCodes.VALIDATION_ERROR,
      );
    }

    const data = await graphService.toggleFavorite(
      req.supabase!,
      id,
      req.user.id,
      is_favorite,
    );
    res.json(data);
  },
);

const updateViewModeSchema = z.object({
  viewMode: z.enum(["mindmap", "timeline", "tree", "planet", "quadrant"]),
});

router.put(
  "/:id/view-mode",
  requireAuth,
  validate({ params: uuidParamsSchema, body: updateViewModeSchema }),
  async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { viewMode } = req.body;

    const data = await graphCrudService.updateViewMode(
      req.supabase!,
      req.user.id,
      id,
      viewMode,
    );
    res.json(data);
  },
);

// Delete a graph (Soft Delete)
router.delete(
  "/:id",
  requireAuth,
  validate({ params: uuidParamsSchema }),
  async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    await graphService.deleteGraph(req.supabase!, id, req.user.id);

    await cacheService.invalidateUserGraphsCache(req.user.id);
    await cacheService.invalidateGraphCache(req.user.id, id);

    res.json({ message: "图谱已移至回收站" });
  },
);

// Batch restore graphs (must be before /:id/restore)
router.post(
  "/batch/restore",
  requireAuth,
  validate({ body: batchOperationSchema }),
  async (req: AuthRequest, res: Response) => {
    const { ids } = req.body;
    const result = await graphService.restoreGraphs(
      req.supabase!,
      ids,
      req.user.id,
    );
    res.json({ message: `已恢复 ${result.count} 个图谱`, count: result.count });
  },
);

// Batch delete graphs (soft delete, move to trash)
router.post(
  "/batch/delete",
  requireAuth,
  validate({ body: batchOperationSchema }),
  async (req: AuthRequest, res: Response) => {
    const { ids } = req.body;
    const result = await graphService.deleteGraphs(
      req.supabase!,
      ids,
      req.user.id,
    );
    res.json({
      message: `已移至回收站 ${result.count} 个图谱`,
      count: result.count,
    });
  },
);

// Batch permanently delete graphs (must be before /:id/permanent)
router.delete(
  "/batch/permanent",
  requireAuth,
  validate({ body: batchOperationSchema }),
  async (req: AuthRequest, res: Response) => {
    const { ids } = req.body;
    const result = await graphService.permanentDeleteGraphs(
      req.supabase!,
      ids,
      req.user.id,
    );
    res.json({
      message: `已永久删除 ${result.count} 个图谱`,
      count: result.count,
    });
  },
);

// Restore a graph
router.post(
  "/:id/restore",
  requireAuth,
  validate({ params: uuidParamsSchema }),
  async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    await graphService.restoreGraph(req.supabase!, id, req.user.id);
    res.json({ message: "图谱已恢复" });
  },
);

// Permanently Delete a graph
router.delete(
  "/:id/permanent",
  requireAuth,
  validate({ params: uuidParamsSchema }),
  async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    await graphService.permanentDeleteGraph(req.supabase!, id, req.user.id);
    res.json({ message: "图谱已永久删除" });
  },
);

export default router;
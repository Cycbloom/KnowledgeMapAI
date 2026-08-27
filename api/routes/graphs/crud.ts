import { Router, type Response } from "express";
import {
  requireAuth,
  optionalAuth,
  type AuthedRequest,
  type OptionalAuthRequest,
} from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { validate as validateInput } from "../../utils/validation";
import * as v2Schemas from "../../utils/schemas";
import {
  createGraphSchema,
  updateGraphSchema,
  uuidParamsSchema,
  shareGraphSchema,
  checkTopicSchema,
  batchOperationSchema,
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
import { requireGraphOwnership } from "../../middleware/ownership";
import { cacheService } from "../../services/common";
import { logger } from "../../utils/logger";
import { logSecurityEvent, createSecurityEvent } from "../../services/audit/auditService";
import { z } from "zod";

const router = Router();

// List all graphs for the user (Auth Required)
router.get("/", requireAuth, async (req: AuthedRequest, res: Response) => {
  const supabase = req.supabase;
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
router.get("/trash", requireAuth, async (req: AuthedRequest, res: Response) => {
  const data = await graphService.listTrash(req.supabase, req.user.id);
  res.json(data);
});

router.get("/map", requireAuth, async (req: AuthedRequest, res: Response) => {
  const data = await graphCrudService.getGraphMap(req.supabase, req.user.id);
  res.json(data);
});

// Get all tags from user's graphs
router.get("/tags", requireAuth, async (req: AuthedRequest, res: Response) => {
  const data = await graphCrudService.getTags(req.supabase, req.user.id);
  res.json(data);
});

// Get all domains from user's graphs
router.get("/domains", requireAuth, async (req: AuthedRequest, res: Response) => {
  const data = await graphCrudService.getDomains(req.supabase, req.user.id);
  res.json(data);
});

router.get(
  "/map/analyze",
  requireAuth,
  async (req: AuthedRequest, res: Response) => {
    const data = await graphCrudService.analyzeMap(req.supabase, req.user.id);
    res.json(data);
  },
);

// Check if a topic is duplicate (Auth Required)
router.post(
  "/check-topic",
  requireAuth,
  validate({ body: checkTopicSchema }),
  async (req: AuthedRequest, res: Response) => {
    const { topic, exclude_graph_id } = req.body;

    const result = await graphService.checkTopicDuplicate(
      req.supabase,
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
  validateInput(v2Schemas.createGraphSchema),
  validate({ body: createGraphSchema }),
  async (req: AuthedRequest, res: Response) => {
    const { title, description, domains, template_type, preset_id, tags } = req.body;
    const data = await graphService.createGraph(
      req.supabase,
      req.user.id,
      title,
      description,
      {
        templateType: template_type,
        presetId: preset_id,
        tags,
        domains:
          domains && Array.isArray(domains) && domains.length > 0
            ? domains
            : undefined,
      },
    );

    res.status(201).json(data);
  },
);

router.get(
  "/intelligent-suggestions",
  requireAuth,
  async (req: AuthedRequest, res: Response) => {
    const userId = req.user.id;
    const graphIds = req.query.graph_ids
      ? (req.query.graph_ids as string).split(",")
      : undefined;

    const result = await relationDiscoveryService.getIntelligentSuggestions(
      req.supabase,
      userId,
      { graph_ids: graphIds },
    );

    res.json(result);
  },
);

// GET /api/graphs/:id/analysis/module-gaps - Detect new module needs
router.get(
  "/:id/analysis/module-gaps",
  requireAuth,
  validate({ params: uuidParamsSchema }),
  async (req: AuthedRequest, res: Response) => {
    const { id } = req.params;
    const result = await conceptAggregationService.detectNewModuleNeeds(
      req.supabase,
      id,
    );
    res.json(result);
  },
);

// GET /api/graphs/:id/analysis/module-overlap - Detect module overlaps
router.get(
  "/:id/analysis/module-overlap",
  requireAuth,
  validate({ params: uuidParamsSchema }),
  async (req: AuthedRequest, res: Response) => {
    const { id } = req.params;
    const result = await conceptAggregationService.detectModuleOverlap(
      req.supabase,
      id,
    );
    res.json(result);
  },
);

router.get(
  "/:id/literature",
  requireAuth,
  validate({ params: uuidParamsSchema }),
  async (req: AuthedRequest, res: Response) => {
    const { id } = req.params;
    const moduleFilter = req.query.module as string | undefined;

    const data = await graphCrudService.getLiterature(req.supabase, id, moduleFilter);
    res.json(data);
  },
);

router.get(
  "/:id",
  optionalAuth,
  validate({ params: uuidParamsSchema }),
  async (req: OptionalAuthRequest, res: Response) => {
    const { id } = req.params;
    const userId = req.user?.id || null;
    if (!req.supabase) {
      throw new AppError("Supabase client not available", 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }

    const data = await graphService.getGraph(req.supabase, id, userId);
    if (!data) {
      throw new AppError("未找到该图谱", 404, ErrorCodes.RESOURCE_GRAPH_NOT_FOUND);
    }

    if (userId) {
      graphDomainService.migrateGraphDomainIfNeeded(req.supabase, id, userId).catch((err) =>
        logger.warn("懒迁移领域失败:", err),
      );
    }

    const domains = await graphDomainService.getGraphDomains(req.supabase, id);

    res.json({ ...data, domains });
  },
);

// Update a graph (Auth Required - Owner Only)
router.put(
  "/:id",
  requireAuth,
  validateInput(v2Schemas.updateGraphSchema),
  validate({ params: uuidParamsSchema, body: updateGraphSchema }),
  requireGraphOwnership,
  async (req: AuthedRequest, res: Response) => {
    const { id } = req.params;
    const { domains, ...updates } = req.body;
    const data = await graphService.updateGraph(
      req.supabase,
      id,
      req.user.id,
      updates,
    );

    if (domains) {
      await graphDomainService.updateGraphDomains(req.supabase, id, domains);
    }

    res.json(data);
  },
);

// Toggle Public Status
router.put(
  "/:id/share",
  requireAuth,
  validate({ params: uuidParamsSchema, body: shareGraphSchema }),
  requireGraphOwnership,
  async (req: AuthedRequest, res: Response) => {
    const { id } = req.params;
    const { is_public } = req.body;

    const data = await graphService.updateGraph(
      req.supabase,
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
  requireGraphOwnership,
  async (req: AuthedRequest, res: Response) => {
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
      req.supabase,
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
  requireGraphOwnership,
  async (req: AuthedRequest, res: Response) => {
    const { id } = req.params;
    const { viewMode } = req.body;

    const data = await graphCrudService.updateViewMode(
      req.supabase,
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
  requireGraphOwnership,
  async (req: AuthedRequest, res: Response) => {
    const { id } = req.params;
    await graphService.deleteGraph(req.supabase, id, req.user.id);

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
  async (req: AuthedRequest, res: Response) => {
    const { ids } = req.body;
    const result = await graphService.restoreGraphs(
      req.supabase,
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
  async (req: AuthedRequest, res: Response) => {
    const { ids } = req.body;
    const result = await graphService.deleteGraphs(
      req.supabase,
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
  async (req: AuthedRequest, res: Response) => {
    const { ids } = req.body;
    const result = await graphService.permanentDeleteGraphs(
      req.supabase,
      ids,
      req.user.id,
    );
    await logSecurityEvent(createSecurityEvent('ACCOUNT_DELETE', req, {
      targetType: 'graph',
      targetIds: ids,
      count: result.count,
      action: 'batch_permanent_delete',
    }));
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
  async (req: AuthedRequest, res: Response) => {
    const { id } = req.params;
    await graphService.restoreGraph(req.supabase, id, req.user.id);
    res.json({ message: "图谱已恢复" });
  },
);

// Permanently Delete a graph
router.delete(
  "/:id/permanent",
  requireAuth,
  validate({ params: uuidParamsSchema }),
  requireGraphOwnership,
  async (req: AuthedRequest, res: Response) => {
    const { id } = req.params;
    await graphService.permanentDeleteGraph(req.supabase, id, req.user.id);
    await logSecurityEvent(createSecurityEvent('ACCOUNT_DELETE', req, {
      targetType: 'graph',
      targetId: id,
      action: 'permanent_delete',
    }));
    res.json({ message: "图谱已永久删除" });
  },
);

export default router;
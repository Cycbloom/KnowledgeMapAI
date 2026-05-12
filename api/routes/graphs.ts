import { Router, type Response } from "express";
import {
  requireAuth,
  optionalAuth,
  type AuthRequest,
} from "../middleware/auth";
import { validate } from "../middleware/validate";
import {
  createGraphSchema,
  updateGraphSchema,
  uuidParamsSchema,
  shareGraphSchema,
} from "../schemas/index";
import { graphService } from "../services/graph/index";
import { taskService } from "../services/taskService";
import { aiService } from "../services/ai/aiService";
import { domainContextService } from "../services/ai/domainContextService";
import { ErrorCodes } from "../../shared/types/errorCodes";
import { AppError } from "../middleware/errorHandler";
import { achievementService } from "../services/achievementService";
import { cacheService } from "../services/common/cacheService";
import { logger } from "../utils/logger";
import { relationDiscoveryService } from "../services/graph/index";
import { checkDuplicateGraphTopic } from "../utils/similaritySearch";
import { backboneValidatorService } from "../services/ai/backboneValidatorService";
import { z } from "zod";
import { BackboneModule, TITLE_TO_BACKBONE_MODULE } from "@shared/types/graph";

const checkTopicSchema = z.object({
  topic: z.string().min(2).max(200),
  exclude_graph_id: z.string().uuid().optional(),
});

const batchOperationSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(50),
});

const analyzeDomainSchema = z.object({
  domain: z.string().min(2).max(200),
  count: z.number().min(5).max(30).default(10),
  context_domain_id: z.string().uuid().optional(),
});

const expandDomainSchema = z
  .object({
    graph_ids: z.array(z.string().uuid()).optional(),
    domain: z.string().uuid().max(100).optional(),
    count: z.number().int().min(1).max(30).default(10),
  })
  .refine(
    (data) => (data.graph_ids && data.graph_ids.length > 0) || data.domain,
    {
      message: "必须提供 graph_ids 或 domain 中的至少一个",
    },
  );

const batchCreateDomainGraphsSchema = z.object({
  graphs: z
    .array(
      z.object({
        title: z.string().min(2).max(200),
        description: z.string().max(1000).optional(),
      }),
    )
    .min(1)
    .max(30),
  domain: z.string().max(255).optional(),
  domain_id: z.string().uuid().optional(),
  relations: z
    .array(
      z.object({
        from_title: z.string(),
        to_title: z.string(),
        type: z.enum(["prerequisite", "extension", "related"]),
        reason: z.string().optional(),
      }),
    )
    .optional(),
});

const router = Router();

async function migrateGraphDomainIfNeeded(
  supabase: AuthRequest["supabase"],
  graphId: string,
  userId: string,
) {
  if (!supabase) return;
  const { data: graph } = await supabase
    .from("knowledge_graphs")
    .select("domain")
    .eq("id", graphId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!graph?.domain) return;
  const { data: existing } = await supabase
    .from("graph_domains")
    .select("id")
    .eq("graph_id", graphId)
    .maybeSingle();
  if (existing) return;
  const { data: domain } = await supabase
    .from("domains")
    .select("id")
    .eq("name", graph.domain)
    .eq("user_id", userId)
    .maybeSingle();
  if (!domain) return;
  const { error } = await supabase.from("graph_domains").insert({
    graph_id: graphId,
    domain_id: domain.id,
    is_primary: true,
  });
  if (error) {
    logger.warn("懒迁移 graph_domains 失败", { graphId, error: error.message });
  } else {
    logger.info("懒迁移 graph_domains 成功", {
      graphId,
      domainName: graph.domain,
    });
  }
}

async function getGraphDomains(
  supabase: AuthRequest["supabase"],
  graphId: string,
) {
  if (!supabase) return [];
  const { data: graphDomains } = await supabase
    .from("graph_domains")
    .select(
      `
      id, graph_id, domain_id, is_primary, created_at,
      domains(id, name, description, color, icon, parent_id, sort_order, is_system)
    `,
    )
    .eq("graph_id", graphId);
  return (
    graphDomains
      ?.map((gd) => {
        const domain = Array.isArray(gd.domains) ? gd.domains[0] : gd.domains;
        if (!domain) return null;
        return {
          id: domain.id,
          name: domain.name,
          description: domain.description,
          color: domain.color,
          icon: domain.icon,
          parent_id: domain.parent_id,
          sort_order: domain.sort_order,
          is_system: domain.is_system,
          is_primary: gd.is_primary,
        };
      })
      .filter(Boolean) || []
  );
}

async function updateGraphDomains(
  supabase: AuthRequest["supabase"],
  graphId: string,
  domains: Array<{ domain_id: string; is_primary?: boolean }> | undefined,
) {
  if (!supabase || !domains) return;
  const hasPrimary = domains.some((d) => d.is_primary);
  const normalized = domains.map((d) => ({
    ...d,
    is_primary: hasPrimary ? d.is_primary : domains.indexOf(d) === 0,
  }));
  await supabase.from("graph_domains").delete().eq("graph_id", graphId);
  if (normalized.length > 0) {
    const { error } = await supabase.from("graph_domains").insert(
      normalized.map((d) => ({
        graph_id: graphId,
        domain_id: d.domain_id,
        is_primary: d.is_primary ?? false,
      })),
    );
    if (error) {
      logger.error("更新 graph_domains 失败", {
        graphId,
        error: error.message,
      });
      throw error;
    }
    logger.info(`已更新图谱 ${graphId} 的 ${normalized.length} 个领域关联`);
  }
}

// List all graphs for the user (Auth Required)
router.get("/", requireAuth, async (req: AuthRequest, res: Response) => {
  const supabase = req.supabase!;
  const userId = req.user.id;
  const domainId = req.query.domain_id as string | undefined;
  const domainIdsStr = req.query.domain_ids as string | undefined;

  if (domainIdsStr || domainId) {
    let filteredGraphIds: string[] = [];
    if (domainIdsStr) {
      const ids = domainIdsStr
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean);
      if (ids.length === 0) {
        return res.json({ graphs: [], total: 0 });
      }
      const { data: graphDomains } = await supabase
        .from("graph_domains")
        .select("graph_id")
        .in("domain_id", ids);
      filteredGraphIds =
        graphDomains?.map((gd) => gd.graph_id).filter(Boolean) || [];
    } else if (domainId) {
      const { data: graphDomains } = await supabase
        .from("graph_domains")
        .select("graph_id")
        .eq("domain_id", domainId);
      filteredGraphIds =
        graphDomains?.map((gd) => gd.graph_id).filter(Boolean) || [];
    }

    if (filteredGraphIds.length === 0) {
      return res.json({ graphs: [], total: 0 });
    }

    const { data: graphs, error } = await supabase
      .from("knowledge_graphs")
      .select("*")
      .eq("user_id", userId)
      .in("id", filteredGraphIds)
      .is("deleted_at", null)
      .order("is_favorite", { ascending: false })
      .order("last_used_at", { ascending: false });

    if (error) throw error;

    const graphIds = graphs?.map((g) => g.id) || [];
    const countMap = new Map<string, number>();
    if (graphIds.length > 0) {
      const { data: nodeCounts } = await supabase
        .from("graph_nodes")
        .select("graph_id")
        .in("graph_id", graphIds)
        .is("deleted_at", null);
      nodeCounts?.forEach((n) => {
        countMap.set(n.graph_id, (countMap.get(n.graph_id) || 0) + 1);
      });
    }

    const result = (graphs || []).map((g) => ({
      id: g.id,
      user_id: g.user_id,
      title: g.title,
      description: g.description,
      is_public: g.is_public,
      is_favorite: g.is_favorite,
      created_at: g.created_at,
      updated_at: g.updated_at,
      deleted_at: g.deleted_at,
      nodes_count: countMap.get(g.id) || 0,
      template_type: g.template_type,
    }));

    return res.json({ graphs: result, total: result.length });
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
  const supabase = req.supabase!;
  const userId = req.user.id;

  const { data: graphs } = await supabase
    .from("knowledge_graphs")
    .select("id, title, description, created_at, is_public, domain")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .order("last_used_at", { ascending: false });

  const graphIds = (graphs || []).map((g) => g.id);

  const [nodeCountsResult, relationsResult] = await Promise.all([
    supabase
      .from("graph_nodes")
      .select("graph_id")
      .in("graph_id", graphIds)
      .is("deleted_at", null),
    supabase
      .from("graph_relations")
      .select(
        "id, source_graph_id, target_graph_id, relation_type, context, metadata, created_at",
      )
      .or(
        `source_graph_id.in.(${graphIds.join(
          ",",
        )}),target_graph_id.in.(${graphIds.join(",")})`,
      ),
  ]);

  const nodeCountMap = new Map<string, number>();
  (nodeCountsResult.data || []).forEach((n) => {
    nodeCountMap.set(n.graph_id, (nodeCountMap.get(n.graph_id) || 0) + 1);
  });

  const graphsWithCounts = (graphs || []).map((g) => ({
    ...g,
    node_count: nodeCountMap.get(g.id) || 0,
  }));

  res.json({
    graphs: graphsWithCounts,
    relations: relationsResult.data || [],
  });
});

// Get all tags from user's graphs
router.get("/tags", requireAuth, async (req: AuthRequest, res: Response) => {
  const supabase = req.supabase!;
  const userId = req.user.id;

  const { data: graphs } = await supabase
    .from("knowledge_graphs")
    .select("id")
    .eq("user_id", userId)
    .is("deleted_at", null);

  const graphIds = (graphs || []).map((g) => g.id);

  if (graphIds.length === 0) {
    res.json({ tags: [] });
    return;
  }

  const { data: graphNodes } = await supabase
    .from("graph_nodes")
    .select(
      `
      graph_id,
      knowledge_points (
        properties
      )
    `,
    )
    .in("graph_id", graphIds)
    .is("deleted_at", null);

  const tagMap = new Map<string, number>();

  (graphNodes || []).forEach((gn: any) => {
    const tags = gn.knowledge_points?.properties?.tags || [];
    tags.forEach((tag: string) => {
      tagMap.set(tag, (tagMap.get(tag) || 0) + 1);
    });
  });

  const tags = Array.from(tagMap.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  res.json({ tags });
});

// Get all domains from user's graphs
router.get("/domains", requireAuth, async (req: AuthRequest, res: Response) => {
  const supabase = req.supabase;
  if (!supabase) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const userId = req.user.id;

  const { data: graphs } = await supabase
    .from("knowledge_graphs")
    .select("domain")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .not("domain", "is", null);

  const domainMap = new Map<string, number>();
  (graphs || []).forEach((g) => {
    if (g.domain) {
      domainMap.set(g.domain, (domainMap.get(g.domain) || 0) + 1);
    }
  });

  const domains = Array.from(domainMap.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  res.json({ domains });
});

router.get(
  "/map/analyze",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase!;
    const userId = req.user.id;

    const { data: graphs } = await supabase
      .from("knowledge_graphs")
      .select("id, title, description")
      .eq("user_id", userId)
      .is("deleted_at", null);

    const graphIds = (graphs || []).map((g) => g.id);

    const { data: relations } = await supabase
      .from("graph_relations")
      .select("source_graph_id, target_graph_id, relation_type")
      .or(
        `source_graph_id.in.(${graphIds.join(
          ",",
        )}),target_graph_id.in.(${graphIds.join(",")})`,
      );

    const connectedGraphIds = new Set<string>();
    (relations || []).forEach((r) => {
      connectedGraphIds.add(r.source_graph_id);
      connectedGraphIds.add(r.target_graph_id);
    });

    const isolatedGraphs = (graphs || [])
      .filter((g) => !connectedGraphIds.has(g.id))
      .map((g) => ({ id: g.id, title: g.title }));

    const graphRelationCount = new Map<string, number>();
    (relations || []).forEach((r) => {
      graphRelationCount.set(
        r.source_graph_id,
        (graphRelationCount.get(r.source_graph_id) || 0) + 1,
      );
      graphRelationCount.set(
        r.target_graph_id,
        (graphRelationCount.get(r.target_graph_id) || 0) + 1,
      );
    });

    const missingPrerequisites = (graphs || [])
      .filter((g) => {
        const asTarget = (relations || []).filter(
          (r) =>
            r.target_graph_id === g.id && r.relation_type === "prerequisite",
        );
        return asTarget.length === 0 && (graphRelationCount.get(g.id) || 0) > 0;
      })
      .slice(0, 5)
      .map((g) => ({
        graph_id: g.id,
        graph_title: g.title,
        suggested_topics: ["基础概念", "入门知识", "前置理论"].slice(0, 2),
      }));

    const suggestedPaths: Array<{
      from: string;
      from_title: string;
      to: string;
      to_title: string;
      via: string[];
    }> = [];

    const graphMap = new Map((graphs || []).map((g) => [g.id, g.title]));

    (relations || []).forEach((r) => {
      if (r.relation_type === "prerequisite" && suggestedPaths.length < 5) {
        const fromGraph = graphMap.get(r.target_graph_id);
        const toGraph = graphMap.get(r.source_graph_id);
        if (fromGraph && toGraph) {
          suggestedPaths.push({
            from: r.target_graph_id,
            from_title: fromGraph,
            to: r.source_graph_id,
            to_title: toGraph,
            via: [],
          });
        }
      }
    });

    const mergeSuggestions: Array<{
      graph_ids: string[];
      graph_titles: string[];
      reason: string;
    }> = [];

    const titleGroups = new Map<string, string[]>();
    (graphs || []).forEach((g) => {
      const key = g.title.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]/g, "");
      if (!titleGroups.has(key)) titleGroups.set(key, []);
      titleGroups.get(key)!.push(g.id);
    });

    titleGroups.forEach((ids, _key) => {
      if (ids.length > 1) {
        mergeSuggestions.push({
          graph_ids: ids,
          graph_titles: ids.map((id) => graphMap.get(id) || ""),
          reason: "图谱名称相似，可能存在重复",
        });
      }
    });

    res.json({
      isolated_graphs: isolatedGraphs,
      missing_prerequisites: missingPrerequisites,
      suggested_paths: suggestedPaths,
      merge_suggestions: mergeSuggestions.slice(0, 3),
    });
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
    const { title, description, domains, template_type } = req.body;
    const data = await graphService.createGraph(
      req.supabase!,
      req.user.id,
      title,
      description,
      { templateType: template_type },
    );

    if (domains && Array.isArray(domains) && domains.length > 0) {
      await updateGraphDomains(req.supabase, data.id, domains);
    }

    // Update achievements
    achievementService
      .updateCreationStats(req.user.id)
      .catch((err) => logger.error("Achievement update failed:", err));

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
      throw new AppError(message, 500, ErrorCodes.INTERNAL_ERROR);
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
      throw new AppError("未找到该图谱", 404, ErrorCodes.GRAPH_NOT_FOUND);
    }

    if (userId && req.supabase) {
      migrateGraphDomainIfNeeded(req.supabase, id, userId).catch((err) =>
        logger.warn("懒迁移领域失败:", err),
      );
    }

    const domains = await getGraphDomains(req.supabase, id);

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
      await updateGraphDomains(req.supabase, id, domains);
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

// Get nodes and edges for a graph (Optional Auth)
router.get(
  "/:id/nodes",
  optionalAuth,
  validate({ params: uuidParamsSchema }),
  async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const userId = req.user?.id || null;
    const data = await graphService.getGraphNodes(req.supabase!, userId, id);

    // Update last_used_at when user opens their own graph
    if (userId) {
      graphService
        .updateLastUsedAt(req.supabase!, id, userId)
        .catch((err) => logger.error("Update last used at failed:", err));
    }

    res.json(data);
  },
);

// Get node status (Optional Auth - Public view has no status)
router.get(
  "/:id/node-status",
  optionalAuth,
  validate({ params: uuidParamsSchema }),
  async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const userId = req.user?.id || null;
    const data = userId
      ? await graphService.getGraphNodeStatus(req.supabase!, userId, id)
      : [];
    res.json(data);
  },
);

// Get learning path for a graph (Optional Auth)
router.get(
  "/:id/learning-path",
  optionalAuth,
  validate({ params: uuidParamsSchema }),
  async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const userId = req.user?.id || null;

    // Reuse logic: users can see path if they can see the graph
    const data = await graphService.getLearningPath(req.supabase!, userId, id);
    res.json({ path: data });
  },
);

// Analyze graph structure (Auth Required)
router.get(
  "/:id/analyze",
  requireAuth,
  validate({ params: uuidParamsSchema }),
  async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const userId = req.user.id;

    try {
      const analysis = await graphService.analyzeGraph(
        req.supabase!,
        userId,
        id,
      );
      res.json(analysis);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "图谱分析失败";
      throw new AppError(message, 500, ErrorCodes.INTERNAL_ERROR);
    }
  },
);

// Get missing connection suggestions (Auth Required)
router.get(
  "/:id/missing-connections",
  requireAuth,
  validate({ params: uuidParamsSchema }),
  async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const userId = req.user.id;
    const maxSuggestions = parseInt(req.query.max as string) || 10;

    try {
      const suggestions = await graphService.findMissingConnections(
        req.supabase!,
        userId,
        id,
        maxSuggestions,
      );
      res.json({ suggestions });
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "获取连接建议失败";
      throw new AppError(message, 500, ErrorCodes.INTERNAL_ERROR);
    }
  },
);

// Analyze domain topic and return recommended graphs (Auth Required)
router.post(
  "/domain/analyze",
  requireAuth,
  validate({ body: analyzeDomainSchema }),
  async (req: AuthRequest, res: Response) => {
    const { domain, count = 10, context_domain_id, session_id } = req.body;
    const userId = req.user.id;

    try {
      const { data: existingGraphs } = await req
        .supabase!.from("knowledge_graphs")
        .select("id, title, description")
        .eq("user_id", userId)
        .is("deleted_at", null);

      const existingTitles = (existingGraphs || []).map((g) =>
        g.title.toLowerCase(),
      );

      let domainContext = "";
      let domainName = "";

      if (context_domain_id) {
        try {
          const context = await domainContextService.getDomainContext(
            req.supabase!,
            context_domain_id,
            userId,
          );
          domainContext = context;

          const { data: domainInfo } = await req
            .supabase!.from("domains")
            .select("name")
            .eq("id", context_domain_id)
            .single();
          domainName = domainInfo?.name || "";

          logger.info("使用领域上下文进行分析", {
            domainId: context_domain_id,
            domainName,
            userId,
          });
        } catch (error) {
          logger.warn("获取领域上下文失败，将使用全局分析", {
            domainId: context_domain_id,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      const basePrompt = `你是知识图谱专家。用户想学习「${domain}」领域。

请推荐 ${count} 个该领域的知识图谱主题，并分析它们之间的学习依赖关系。

要求：
1. 推荐主题覆盖领域各方面，避免重复
2. 分析主题之间的学习依赖关系（如：学A之前需要先学B）
3. 优先级：high(核心基础)/medium(重要内容)/low(扩展内容)
4. 简述不超过60字
${domainContext ? `5. 基于上述已有内容，推荐新的、不重复的知识点\n6. 避免推荐与已有图谱主题过于相似的内容` : ""}

返回JSON格式：
{
  "graphs": [
    {"title": "主题名", "description": "简述", "priority": "high/medium/low"}
  ],
  "relations": [
    {"from": "主题A", "to": "主题B", "type": "prerequisite", "reason": "A是B的前置知识"}
  ]
}

关系类型说明：
- prerequisite: from 是 to 的前置知识（学to之前需要先学from）
- extension: from 是 to 的扩展知识（学完to后可以学习from）
- related: from 和 to 相关但无直接依赖

已有图谱：${existingTitles.length > 0 ? existingTitles.slice(0, 15).join("、") : "无"}`;

      const finalPrompt = domainContext
        ? domainContextService.buildDomainAwarePrompt(
            basePrompt,
            domainContext,
            domainName,
          )
        : basePrompt;

      const response = await aiService.chat(
        [
          {
            role: "system",
            content:
              "你是一个知识图谱专家，擅长分析领域知识结构、推荐学习路径、识别知识点之间的依赖关系。请用中文回复。确保返回有效的JSON格式。",
          },
          { role: "user", content: finalPrompt },
        ],
        { timeout: 60000, sessionId: session_id, operation: "domain_analysis" },
      );

      let recommendations: Array<{
        title: string;
        description: string;
        priority: "high" | "medium" | "low";
      }> = [];

      let graphRelations: Array<{
        from_title: string;
        to_title: string;
        type: "prerequisite" | "extension" | "related";
        reason?: string;
      }> = [];

      try {
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          const graphs =
            parsed.graphs || parsed.list || parsed.recommendations || [];

          for (const item of graphs) {
            if (typeof item === "string") {
              const parts = item.split("|");
              if (parts.length >= 3) {
                const [title, description, priority] = parts.map((s) =>
                  s.trim(),
                );
                if (title && !existingTitles.includes(title.toLowerCase())) {
                  recommendations.push({
                    title,
                    description: description || "",
                    priority: (["high", "medium", "low"].includes(priority)
                      ? priority
                      : "medium") as "high" | "medium" | "low",
                  });
                }
              }
            } else if (typeof item === "object" && item.title) {
              if (!existingTitles.includes(item.title.toLowerCase())) {
                recommendations.push({
                  title: item.title,
                  description: item.description || "",
                  priority: item.priority || "medium",
                });
              }
            }
          }

          const relations = parsed.relations || [];
          for (const rel of relations) {
            if (rel.from && rel.to && rel.type) {
              graphRelations.push({
                from_title: rel.from,
                to_title: rel.to,
                type: rel.type as "prerequisite" | "extension" | "related",
                reason: rel.reason,
              });
            }
          }
        }
      } catch {
        logger.warn("Failed to parse domain analysis response as JSON");
      }

      if (domainContext && existingTitles.length > 0) {
        const beforeCount = recommendations.length;
        const existingSet = new Set(existingTitles.map((t) => t.toLowerCase()));
        recommendations = recommendations.filter((rec) => {
          const titleLower = rec.title.toLowerCase();
          const isTooSimilar = Array.from(existingSet).some(
            (existing) =>
              titleLower.includes(existing) || existing.includes(titleLower),
          );
          return !isTooSimilar;
        });

        if (recommendations.length !== beforeCount) {
          logger.info("应用领域上下文过滤", {
            before: beforeCount,
            after: recommendations.length,
          });
        }
      }

      const validTitles = new Set(
        recommendations.map((r) => r.title.toLowerCase()),
      );
      const existingTitlesSet = new Set(existingTitles);

      graphRelations = graphRelations.filter((rel) => {
        const fromLower = rel.from_title.toLowerCase();
        const toLower = rel.to_title.toLowerCase();
        const fromIsValid =
          validTitles.has(fromLower) || existingTitlesSet.has(fromLower);
        const toIsValid =
          validTitles.has(toLower) || existingTitlesSet.has(toLower);
        return fromIsValid && toIsValid;
      });

      const priorityOrder = { high: 0, medium: 1, low: 2 };
      recommendations.sort((a, b) => {
        const priorityDiff =
          priorityOrder[a.priority] - priorityOrder[b.priority];
        if (priorityDiff !== 0) return priorityDiff;
        return a.title.localeCompare(b.title, "zh-CN");
      });

      res.json({
        recommendations: recommendations.slice(0, count),
        relations: graphRelations,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "领域分析失败";
      throw new AppError(message, 500, ErrorCodes.INTERNAL_ERROR);
    }
  },
);

// Expand from existing graphs (Auth Required)
router.post(
  "/domain/expand",
  requireAuth,
  validate({ body: expandDomainSchema }),
  async (req: AuthRequest, res: Response) => {
    const { graph_ids, domain, count = 10 } = req.body;
    const userId = req.user.id;
    const supabase = req.supabase!;

    try {
      let sourceGraphs: Array<{
        id: string;
        title: string;
        description: string | null;
        domain: string | null;
      }> = [];

      if (graph_ids && graph_ids.length > 0) {
        const { data: graphsById } = await supabase
          .from("knowledge_graphs")
          .select("id, title, description, domain")
          .eq("user_id", userId)
          .in("id", graph_ids)
          .is("deleted_at", null);

        if (graphsById) {
          sourceGraphs.push(...graphsById);
        }
      }

      if (domain && domain.trim()) {
        const { data: graphsByDomain } = await supabase
          .from("knowledge_graphs")
          .select("id, title, description, domain")
          .eq("user_id", userId)
          .ilike("domain", `%${domain.trim()}%`)
          .is("deleted_at", null);

        if (graphsByDomain) {
          const existingIds = new Set(sourceGraphs.map((g) => g.id));
          for (const g of graphsByDomain) {
            if (!existingIds.has(g.id)) {
              sourceGraphs.push(g);
            }
          }
        }
      }

      let targetDomainId: string | null = null;
      let targetDomainName: string | null = null;

      if (domain) {
        if (
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
            domain,
          )
        ) {
          const { data: domainData } = await supabase
            .from("domains")
            .select("id, name")
            .eq("id", domain)
            .is("deleted_at", null)
            .single();

          if (domainData) {
            targetDomainId = domainData.id;
            targetDomainName = domainData.name;
          }
        } else {
          const { data: domainData } = await supabase
            .from("domains")
            .select("id, name")
            .eq("name", domain)
            .or(`user_id.eq.${userId},and(is_system.eq.true,user_id.is.null)`)
            .is("deleted_at", null)
            .maybeSingle();

          if (domainData) {
            targetDomainId = domainData.id;
            targetDomainName = domainData.name;
          }
        }
      }

      if (sourceGraphs.length === 0) {
        throw new AppError("未找到选中的图谱或领域", 404, ErrorCodes.NOT_FOUND);
      }

      const { data: existingGraphs } = await supabase
        .from("knowledge_graphs")
        .select("id, title, description")
        .eq("user_id", userId)
        .is("deleted_at", null);

      const existingTitles = (existingGraphs || []).map((g) =>
        g.title.toLowerCase(),
      );

      let domainContext = "";

      if (targetDomainId) {
        try {
          domainContext = await domainContextService.getDomainContext(
            supabase,
            targetDomainId,
            userId,
          );
          logger.info("扩展分析使用领域上下文", {
            domainId: targetDomainId,
            domainName: targetDomainName,
          });
        } catch (error) {
          logger.warn("获取扩展领域上下文失败", { error });
        }
      }

      const basePrompt = `你是知识图谱专家。基于用户已有的知识图谱，推荐相关的扩展学习内容。

${sourceGraphs.length > 0 ? `用户已有 ${sourceGraphs.length} 个图谱：\n${sourceGraphs.map((g, i) => `${i + 1}. ${g.title}${g.description ? ` - ${g.description}` : ""}`).join("\n")}` : ""}

${domainContext ? `\n[目标领域上下文 - ${targetDomainName}]\n${domainContext}\n[/目标领域上下文]` : ""}

${targetDomainName ? `\n请优先推荐与「${targetDomainName}」领域相关的扩展方向。` : ""}

请推荐 ${count} 个扩展知识图谱，并分析它们之间的学习依赖关系。

要求：
1. 推荐与现有图谱相关的主题，帮助用户扩展知识体系
2. 分析推荐图谱之间的学习依赖关系（如：学A之前需要先学B）
3. **重要**：分析推荐图谱与现有图谱之间的关系（如：推荐图谱X是现有图谱Y的前置知识/扩展知识）
4. 优先级：high(核心扩展)/medium(重要扩展)/low(可选扩展)
5. 简述不超过60字

返回JSON格式：
{
  "graphs": [
    {"title": "主题名", "description": "简述", "priority": "high/medium/low"}
  ],
  "relations": [
    {"from": "主题A", "to": "主题B", "type": "prerequisite", "reason": "A是B的前置知识"}
  ]
}

关系类型说明：
- prerequisite: from 是 to 的前置知识（学to之前需要先学from）
- extension: from 是 to 的扩展知识（学完to后可以学习from）
- related: from 和 to 相关但无直接依赖

**重要提示**：
- relations 中可以包含推荐图谱之间的关系
- 也可以包含推荐图谱与现有图谱之间的关系（from 或 to 可以是现有图谱的名称）
- 请尽可能多地建立推荐图谱与现有图谱之间的连接

已有图谱（不要重复推荐）：${existingTitles.length > 0 ? existingTitles.join("、") : "无"}`;

      const response = await aiService.chat(
        [
          {
            role: "system",
            content:
              "你是一个知识图谱专家，擅长分析领域知识结构、推荐学习路径、识别知识点之间的依赖关系。请用中文回复。确保返回有效的JSON格式。",
          },
          { role: "user", content: basePrompt },
        ],
        { timeout: 60000 },
      );

      let recommendations: Array<{
        title: string;
        description: string;
        priority: "high" | "medium" | "low";
      }> = [];

      let graphRelations: Array<{
        from_title: string;
        to_title: string;
        type: "prerequisite" | "extension" | "related";
        reason?: string;
      }> = [];

      try {
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          const graphs =
            parsed.graphs || parsed.list || parsed.recommendations || [];

          for (const item of graphs) {
            if (typeof item === "string") {
              const parts = item.split("|");
              if (parts.length >= 3) {
                const [title, description, priority] = parts.map((s) =>
                  s.trim(),
                );
                if (title && !existingTitles.includes(title.toLowerCase())) {
                  recommendations.push({
                    title,
                    description: description || "",
                    priority: (["high", "medium", "low"].includes(priority)
                      ? priority
                      : "medium") as "high" | "medium" | "low",
                  });
                }
              }
            } else if (typeof item === "object" && item.title) {
              if (!existingTitles.includes(item.title.toLowerCase())) {
                recommendations.push({
                  title: item.title,
                  description: item.description || "",
                  priority: item.priority || "medium",
                });
              }
            }
          }

          const relations = parsed.relations || [];
          for (const rel of relations) {
            if (rel.from && rel.to && rel.type) {
              graphRelations.push({
                from_title: rel.from,
                to_title: rel.to,
                type: rel.type as "prerequisite" | "extension" | "related",
                reason: rel.reason,
              });
            }
          }
        }
      } catch {
        logger.warn("Failed to parse domain expansion response as JSON");
      }

      const validTitles = new Set(
        recommendations.map((r) => r.title.toLowerCase()),
      );
      const existingTitlesSet = new Set(existingTitles);

      graphRelations = graphRelations.filter((rel) => {
        const fromLower = rel.from_title.toLowerCase();
        const toLower = rel.to_title.toLowerCase();
        const fromIsValid =
          validTitles.has(fromLower) || existingTitlesSet.has(fromLower);
        const toIsValid =
          validTitles.has(toLower) || existingTitlesSet.has(toLower);
        return fromIsValid && toIsValid;
      });

      const priorityOrder = { high: 0, medium: 1, low: 2 };
      recommendations.sort((a, b) => {
        const priorityDiff =
          priorityOrder[a.priority] - priorityOrder[b.priority];
        if (priorityDiff !== 0) return priorityDiff;
        return a.title.localeCompare(b.title, "zh-CN");
      });

      res.json({
        recommendations: recommendations.slice(0, count),
        relations: graphRelations,
        source_graphs: sourceGraphs,
        ...(targetDomainId
          ? { target_domain: { id: targetDomainId, name: targetDomainName } }
          : {}),
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "领域扩展失败";
      throw new AppError(message, 500, ErrorCodes.INTERNAL_ERROR);
    }
  },
);

// Batch create domain graphs (Auth Required)
router.post(
  "/domain/batch-create",
  requireAuth,
  validate({ body: batchCreateDomainGraphsSchema }),
  async (req: AuthRequest, res: Response) => {
    const { graphs, domain, domain_id, relations } = req.body;
    const userId = req.user.id;
    const supabase = req.supabase!;

    try {
      const results: Array<{
        graphId: string;
        title: string;
        isNew: boolean;
      }> = [];

      const failedItems: Array<{
        title: string;
        error: string;
        reason: "duplicate" | "db_error" | "invalid_data";
      }> = [];

      const titleToIdMap = new Map<string, string>();

      let resolvedDomainId: string | null = null;
      let resolvedDomainName: string | null = null;

      if (domain_id) {
        const { data: existingDomain, error: domainError } = await supabase
          .from("domains")
          .select("id, name")
          .eq("id", domain_id)
          .maybeSingle();

        if (domainError) {
          logger.error("Failed to query domain by ID:", domainError);
        } else if (existingDomain) {
          resolvedDomainId = existingDomain.id;
          resolvedDomainName = existingDomain.name;
        }
      } else if (domain) {
        const { data: existingDomain, error: domainError } = await supabase
          .from("domains")
          .select("id, name")
          .eq("name", domain)
          .eq("user_id", userId)
          .maybeSingle();

        if (domainError) {
          logger.error("Failed to query domain by name:", domainError);
        } else if (existingDomain) {
          resolvedDomainId = existingDomain.id;
          resolvedDomainName = existingDomain.name;
        } else {
          const { data: newDomain, error: createDomainError } = await supabase
            .from("domains")
            .insert({
              name: domain,
              user_id: userId,
              color: "#6366F1",
            })
            .select("id, name")
            .single();

          if (createDomainError || !newDomain) {
            logger.warn("Failed to create domain:", createDomainError);
          } else {
            resolvedDomainId = newDomain.id;
            resolvedDomainName = newDomain.name;
          }
        }
      }

      const { data: allExistingGraphs, error: queryError } = await supabase
        .from("knowledge_graphs")
        .select("id, title")
        .eq("user_id", userId)
        .is("deleted_at", null);

      if (queryError) {
        logger.error("Failed to query existing graphs:", queryError);
        throw new AppError("查询现有图谱失败", 500, ErrorCodes.INTERNAL_ERROR);
      }

      if (allExistingGraphs) {
        for (const g of allExistingGraphs) {
          titleToIdMap.set(g.title.toLowerCase(), g.id);
        }
      }

      for (const graphData of graphs) {
        try {
          if (!graphData.title || typeof graphData.title !== "string") {
            throw new Error(
              `Invalid data: title is required and must be a string`,
            );
          }

          const duplicateCheck = await checkDuplicateGraphTopic(
            supabase,
            userId,
            graphData.title,
            { threshold: 0.85 },
          );

          if (
            duplicateCheck.isDuplicate &&
            duplicateCheck.similarGraphs.length > 0
          ) {
            const similarGraph = duplicateCheck.similarGraphs[0];
            results.push({
              graphId: similarGraph.id,
              title: similarGraph.title,
              isNew: false,
            });
            titleToIdMap.set(graphData.title.toLowerCase(), similarGraph.id);
          } else {
            const { data: newGraph, error: createError } = await supabase
              .from("knowledge_graphs")
              .insert({
                user_id: userId,
                title: graphData.title,
                description: graphData.description || "",
                domain: resolvedDomainName || null,
                embedding: duplicateCheck.embedding,
              })
              .select()
              .single();

            if (createError || !newGraph) {
              throw new Error(
                `Database error: ${createError?.message || "Failed to create graph"}`,
              );
            }

            if (resolvedDomainId) {
              const { error: domainAssocError } = await supabase
                .from("graph_domains")
                .insert({
                  graph_id: newGraph.id,
                  domain_id: resolvedDomainId,
                  is_primary: true,
                });

              if (domainAssocError) {
                logger.warn("Failed to create graph_domains association:", {
                  graphId: newGraph.id,
                  domainId: resolvedDomainId,
                  error: domainAssocError.message,
                });
              }
            }

            results.push({
              graphId: newGraph.id,
              title: graphData.title,
              isNew: true,
            });
            titleToIdMap.set(graphData.title.toLowerCase(), newGraph.id);
          }
        } catch (error: unknown) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);

          let errorReason: "duplicate" | "db_error" | "invalid_data";
          if (
            errorMessage.toLowerCase().includes("duplicate") ||
            errorMessage.toLowerCase().includes("similar")
          ) {
            errorReason = "duplicate";
          } else if (
            errorMessage.toLowerCase().includes("database") ||
            errorMessage.toLowerCase().includes("db") ||
            errorMessage.toLowerCase().includes("insert") ||
            errorMessage.toLowerCase().includes("query")
          ) {
            errorReason = "db_error";
          } else {
            errorReason = "invalid_data";
          }

          failedItems.push({
            title: graphData.title || "(unknown)",
            error: errorMessage,
            reason: errorReason,
          });

          logger.warn(
            `Failed to process graph "${graphData.title}": ${errorMessage}`,
            { reason: errorReason },
          );

          continue;
        }
      }

      // 计算统计信息
      const successCount = results.length;
      const failedCount = failedItems.length;
      const skippedCount = results.filter((r) => !r.isNew).length;
      const totalCount = graphs.length;

      logger.info(`Batch create summary:`, {
        total: totalCount,
        success: successCount,
        failed: failedCount,
        skipped: skippedCount,
      });

      // 创建关系（带错误保护）
      if (relations && relations.length > 0) {
        try {
          logger.info(`Creating ${relations.length} relations between graphs`);

          const relationsToCreate: Array<{
            source_graph_id: string;
            target_graph_id: string;
            relation_type: string;
            context?: string;
          }> = [];

          const failedRelations: Array<{
            from_title: string;
            to_title: string;
            type: string;
            error: string;
          }> = [];

          for (const rel of relations) {
            try {
              const sourceId = titleToIdMap.get(rel.from_title.toLowerCase());
              const targetId = titleToIdMap.get(rel.to_title.toLowerCase());

              if (!sourceId || !targetId) {
                logger.warn(
                  `Skipping relation: graph not found - from: ${rel.from_title}, to: ${rel.to_title}`,
                );
                continue;
              }

              const { data: existingRelation, error: queryRelError } =
                await supabase
                  .from("graph_relations")
                  .select("id")
                  .eq("source_graph_id", sourceId)
                  .eq("target_graph_id", targetId)
                  .maybeSingle();

              if (queryRelError) {
                throw new Error(
                  `Query relation error: ${queryRelError.message}`,
                );
              }

              if (!existingRelation) {
                relationsToCreate.push({
                  source_graph_id: sourceId,
                  target_graph_id: targetId,
                  relation_type: rel.type,
                  context: rel.reason,
                });
                logger.info(
                  `Relation [${rel.type}]: ${rel.from_title} -> ${rel.to_title}${rel.reason ? ` (${rel.reason})` : ""}`,
                );
              } else {
                logger.info(
                  `Relation already exists: ${rel.from_title} -> ${rel.to_title}`,
                );
              }
            } catch (error: unknown) {
              const errorMessage =
                error instanceof Error ? error.message : String(error);
              failedRelations.push({
                from_title: rel.from_title,
                to_title: rel.to_title,
                type: rel.type,
                error: errorMessage,
              });
              logger.error(
                `Failed to process relation [${rel.type}]: ${rel.from_title} -> ${rel.to_title}: ${errorMessage}`,
              );
              // 继续处理下一个关系
            }
          }

          if (failedRelations.length > 0) {
            logger.warn(
              `${failedRelations.length} relations failed to process`,
              { failedRelations },
            );
          }

          if (relationsToCreate.length > 0) {
            logger.info(
              `Inserting ${relationsToCreate.length} relations into graph_relations`,
            );
            const { error: relationError } = await supabase
              .from("graph_relations")
              .insert(relationsToCreate);

            if (relationError) {
              logger.error("Failed to create relations:", relationError);
            } else {
              logger.info(
                `Successfully created ${relationsToCreate.length} relations`,
              );
            }
          }
        } catch (error: unknown) {
          // 关系创建的整体错误不应该影响主响应
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          logger.error(`Error during relation creation phase: ${errorMessage}`);
          // 不抛出错误，继续返回图谱创建结果
        }
      }

      res.json({
        created: results,
        failed: failedItems,
        summary: {
          total: totalCount,
          success: successCount,
          failed: failedCount,
          skipped: skippedCount,
        },
      });
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "批量创建图谱失败";
      throw new AppError(message, 500, ErrorCodes.INTERNAL_ERROR);
    }
  },
);

const initializeGraphSchema = z.object({
  style: z.enum(["academic", "practical", "beginner"]).default("academic"),
});

const batchInitializeSchema = z.object({
  graph_ids: z.array(z.string().uuid()).min(1).max(50),
  style: z.enum(["academic", "practical", "beginner"]).default("academic"),
});

router.post(
  "/batch-initialize",
  requireAuth,
  validate({ body: batchInitializeSchema }),
  async (req: AuthRequest, res: Response) => {
    const { graph_ids, style = "academic", session_id } = req.body;
    const userId = req.user.id;
    const supabase = req.supabase!;

    try {
      const { data: graphs, error: graphsError } = await supabase
        .from("knowledge_graphs")
        .select("id, title")
        .in("id", graph_ids)
        .eq("user_id", userId)
        .is("deleted_at", null);

      if (graphsError || !graphs || graphs.length === 0) {
        throw new AppError("未找到有效的图谱", 404, ErrorCodes.NOT_FOUND);
      }

      const results: Array<{
        graphId: string;
        title: string;
        taskId?: string;
        status: "pending" | "skipped";
        reason?: string;
      }> = [];

      const batchSessionId = session_id || crypto.randomUUID();

      for (const graph of graphs) {
        const { data: existingNodes } = await supabase
          .from("knowledge_points")
          .select("id")
          .eq("graph_id", graph.id)
          .limit(1);

        if (existingNodes && existingNodes.length > 0) {
          results.push({
            graphId: graph.id,
            title: graph.title,
            status: "skipped",
            reason: "图谱已有知识点",
          });
          continue;
        }

        const task = await taskService.createTask(
          userId,
          "recursive_graph_generation",
          {
            graph_id: graph.id,
            topic: graph.title,
            depth: 2,
            style,
            batchSessionId,
          },
          `初始化知识图谱：${graph.title}`,
        );

        results.push({
          graphId: graph.id,
          title: graph.title,
          taskId: task.id,
          status: "pending",
        });
      }

      res.json({
        success: true,
        results,
        summary: {
          total: graph_ids.length,
          pending: results.filter((r) => r.status === "pending").length,
          skipped: results.filter((r) => r.status === "skipped").length,
        },
      });
    } catch (error: unknown) {
      if (error instanceof AppError) throw error;
      const message = error instanceof Error ? error.message : "批量初始化失败";
      throw new AppError(message, 500, ErrorCodes.INTERNAL_ERROR);
    }
  },
);

router.post(
  "/:id/initialize",
  requireAuth,
  validate({ params: uuidParamsSchema, body: initializeGraphSchema }),
  async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { style = "academic" } = req.body;
    const userId = req.user.id;
    const supabase = req.supabase!;

    try {
      const { data: graph, error: graphError } = await supabase
        .from("knowledge_graphs")
        .select("id, title, description")
        .eq("id", id)
        .eq("user_id", userId)
        .is("deleted_at", null)
        .single();

      if (graphError || !graph) {
        throw new AppError("图谱不存在", 404, ErrorCodes.NOT_FOUND);
      }

      const { data: existingNodes } = await supabase
        .from("knowledge_points")
        .select("id")
        .eq("graph_id", id)
        .limit(1);

      if (existingNodes && existingNodes.length > 0) {
        throw new AppError(
          "图谱已有知识点，无法重复初始化",
          400,
          ErrorCodes.VALIDATION_ERROR,
        );
      }

      const task = await taskService.createTask(
        userId,
        "recursive_graph_generation",
        {
          graph_id: id,
          topic: graph.title,
          depth: 2,
          style,
        },
        `初始化知识图谱：${graph.title}`,
      );

      res.json({
        success: true,
        taskId: task.id,
        graphId: id,
        message: "初始化任务已创建，请通过任务状态查询进度",
      });
    } catch (error: unknown) {
      if (error instanceof AppError) throw error;
      const message = error instanceof Error ? error.message : "初始化图谱失败";
      throw new AppError(message, 500, ErrorCodes.INTERNAL_ERROR);
    }
  },
);

const discoverRelationsSchema = z.object({
  graph_ids: z.array(z.string().uuid()).optional(),
  max_suggestions: z.number().min(1).max(50).default(20),
  include_cross_domain: z.boolean().default(true),
});

const createRelationFromDiscoverySchema = z.object({
  source_graph_id: z.string().uuid(),
  target_graph_id: z.string().uuid(),
  relation_type: z.enum([
    "prerequisite",
    "extension",
    "related",
    "cross_domain",
  ]),
  context: z.string().max(500).optional(),
  confidence: z.number().min(0).max(1).optional(),
  shared_concepts: z.array(z.string()).optional(),
});

const crossDomainInsightsSchema = z.object({
  graph_ids: z.array(z.string().uuid()).optional(),
  min_intersection: z.number().min(1).max(10).default(2),
});

const learningPathSuggestionsSchema = z.object({
  graph_ids: z.array(z.string().uuid()).optional(),
  difficulty: z.enum(["beginner", "intermediate", "advanced"]).optional(),
});

const knowledgeGapsSchema = z.object({
  graph_ids: z.array(z.string().uuid()).optional(),
  min_importance: z.enum(["high", "medium", "low"]).optional(),
});

router.post(
  "/discover-relations",
  requireAuth,
  validate({ body: discoverRelationsSchema }),
  async (req: AuthRequest, res: Response) => {
    const { graph_ids, max_suggestions, include_cross_domain } = req.body;
    const userId = req.user.id;

    try {
      const result = await relationDiscoveryService.discoverRelations(
        req.supabase!,
        userId,
        {
          graph_ids,
          max_suggestions,
          include_cross_domain,
        },
      );

      res.json(result);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "图谱关系发现失败";
      throw new AppError(message, 500, ErrorCodes.INTERNAL_ERROR);
    }
  },
);

router.post(
  "/create-discovered-relation",
  requireAuth,
  validate({ body: createRelationFromDiscoverySchema }),
  async (req: AuthRequest, res: Response) => {
    const {
      source_graph_id,
      target_graph_id,
      relation_type,
      context,
      confidence,
      shared_concepts,
    } = req.body;
    const userId = req.user.id;

    try {
      const result = await relationDiscoveryService.createRelationFromDiscovery(
        req.supabase!,
        userId,
        {
          source_graph_id,
          target_graph_id,
          relation_type,
          context,
          confidence,
          shared_concepts,
        },
      );

      res.json({
        success: true,
        relation_id: result.id,
        message: "关系创建成功",
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "创建关系失败";
      throw new AppError(message, 500, ErrorCodes.INTERNAL_ERROR);
    }
  },
);

router.post(
  "/cross-domain-insights",
  requireAuth,
  validate({ body: crossDomainInsightsSchema }),
  async (req: AuthRequest, res: Response) => {
    const { graph_ids, min_intersection = 2 } = req.body;
    const userId = req.user.id;

    try {
      logger.info("Cross-domain insights request", {
        userId,
        graph_ids,
        min_intersection,
      });

      const result = await relationDiscoveryService.analyzeCrossDomainInsights(
        req.supabase!,
        userId,
        {
          graph_ids,
          min_intersection,
        },
      );

      res.json(result);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "跨学科洞察分析失败";
      logger.error("Cross-domain insights failed", error);
      throw new AppError(message, 500, ErrorCodes.INTERNAL_ERROR);
    }
  },
);

router.post(
  "/learning-path-suggestions",
  requireAuth,
  validate({ body: learningPathSuggestionsSchema }),
  async (req: AuthRequest, res: Response) => {
    const { graph_ids, difficulty } = req.body;
    const userId = req.user.id;

    try {
      logger.info("Learning path suggestions request", {
        userId,
        graph_ids,
        difficulty,
      });

      const result =
        await relationDiscoveryService.generateLearningPathSuggestions(
          req.supabase!,
          userId,
          {
            graph_ids,
            difficulty,
          },
        );

      res.json(result);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "学习路径建议生成失败";
      logger.error("Learning path suggestions failed", error);
      throw new AppError(message, 500, ErrorCodes.INTERNAL_ERROR);
    }
  },
);

router.post(
  "/knowledge-gaps",
  requireAuth,
  validate({ body: knowledgeGapsSchema }),
  async (req: AuthRequest, res: Response) => {
    const { graph_ids, min_importance } = req.body;
    const userId = req.user.id;

    try {
      logger.info("Knowledge gaps analysis request", {
        userId,
        graph_ids,
        min_importance,
      });

      const result = await relationDiscoveryService.analyzeKnowledgeGaps(
        req.supabase!,
        userId,
        {
          graph_ids,
          min_importance,
        },
      );

      res.json(result);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "知识缺口分析失败";
      logger.error("Knowledge gaps analysis failed", error);
      throw new AppError(message, 500, ErrorCodes.INTERNAL_ERROR);
    }
  },
);

const validateBackboneSchema = z.object({
  nodes: z
    .array(
      z.object({
        id: z.string().min(1),
        title: z.string().min(1).max(200),
        properties: z
          .object({
            backboneModule: z.enum([
              "research_background",
              "literature_review",
              "research_methods",
              "core_concepts",
              "application_domains",
              "future_directions",
            ]).optional(),
          })
          .optional(),
      }),
    )
    .min(1)
    .max(100),
  context: z.string().max(1000).optional(),
  useAI: z.boolean().optional(),
});

router.post(
  "/:graphId/nodes/validate-backbone",
  requireAuth,
  validate({ params: uuidParamsSchema, body: validateBackboneSchema }),
  async (req: AuthRequest, res: Response) => {
    const { graphId } = req.params;
    const { nodes, context, useAI } = req.body;
    const userId = req.user.id;

    try {
      logger.info("Backbone validation request", {
        graphId,
        userId,
        nodeCount: nodes.length,
        useAI,
      });

      const { data: graph } = await req
        .supabase!.from("knowledge_graphs")
        .select("id, title")
        .eq("id", graphId)
        .eq("user_id", userId)
        .is("deleted_at", null)
        .single();

      if (!graph) {
        throw new AppError("图谱不存在", 404, ErrorCodes.NOT_FOUND);
      }

      const validationContext =
        context || `图谱主题：${graph.title}`;

      let result;
      if (useAI) {
        result = await backboneValidatorService.validateNodesWithAI(
          nodes,
          validationContext,
          {
            graphId,
            userId,
          },
        );
      } else {
        result = await backboneValidatorService.validateNodes(nodes, {
          graphId,
          userId,
        });
      }

      logger.info("Backbone validation completed", {
        graphId,
        userId,
        valid: result.valid,
        correctionCount: result.corrections.length,
        errorCount: result.errors.length,
      });

      res.json(result);
    } catch (error: unknown) {
      if (error instanceof AppError) throw error;
      const message =
        error instanceof Error ? error.message : "骨干节点验证失败";
      logger.error("Backbone validation failed", error);
      throw new AppError(message, 500, ErrorCodes.INTERNAL_ERROR);
    }
  },
);

router.post(
  "/:graphId/fix-backbone-modules",
  requireAuth,
  validate({ params: uuidParamsSchema }),
  async (req: AuthRequest, res: Response) => {
    const { graphId } = req.params;
    const userId = req.user.id;
    const supabase = req.supabase!;

    try {
      const { data: graph, error: graphError } = await supabase
        .from("knowledge_graphs")
        .select("id, template_type")
        .eq("id", graphId)
        .eq("user_id", userId)
        .is("deleted_at", null)
        .single();

      if (graphError || !graph) {
        throw new AppError("图谱不存在", 404, ErrorCodes.NOT_FOUND);
      }

      if (graph.template_type !== "topic_research") {
        throw new AppError(
          "该端点仅支持专题研究图谱",
          400,
          ErrorCodes.VALIDATION_ERROR,
        );
      }

      const { data: coreNodes, error: nodesError } = await supabase
        .from("graph_nodes")
        .select(
          `
          id,
          knowledge_points (
            id,
            title,
            properties
          )
        `,
        )
        .eq("graph_id", graphId)
        .is("deleted_at", null);

      if (nodesError) {
        logger.error("查询核心节点失败", { graphId, error: nodesError.message });
        throw new AppError("查询节点失败", 500, ErrorCodes.INTERNAL_ERROR);
      }

      const details: Array<{
        nodeId: string;
        title: string;
        fixed: boolean;
        assignedModule?: BackboneModule;
      }> = [];
      let fixedCount = 0;

      for (const graphNode of coreNodes || []) {
        const kp = Array.isArray(graphNode.knowledge_points)
          ? graphNode.knowledge_points[0]
          : graphNode.knowledge_points;

        if (!kp) continue;

        const properties = (kp.properties || {}) as Record<string, any>;
        const currentModule = properties.backboneModule as BackboneModule | undefined;

        if (currentModule) {
          details.push({
            nodeId: kp.id,
            title: kp.title,
            fixed: false,
          });
          continue;
        }

        const matchedModule = TITLE_TO_BACKBONE_MODULE[kp.title.trim()];

        if (!matchedModule) {
          details.push({
            nodeId: kp.id,
            title: kp.title,
            fixed: false,
          });
          continue;
        }

        const updatedProperties = {
          ...properties,
          backboneModule: matchedModule,
        };

        const { error: updateError } = await supabase
          .from("knowledge_points")
          .update({ properties: updatedProperties })
          .eq("id", kp.id);

        if (updateError) {
          logger.error("更新节点属性失败", {
            nodeId: kp.id,
            error: updateError.message,
          });
          details.push({
            nodeId: kp.id,
            title: kp.title,
            fixed: false,
          });
          continue;
        }

        fixedCount++;
        details.push({
          nodeId: kp.id,
          title: kp.title,
          fixed: true,
          assignedModule: matchedModule,
        });
      }

      logger.info("骨干模块修复完成", {
        graphId,
        userId,
        fixedCount,
        totalNodes: details.length,
      });

      res.json({
        success: true,
        fixedCount,
        totalNodes: details.length,
        details,
      });
    } catch (error: unknown) {
      if (error instanceof AppError) throw error;
      const message =
        error instanceof Error ? error.message : "修复骨干模块失败";
      logger.error("修复骨干模块失败", error);
      throw new AppError(message, 500, ErrorCodes.INTERNAL_ERROR);
    }
  },
);

export default router;

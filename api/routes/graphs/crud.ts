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
import { graphService } from "../../services/graph/index";
import { ErrorCodes } from "../../../shared/types/errorCodes";
import { AppError } from "../../middleware/errorHandler";
import { cacheService } from "../../services/common/cacheService";
import { logger } from "../../utils/logger";
import {
  relationDiscoveryService,
  conceptAggregationService,
} from "../../services/graph/index";
import { z } from "zod";

const checkTopicSchema = z.object({
  topic: z.string().min(2).max(200),
  exclude_graph_id: z.string().uuid().optional(),
});

const batchOperationSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(50),
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

  (graphNodes || []).forEach((gn) => {
    const kp = gn.knowledge_points as { properties?: { tags?: string[] } } | { properties?: { tags?: string[] } }[] | null;
    const props = Array.isArray(kp) ? kp[0]?.properties : kp?.properties;
    const tags = props?.tags || [];
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
    const { title, description, domains, template_type, preset_id } = req.body;
    const data = await graphService.createGraph(
      req.supabase!,
      req.user.id,
      title,
      description,
      { templateType: template_type, presetId: preset_id },
    );

    if (domains && Array.isArray(domains) && domains.length > 0) {
      await updateGraphDomains(req.supabase, data.id, domains);
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
      throw new AppError(message, 500, ErrorCodes.INTERNAL_ERROR);
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
      throw new AppError(message, 500, ErrorCodes.INTERNAL_ERROR);
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
      throw new AppError(message, 500, ErrorCodes.INTERNAL_ERROR);
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
      const { data: modules, error: modError } = await req
        .supabase!.from("graph_backbone_modules")
        .select("*")
        .eq("graph_id", id)
        .order("display_order", { ascending: true });

      if (modError) throw modError;

      if (!modules || modules.length === 0) {
        return res.json({ modules: [], totalNodes: 0, totalLiterature: 0 });
      }

      const { data: graphNodes, error: gnError } = await req
        .supabase!.from("graph_nodes")
        .select(
          `
          id,
          knowledge_points (
            id,
            properties
          )
        `,
        )
        .eq("graph_id", id)
        .is("deleted_at", null);

      if (gnError) throw gnError;

      const moduleStats = modules.map((mod: { module_type: string; title: string; icon: string; color: string }) => {
        const moduleNodes = (graphNodes || []).filter((gn) => {
          const kp = gn.knowledge_points as Array<{ properties?: { backboneModule?: string } }> | { properties?: { backboneModule?: string } } | null;
          const props = Array.isArray(kp) ? kp[0]?.properties : kp?.properties;
          return props?.backboneModule === mod.module_type;
        });

        const sources = new Set<string>();
        moduleNodes.forEach((gn) => {
          const kp = gn.knowledge_points as Array<{ properties?: { sources?: Array<{ title?: string }> } }> | { properties?: { sources?: Array<{ title?: string }> } } | null;
          const props = Array.isArray(kp) ? kp[0]?.properties : kp?.properties;
          const nodeSources = props?.sources || [];
          nodeSources.forEach((s: { title?: string }) => {
            if (s.title) sources.add(s.title);
          });
        });

        return {
          module_type: mod.module_type,
          title: mod.title,
          icon: mod.icon,
          color: mod.color,
          nodeCount: moduleNodes.length,
          literatureCount: sources.size,
        };
      });

      const totalNodes = moduleStats.reduce((sum, m) => sum + m.nodeCount, 0);
      const totalLiterature = moduleStats.reduce(
        (sum, m) => sum + m.literatureCount,
        0,
      );

      res.json({ modules: moduleStats, totalNodes, totalLiterature });
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "研究进度获取失败";
      throw new AppError(message, 500, ErrorCodes.INTERNAL_ERROR);
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
      const { data: graphNodes, error: gnError } = await req
        .supabase!.from("graph_nodes")
        .select(
          `
          knowledge_points (
            id,
            title,
            properties
          )
        `,
        )
        .eq("graph_id", id)
        .is("deleted_at", null);

      if (gnError) throw gnError;

      const literatureMap = new Map<
        string,
        {
          title: string;
          authors: string[];
          year: number;
          type: string;
          url: string;
          conceptCount: number;
          modules: string[];
        }
      >();

      for (const gn of graphNodes || []) {
        const kp = gn.knowledge_points as {
          id?: string;
          title?: string;
          properties?: {
            sources?: Array<{
              title?: string;
              authors?: string[];
              year?: number;
              type?: string;
              url?: string;
            }>;
            backboneModule?: string;
          };
        } | undefined;
        if (!kp) continue;
        const props = kp.properties || {};
        const sources = props.sources || [];
        const backboneModule = props.backboneModule as string | undefined;

        for (const source of sources) {
          if (!source.title) continue;
          const key = source.title + (source.url || "");
          const existing = literatureMap.get(key);
          if (existing) {
            existing.conceptCount++;
            if (backboneModule && !existing.modules.includes(backboneModule)) {
              existing.modules.push(backboneModule);
            }
          } else {
            literatureMap.set(key, {
              title: source.title,
              authors: source.authors || [],
              year: source.year || 0,
              type: source.type || "document",
              url: source.url || "",
              conceptCount: 1,
              modules: backboneModule ? [backboneModule] : [],
            });
          }
        }
      }

      let literature = Array.from(literatureMap.values());

      if (moduleFilter) {
        literature = literature.filter((l) => l.modules.includes(moduleFilter));
      }

      literature.sort(
        (a, b) => b.year - a.year || b.conceptCount - a.conceptCount,
      );

      res.json({ literature, totalCount: literature.length });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "文献库获取失败";
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
    const userId = req.user.id;
    const supabase = req.supabase!;

    const { data: graph, error: graphError } = await supabase
      .from("knowledge_graphs")
      .select("id, settings")
      .eq("id", id)
      .eq("user_id", userId)
      .is("deleted_at", null)
      .single();

    if (graphError || !graph) {
      throw new AppError("图谱不存在", 404, ErrorCodes.NOT_FOUND);
    }

    const currentSettings = (graph.settings as Record<string, unknown>) || {};
    const updatedSettings = {
      ...currentSettings,
      viewMode,
    };

    const { data: updatedGraph, error: updateError } = await supabase
      .from("knowledge_graphs")
      .update({ settings: updatedSettings })
      .eq("id", id)
      .eq("user_id", userId)
      .select()
      .single();

    if (updateError) {
      throw new AppError("更新视图模式失败", 500, ErrorCodes.INTERNAL_ERROR);
    }

    res.json(updatedGraph);
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
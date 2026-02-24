import { Router, type Response } from "express";
import {
  requireAuth,
  optionalAuth,
  type AuthRequest,
} from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import {
  createGraphSchema,
  updateGraphSchema,
  uuidParamsSchema,
  shareGraphSchema,
  createGraphFromTemplateSchema,
} from "../schemas/index.js";
import { graphService } from "../services/graphService.js";
import { templateService } from "../services/templateService.js";
import { ErrorCodes } from "../constants/errorCodes.js";
import { AppError } from "../middleware/errorHandler.js";
import { achievementService } from "../services/achievementService.js";
import { cacheService } from "../services/cache.js";
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
  const data = await graphService.listGraphs(req.supabase!, req.user.id);
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
    .select("id, title, description, created_at, is_public")
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
        "id, source_graph_id, target_graph_id, relation_type, context, metadata, created_at"
      )
      .or(
        `source_graph_id.in.(${graphIds.join(
          ","
        )}),target_graph_id.in.(${graphIds.join(",")})`
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
    `
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
          ","
        )}),target_graph_id.in.(${graphIds.join(",")})`
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
        (graphRelationCount.get(r.source_graph_id) || 0) + 1
      );
      graphRelationCount.set(
        r.target_graph_id,
        (graphRelationCount.get(r.target_graph_id) || 0) + 1
      );
    });

    const missingPrerequisites = (graphs || [])
      .filter((g) => {
        const asTarget = (relations || []).filter(
          (r) =>
            r.target_graph_id === g.id && r.relation_type === "prerequisite"
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
  }
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
      exclude_graph_id
    );

    res.json({
      is_duplicate: result.isDuplicate,
      similar_graphs: result.similarGraphs,
    });
  }
);

// Create a new graph (Auth Required)
router.post(
  "/",
  requireAuth,
  validate({ body: createGraphSchema }),
  async (req: AuthRequest, res: Response) => {
    const { title, description } = req.body;
    const data = await graphService.createGraph(
      req.supabase!,
      req.user.id,
      title,
      description
    );

    // Update achievements
    achievementService.updateCreationStats(req.user.id).catch(console.error);

    res.status(201).json(data);
  }
);

// Create a new graph from template (Auth Required)
router.post(
  "/from-template",
  requireAuth,
  validate({ body: createGraphFromTemplateSchema }),
  async (req: AuthRequest, res: Response) => {
    const { template_id, title, description } = req.body;
    const data = await templateService.createGraphFromTemplate(
      req.supabase!,
      req.user.id,
      template_id,
      title,
      description
    );
    res.status(201).json(data);
  }
);

// Get a specific graph (Optional Auth for Public Graphs)
router.get(
  "/:id",
  optionalAuth,
  validate({ params: uuidParamsSchema }),
  async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const userId = req.user?.id || null;

    // Create anonymous supabase client if no user
    // Assuming middleware attaches a client regardless, or we use a service/anon client?
    // req.supabase should be available. If optionalAuth works correctly, it should attach anon client if no auth.

    const data = await graphService.getGraph(req.supabase!, id, userId);
    if (!data) {
      throw new AppError("未找到该图谱", 404, ErrorCodes.GRAPH_NOT_FOUND);
    }
    res.json(data);
  }
);

// Update a graph (Auth Required - Owner Only)
router.put(
  "/:id",
  requireAuth,
  validate({ params: uuidParamsSchema, body: updateGraphSchema }),
  async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const updates = req.body;
    const data = await graphService.updateGraph(
      req.supabase!,
      id,
      req.user.id,
      updates
    );
    res.json(data);
  }
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
      { is_public }
    );
    res.json(data);
  }
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
        ErrorCodes.VALIDATION_ERROR
      );
    }

    const data = await graphService.toggleFavorite(
      req.supabase!,
      id,
      req.user.id,
      is_favorite
    );
    res.json(data);
  }
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
  }
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
      req.user.id
    );
    res.json({ message: `已恢复 ${result.count} 个图谱`, count: result.count });
  }
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
      req.user.id
    );
    res.json({
      message: `已永久删除 ${result.count} 个图谱`,
      count: result.count,
    });
  }
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
  }
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
  }
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
        .catch(console.error);
    }

    res.json(data);
  }
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
  }
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
  }
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
        id
      );
      res.json(analysis);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "图谱分析失败";
      throw new AppError(message, 500, ErrorCodes.INTERNAL_ERROR);
    }
  }
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
        maxSuggestions
      );
      res.json({ suggestions });
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "获取连接建议失败";
      throw new AppError(message, 500, ErrorCodes.INTERNAL_ERROR);
    }
  }
);

export default router;

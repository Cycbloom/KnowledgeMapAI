import { Router, type Response } from "express";
import { requireAuth, type AuthedRequest } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { graphRelationsRouteService } from "../services/graph";
import { widthExpansionService } from "../services/graph/widthExpansionService";
import { z } from "zod";

const router = Router();

const createPrerequisiteSchema = z.object({
  topic: z.string().min(2).max(200),
  description: z.string().max(500).optional(),
  auto_generate: z.boolean().default(true),
});

const batchCreateSchema = z.object({
  topics: z
    .array(
      z.object({
        topic: z.string().min(2).max(200),
        description: z.string().max(500).optional(),
        mastery_level: z.string(),
      }),
    )
    .min(1)
    .max(5),
  depth: z.number().min(1).max(3).default(2),
  style: z.enum(["academic", "practical", "beginner"]).default("academic"),
});

const createRelationSchema = z.object({
  source_graph_id: z.string().uuid(),
  target_graph_id: z.string().uuid(),
  relation_type: z.enum(["prerequisite", "extension", "related"]),
  context: z.string().max(500).optional(),
});

router.get(
  "/:graphId/relations",
  requireAuth,
  async (req: AuthedRequest, res: Response) => {
    const { graphId } = req.params;
    const data = await graphRelationsRouteService.getRelationsWithDetails(
      req.supabase,
      req.user.id,
      graphId,
    );
    res.json(data);
  },
);

router.post(
  "/:graphId/prerequisite-graph",
  requireAuth,
  validate(createPrerequisiteSchema),
  async (req: AuthedRequest, res: Response) => {
    const { graphId } = req.params;
    const { topic, description, auto_generate } = req.body;
    const data = await graphRelationsRouteService.createPrerequisiteGraph(
      req.supabase,
      req.user.id,
      graphId,
      { topic, description, auto_generate },
    );
    res.json(data);
  },
);

router.post(
  "/:graphId/prerequisite-graphs/batch",
  requireAuth,
  validate(batchCreateSchema),
  async (req: AuthedRequest, res: Response) => {
    const { graphId } = req.params;
    const { topics, depth, style } = req.body;
    const data = await graphRelationsRouteService.batchCreatePrerequisiteGraphs(
      req.supabase,
      req.user.id,
      graphId,
      { topics, depth, style },
    );
    res.json(data);
  },
);

router.delete(
  "/:graphId/relations/:relationId",
  requireAuth,
  async (req: AuthedRequest, res: Response) => {
    const { relationId } = req.params;
    await graphRelationsRouteService.deleteRelationWithCheck(
      req.supabase,
      req.user.id,
      relationId,
    );
    res.json({ success: true });
  },
);

router.post(
  "/relations",
  requireAuth,
  validate(createRelationSchema),
  async (req: AuthedRequest, res: Response) => {
    const { source_graph_id, target_graph_id, relation_type, context } =
      req.body;
    const data = await graphRelationsRouteService.createRelationWithChecks(
      req.supabase,
      req.user.id,
      { source_graph_id, target_graph_id, relation_type, context },
    );
    res.status(201).json(data);
  },
);

router.delete(
  "/relations/:relationId",
  requireAuth,
  async (req: AuthedRequest, res: Response) => {
    const { relationId } = req.params;
    await graphRelationsRouteService.deleteRelationWithCheck(
      req.supabase,
      req.user.id,
      relationId,
    );
    res.json({ success: true });
  },
);

const infiniteExpansionSchema = z.object({
  max_depth: z.number().min(1).max(5).optional().default(2),
  max_graphs_per_level: z.number().min(1).max(5).optional().default(3),
  relation_types: z
    .array(z.enum(["prerequisite", "extension", "related"]))
    .optional()
    .default(["prerequisite", "extension", "related"]),
  auto_generate_nodes: z.boolean().optional().default(true),
  node_depth: z.number().min(1).max(3).optional().default(2),
});

const applySelectionSchema = z.object({
  selections: z
    .array(
      z.object({
        key: z.string().min(1),
        action: z.enum(["keep", "final", "skip"]),
      }),
    )
    .min(1),
});

// 分步交互式宽度拓展：启动（生成第 1 层候选）
router.post(
  "/:graphId/infinite-expand/start",
  requireAuth,
  validate(infiniteExpansionSchema),
  async (req: AuthedRequest, res: Response) => {
    const { graphId } = req.params;
    const { max_depth, max_graphs_per_level, relation_types } = req.body;
    const data = await widthExpansionService.start(
      req.supabase,
      req.user.id,
      graphId,
      { max_depth, max_graphs_per_level, relation_types },
    );
    res.json(data);
  },
);

// 分步交互式宽度拓展：生成当前前沿的下一层候选（不落库）
router.post(
  "/:graphId/infinite-expand/generate",
  requireAuth,
  async (req: AuthedRequest, res: Response) => {
    const { graphId } = req.params;
    const data = await widthExpansionService.next(
      req.supabase,
      req.user.id,
      graphId,
    );
    res.json(data);
  },
);

// 分步交互式宽度拓展：应用本层选择（保留/终点/跳过），返回新的前沿
router.post(
  "/:graphId/infinite-expand/apply",
  requireAuth,
  validate(applySelectionSchema),
  async (req: AuthedRequest, res: Response) => {
    const { graphId } = req.params;
    const { selections } = req.body;
    const data = await widthExpansionService.apply(
      req.supabase,
      req.user.id,
      graphId,
      selections as Array<{ key: string; action: "keep" | "final" | "skip" }>,
    );
    res.json(data);
  },
);

// 一次性后台宽度拓展（保留旧接口兼容）
router.post(
  "/:graphId/infinite-expand",
  requireAuth,
  validate(infiniteExpansionSchema),
  async (req: AuthedRequest, res: Response) => {
    const { graphId } = req.params;
    const {
      max_depth,
      max_graphs_per_level,
      relation_types,
      auto_generate_nodes,
      node_depth,
    } = req.body;
    const data = await graphRelationsRouteService.startInfiniteExpansion(
      req.supabase,
      req.user.id,
      graphId,
      { max_depth, max_graphs_per_level, relation_types, auto_generate_nodes, node_depth },
    );
    res.json(data);
  },
);

export default router;

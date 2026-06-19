import { Router, type Response } from "express";
import { requireAuth, type AuthRequest } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { graphRelationsRouteService } from "../services/graph";
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
  async (req: AuthRequest, res: Response) => {
    const { graphId } = req.params;
    const data = await graphRelationsRouteService.getRelationsWithDetails(
      req.supabase!,
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
  async (req: AuthRequest, res: Response) => {
    const { graphId } = req.params;
    const { topic, description, auto_generate } = req.body;
    const data = await graphRelationsRouteService.createPrerequisiteGraph(
      req.supabase!,
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
  async (req: AuthRequest, res: Response) => {
    const { graphId } = req.params;
    const { topics, depth, style } = req.body;
    const data = await graphRelationsRouteService.batchCreatePrerequisiteGraphs(
      req.supabase!,
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
  async (req: AuthRequest, res: Response) => {
    const { relationId } = req.params;
    await graphRelationsRouteService.deleteRelationWithCheck(
      req.supabase!,
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
  async (req: AuthRequest, res: Response) => {
    const { source_graph_id, target_graph_id, relation_type, context } =
      req.body;
    const data = await graphRelationsRouteService.createRelationWithChecks(
      req.supabase!,
      req.user.id,
      { source_graph_id, target_graph_id, relation_type, context },
    );
    res.status(201).json(data);
  },
);

router.delete(
  "/relations/:relationId",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const { relationId } = req.params;
    await graphRelationsRouteService.deleteRelationWithCheck(
      req.supabase!,
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

router.post(
  "/:graphId/infinite-expand",
  requireAuth,
  validate(infiniteExpansionSchema),
  async (req: AuthRequest, res: Response) => {
    const { graphId } = req.params;
    const {
      max_depth,
      max_graphs_per_level,
      relation_types,
      auto_generate_nodes,
      node_depth,
    } = req.body;
    const data = await graphRelationsRouteService.startInfiniteExpansion(
      req.supabase!,
      req.user.id,
      graphId,
      { max_depth, max_graphs_per_level, relation_types, auto_generate_nodes, node_depth },
    );
    res.json(data);
  },
);

export default router;

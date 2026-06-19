import { Router, type Response } from "express";
import { requireAuth, type AuthRequest } from "../middleware/auth";
import { validate } from "../middleware/validate";
import {
  createNodeSchema,
  updateNodeSchema,
  createEdgeSchema,
  uuidParamsSchema,
  batchDeleteNodesSchema,
  batchUpdatePositionsSchema,
  batchUpdateNodesSchema,
} from "../schemas/index";
import { nodesService } from "../services/graph";
import { knowledgePointService } from "../services/graph";

const router = Router();

router.post(
  "/nodes",
  requireAuth,
  validate(createNodeSchema),
  async (req: AuthRequest, res: Response) => {
    const result = await nodesService.createNode(
      req.supabase!,
      req.user.id,
      req.body,
    );
    res.status(201).json(result);
  },
);

router.get(
  "/nodes/:id",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const data = await nodesService.getNode(req.supabase!, req.user.id, id);
    res.json(data);
  },
);

router.put(
  "/nodes/:id",
  requireAuth,
  validate(updateNodeSchema),
  async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const data = await nodesService.updateNode(
      req.supabase!,
      req.user.id,
      id,
      req.body,
    );
    res.json(data);
  },
);

router.get(
  "/nodes/:id/related",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const limit = parseInt(req.query.limit as string) || 5;
    const data = await nodesService.getRelatedNodes(
      req.supabase!,
      req.user.id,
      id,
      limit,
    );
    res.json(data);
  },
);

router.delete(
  "/nodes/:id",
  requireAuth,
  validate({ params: uuidParamsSchema }),
  async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const hardDeleteParam = req.query.hard_delete;
    const hardDelete = hardDeleteParam === "true" || hardDeleteParam === "1";
    const result = await nodesService.deleteNode(
      req.supabase!,
      req.user.id,
      id,
      hardDelete,
    );
    res.json(result);
  },
);

router.post(
  "/nodes/batch-delete",
  requireAuth,
  validate(batchDeleteNodesSchema),
  async (req: AuthRequest, res: Response) => {
    const { node_ids } = req.body;
    const result = await nodesService.batchDeleteNodes(
      req.supabase!,
      req.user.id,
      node_ids,
    );
    res.json(result);
  },
);

router.post(
  "/nodes/batch-update-positions",
  requireAuth,
  validate(batchUpdatePositionsSchema),
  async (req: AuthRequest, res: Response) => {
    const { positions } = req.body;
    const result = await nodesService.batchUpdatePositions(
      req.supabase!,
      req.user.id,
      positions,
    );
    res.json(result);
  },
);

router.post(
  "/nodes/batch-update",
  requireAuth,
  validate(batchUpdateNodesSchema),
  async (req: AuthRequest, res: Response) => {
    const { nodes } = req.body;
    const result = await nodesService.batchUpdateNodes(
      req.supabase!,
      req.user.id,
      nodes,
    );
    res.json(result);
  },
);

router.get(
  "/nodes/:id/knowledge-point-graphs",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const data = await knowledgePointService.getGraphs(
      req.supabase!,
      id,
      req.user.id,
    );
    res.json(data || []);
  },
);

router.post(
  "/edges",
  requireAuth,
  validate(createEdgeSchema),
  async (req: AuthRequest, res: Response) => {
    const edge = await nodesService.createEdge(
      req.supabase!,
      req.user.id,
      req.body,
    );
    res.status(201).json(edge);
  },
);

router.delete(
  "/edges/:id",
  requireAuth,
  validate({ params: uuidParamsSchema }),
  async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    await nodesService.deleteEdge(req.supabase!, req.user.id, id);
    res.json({ message: "Edge deleted" });
  },
);

export default router;

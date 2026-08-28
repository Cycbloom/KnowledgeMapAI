import { Router, type Response } from "express";
import {
  requireAuth,
  optionalAuth,
  type AuthedRequest,
  type OptionalAuthRequest,
} from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { uuidParamsSchema } from "../../schemas/index";
import { graphService, analysisRouteService, nodeRelationDiscoveryService } from "../../services/graph";
import { ErrorCodes } from "../../../shared/types/errorCodes";
import { AppError } from "../../middleware/errorHandler";
import { logger } from "../../utils/logger";
import { z } from "zod";

const analyzeDomainSchema = z.object({
  domain: z.string().min(2).max(200),
  count: z.number().min(5).max(30).default(10),
  context_domain_id: z.string().uuid().optional(),
});

const batchNodeStatusSchema = z.object({
  graph_ids: z.array(z.string().uuid()).min(1).max(20),
});

const discoverNodeRelationsSchema = z.object({
  max_suggestions: z.number().min(1).max(30).optional().default(10),
});

const applyNodeRelationsSchema = z.object({
  suggestions: z
    .array(
      z.object({
        source_id: z.string().uuid(),
        target_id: z.string().uuid(),
        relationship_type: z.string().min(1).max(50),
        confidence: z.number().min(0).max(1).optional(),
        reason: z.string().max(500).optional(),
      }),
    )
    .min(1)
    .max(50),
});

const router = Router();

// Get nodes and edges for a graph (Optional Auth)
router.get(
  "/:id/nodes",
  optionalAuth,
  validate({ params: uuidParamsSchema }),
  async (req: OptionalAuthRequest, res: Response) => {
    const { id } = req.params;
    const userId = req.user?.id || null;
    const includeEmbedding = req.query.includeEmbedding === "true";
    const includeStatus = req.query.includeStatus === "true";
    if (!req.supabase) {
      throw new AppError("Supabase client not available", 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }
    const data = await graphService.getGraphNodes(req.supabase, userId, id, {
      includeEmbedding,
      includeStatus,
    });

    // Update last_used_at when user opens their own graph
    if (userId) {
      graphService
        .updateLastUsedAt(req.supabase, id, userId)
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
  async (req: OptionalAuthRequest, res: Response) => {
    const { id } = req.params;
    const userId = req.user?.id || null;
    if (userId && !req.supabase) {
      throw new AppError("Supabase client not available", 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }
    const data = userId && req.supabase
      ? await graphService.getGraphNodeStatus(req.supabase, userId, id)
      : {};
    res.json(data);
  },
);

// Batch get node status for multiple graphs (Auth Required)
router.post(
  "/batch-node-status",
  requireAuth,
  validate({ body: batchNodeStatusSchema }),
  async (req: AuthedRequest, res: Response) => {
    const { graph_ids } = req.body;
    const userId = req.user.id;
    const data = await graphService.batchGetGraphNodeStatus(
      req.supabase,
      userId,
      graph_ids,
    );
    res.json(data);
  },
);

// Get learning path for a graph (Optional Auth)
router.get(
  "/:id/learning-path",
  optionalAuth,
  validate({ params: uuidParamsSchema }),
  async (req: OptionalAuthRequest, res: Response) => {
    const { id } = req.params;
    const userId = req.user?.id || null;

    // Reuse logic: users can see path if they can see the graph
    if (!req.supabase) {
      throw new AppError("Supabase client not available", 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }
    const data = await graphService.getLearningPath(req.supabase, userId, id);
    res.json({ path: data });
  },
);

// Analyze graph structure (Auth Required)
router.get(
  "/:id/analyze",
  requireAuth,
  validate({ params: uuidParamsSchema }),
  async (req: AuthedRequest, res: Response) => {
    const { id } = req.params;
    const userId = req.user.id;

    const analysis = await graphService.analyzeGraph(
      req.supabase,
      userId,
      id,
    );
    res.json(analysis);
  },
);

// Get missing connection suggestions (Auth Required)
router.get(
  "/:id/missing-connections",
  requireAuth,
  validate({ params: uuidParamsSchema }),
  async (req: AuthedRequest, res: Response) => {
    const { id } = req.params;
    const userId = req.user.id;
    const maxSuggestions = parseInt(req.query.max as string) || 10;

    const suggestions = await graphService.findMissingConnections(
      req.supabase,
      userId,
      id,
      maxSuggestions,
    );
    res.json({ suggestions });
  },
);

// Analyze domain topic and return recommended graphs (Auth Required)
router.post(
  "/domain/analyze",
  requireAuth,
  validate({ body: analyzeDomainSchema }),
  async (req: AuthedRequest, res: Response) => {
    const { domain, count = 10, context_domain_id, session_id } = req.body;
    const userId = req.user.id;

    const result = await analysisRouteService.analyzeDomain(
      req.supabase,
      userId,
      domain,
      count,
      context_domain_id,
      session_id,
    );

    res.json(result);
  },
);

// Discover non-hierarchical relationships between nodes via AI (Auth Required)
router.post(
  "/:id/discover-node-relations",
  requireAuth,
  validate({ params: uuidParamsSchema, body: discoverNodeRelationsSchema }),
  async (req: AuthedRequest, res: Response) => {
    const { id } = req.params;
    const userId = req.user.id;
    const { max_suggestions } = req.body;

    const suggestions = await nodeRelationDiscoveryService.discoverNodeRelations(
      req.supabase,
      userId,
      id,
      { max_suggestions },
    );
    res.json({ suggestions });
  },
);

// Batch apply AI node relation suggestions to create edges (Auth Required)
router.post(
  "/:id/apply-node-relations",
  requireAuth,
  validate({ params: uuidParamsSchema, body: applyNodeRelationsSchema }),
  async (req: AuthedRequest, res: Response) => {
    const { id } = req.params;
    const userId = req.user.id;
    const { suggestions } = req.body;

    const result = await nodeRelationDiscoveryService.applyNodeRelations(
      req.supabase,
      userId,
      id,
      suggestions,
    );
    res.json(result);
  },
);

export default router;

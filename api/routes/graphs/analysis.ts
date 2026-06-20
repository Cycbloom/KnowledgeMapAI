import { Router, type Response } from "express";
import {
  requireAuth,
  optionalAuth,
  type AuthRequest,
} from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { uuidParamsSchema } from "../../schemas/index";
import { graphService, analysisRouteService } from "../../services/graph";
import { ErrorCodes } from "../../../shared/types/errorCodes";
import { AppError } from "../../middleware/errorHandler";
import { logger } from "../../utils/logger";
import { z } from "zod";

const analyzeDomainSchema = z.object({
  domain: z.string().min(2).max(200),
  count: z.number().min(5).max(30).default(10),
  context_domain_id: z.string().uuid().optional(),
});

const router = Router();

// Get nodes and edges for a graph (Optional Auth)
router.get(
  "/:id/nodes",
  optionalAuth,
  validate({ params: uuidParamsSchema }),
  async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const userId = req.user?.id || null;
    const includeEmbedding = req.query.includeEmbedding === "true";
    const data = await graphService.getGraphNodes(req.supabase!, userId, id, {
      includeEmbedding,
    });

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
      throw new AppError(message, 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
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
      throw new AppError(message, 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
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
      const result = await analysisRouteService.analyzeDomain(
        req.supabase!,
        userId,
        domain,
        count,
        context_domain_id,
        session_id,
      );

      res.json(result);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "领域分析失败";
      throw new AppError(message, 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }
  },
);

export default router;

import { Router, type Response } from "express";
import { requireAuth, type AuthRequest, type AuthedRequest } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { z } from "zod";
import { AgentService, SKILLS, agentRouteService } from "../services/agent";
import { allTools } from "../services/agent/tools";
import { logger } from "../utils/logger";
import { AppError } from "../middleware/errorHandler";
import { ErrorCodes } from "../../shared/types/errorCodes";
import { setSSEHeaders } from "./ai/utils";

const createSessionSchema = z.object({
  skill_id: z.string().optional(),
  graph_ids: z.array(z.string().uuid()).optional(),
  custom_prompt: z.string().optional(),
});

const executeSchema = z.object({
  custom_prompt: z.string().optional(),
});

const autonomousSchema = z.object({
  goal: z.enum([
    "knowledge_completeness",
    "relation_discovery",
    "learning_optimization",
    "island_detection",
    "cross_domain",
    "custom",
  ]),
}) as z.ZodSchema;

const batchActionSchema = z.object({
  action_ids: z.array(z.string()).min(1),
});

const applyRecommendationsSchema = z.object({
  recommendations: z.array(
    z.object({
      id: z.string(),
      source_graph_id: z.string().uuid(),
      source_graph_title: z.string(),
      target_graph_id: z.string().uuid(),
      target_graph_title: z.string(),
      relation_type: z.enum([
        "prerequisite",
        "extension",
        "related",
        "cross_domain",
      ]),
      reason: z.string(),
      confidence: z.number().min(0).max(1),
    }),
  ),
});

const router = Router();

router.post(
  "/sessions",
  requireAuth,
  validate({ body: createSessionSchema }),
  async (req: AuthedRequest, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError("Unauthorized", 401, ErrorCodes.AUTH_UNAUTHORIZED);
    }

    const { skill_id, graph_ids, custom_prompt } = req.body;

    const agentService = new AgentService(req.supabase);
    const session = await agentService.createSession(userId, {
      skillId: skill_id,
      graphIds: graph_ids,
      customPrompt: custom_prompt,
    });

    logger.info("Agent session created", {
      sessionId: session.id,
      userId,
      skillId: skill_id,
    });

    res.json({ session });
  },
);

router.get(
  "/sessions",
  requireAuth,
  async (req: AuthedRequest, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError("Unauthorized", 401, ErrorCodes.AUTH_UNAUTHORIZED);
    }

    const agentService = new AgentService(req.supabase);
    const sessions = await agentService.getSessionsByUserId(userId);
    res.json({ sessions });
  },
);

router.get(
  "/sessions/:id",
  requireAuth,
  async (req: AuthedRequest, res: Response) => {
    const { id } = req.params;
    const agentService = new AgentService(req.supabase);
    const session = await agentService.getSession(id);

    if (!session) {
      throw new AppError("Session not found", 404, ErrorCodes.RESOURCE_NOT_FOUND);
    }

    res.json({ session });
  },
);

router.delete(
  "/sessions/:id",
  requireAuth,
  async (req: AuthedRequest, res: Response) => {
    const { id } = req.params;
    const agentService = new AgentService(req.supabase);
    await agentService.deleteSession(id);
    res.json({ success: true });
  },
);

router.post(
  "/sessions/:id/execute",
  requireAuth,
  validate({ body: executeSchema }),
  async (req: AuthedRequest, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError("Unauthorized", 401, ErrorCodes.AUTH_UNAUTHORIZED);
    }

    const { id } = req.params;
    const { custom_prompt } = req.body;

    // Set SSE headers
    setSSEHeaders(res);
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    const agentService = new AgentService(req.supabase);

    try {
      await agentService.executeSession(id, userId, res, custom_prompt);
    } catch (error) {
      const err = error as Error;
      logger.error("Failed to execute agent session", error);
      // SSE 流已开启时只能通过事件下发错误；否则交给 errorHandler 统一处理
      if (res.headersSent) {
        res.write(`data: ${JSON.stringify({ type: "session_failed", data: { error: err.message } })}\n\n`);
        res.end();
        return;
      }
      throw new AppError(
        err.message || "Failed to execute session",
        500,
        ErrorCodes.SYSTEM_INTERNAL_ERROR,
      );
    }
  },
);

router.post(
  "/sessions/:id/resume",
  requireAuth,
  async (req: AuthedRequest, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError("Unauthorized", 401, ErrorCodes.AUTH_UNAUTHORIZED);
    }

    const { id } = req.params;

    // Set SSE headers
    setSSEHeaders(res);
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    const agentService = new AgentService(req.supabase);

    try {
      await agentService.resumeSession(id, userId, res);
    } catch (error) {
      const err = error as Error;
      logger.error("Failed to resume agent session", error);
      // SSE 流已开启时只能通过事件下发错误；否则交给 errorHandler 统一处理
      if (res.headersSent) {
        res.write(`data: ${JSON.stringify({ type: "session_failed", data: { error: err.message } })}\n\n`);
        res.end();
        return;
      }
      throw new AppError(
        err.message || "Failed to resume session",
        500,
        ErrorCodes.SYSTEM_INTERNAL_ERROR,
      );
    }
  },
);

router.post(
  "/sessions/:id/autonomous",
  requireAuth,
  validate({ body: autonomousSchema }),
  async (req: AuthedRequest, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError("Unauthorized", 401, ErrorCodes.AUTH_UNAUTHORIZED);
    }

    const { id } = req.params;
    const { goal } = req.body;

    const agentService = new AgentService(req.supabase);

    const result = await agentService.executeWithAutonomy(id, userId, goal);
    res.json(result);
  },
);

router.get("/skills", requireAuth, async (_req: AuthRequest, res: Response) => {
  res.json({ skills: SKILLS });
});

router.get("/tools", requireAuth, async (_req: AuthRequest, res: Response) => {
  const tools = allTools.map((t) => ({
    name: t.name,
    description: t.description,
    parameters: t.parameters,
  }));
  res.json({ tools });
});

router.post(
  "/recommendations/apply",
  requireAuth,
  validate({ body: applyRecommendationsSchema }),
  async (req: AuthedRequest, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError("Unauthorized", 401, ErrorCodes.AUTH_UNAUTHORIZED);
    }

    const { recommendations, graphIndex } = req.body;

    try {
      const result = await agentRouteService.applyRecommendations(
        req.supabase,
        userId,
        recommendations,
        graphIndex,
      );

      res.json({
        success: true,
        created: result.created,
        errors: result.errors,
      });
    } catch (error) {
      const err = error as Error;
      logger.error("Failed to apply recommendations", error);
      res
        .status(500)
        .json({ error: err.message || "Failed to apply recommendations" });
    }
  },
);

router.get(
  "/sessions/:id/pending-actions",
  requireAuth,
  async (req: AuthedRequest, res: Response) => {
    const { id } = req.params;
    const agentService = new AgentService(req.supabase);
    const pendingActions = await agentService.getPendingActions(id);
    res.json({ pendingActions });
  },
);

router.post(
  "/sessions/:id/actions/:actionId/confirm",
  requireAuth,
  async (req: AuthedRequest, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError("Unauthorized", 401, ErrorCodes.AUTH_UNAUTHORIZED);
    }
    const { id, actionId } = req.params;
    const agentService = new AgentService(req.supabase);
    const result = await agentService.confirmAction(id, actionId);
    if (!result.success) {
      throw new AppError(result.error ?? "操作失败", 400, ErrorCodes.VALIDATION_ERROR);
    }
    res.json({ success: true, result: result.result, needsResume: result.needsResume });
  },
);

router.post(
  "/sessions/:id/actions/:actionId/reject",
  requireAuth,
  async (req: AuthedRequest, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError("Unauthorized", 401, ErrorCodes.AUTH_UNAUTHORIZED);
    }
    const { id, actionId } = req.params;
    const agentService = new AgentService(req.supabase);
    const result = await agentService.rejectAction(id, actionId);
    if (!result.success) {
      throw new AppError(result.error ?? "操作失败", 400, ErrorCodes.VALIDATION_ERROR);
    }
    res.json({ success: true, needsResume: result.needsResume });
  },
);

router.post(
  "/sessions/:id/actions/batch-confirm",
  requireAuth,
  validate({ body: batchActionSchema }),
  async (req: AuthedRequest, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError("Unauthorized", 401, ErrorCodes.AUTH_UNAUTHORIZED);
    }
    const { id } = req.params;
    const { action_ids } = req.body;
    const agentService = new AgentService(req.supabase);
    const results = await agentService.batchConfirmActions(id, action_ids);
    res.json({ success: true, results: results.results, needsResume: results.needsResume });
  },
);

router.post(
  "/sessions/:id/actions/batch-reject",
  requireAuth,
  validate({ body: batchActionSchema }),
  async (req: AuthedRequest, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError("Unauthorized", 401, ErrorCodes.AUTH_UNAUTHORIZED);
    }
    const { id } = req.params;
    const { action_ids } = req.body;
    const agentService = new AgentService(req.supabase);
    const results = await agentService.batchRejectActions(id, action_ids);
    res.json({ success: true, results: results.results, needsResume: results.needsResume });
  },
);

export default router;

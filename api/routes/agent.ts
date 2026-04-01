import { Router, type Response } from "express";
import { requireAuth, type AuthRequest } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { z } from "zod";
import { AgentService, SKILLS } from "../services/agent";
import { allTools } from "../services/agent/tools";
import { logger } from "../utils/logger";

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
  async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { skill_id, graph_ids, custom_prompt } = req.body;

    const agentService = new AgentService(req.supabase!);
    const session = agentService.createSession(userId, {
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
  "/sessions/:id",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const agentService = new AgentService(req.supabase!);
    const session = agentService.getSession(id);

    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    res.json({ session });
  },
);

router.post(
  "/sessions/:id/execute",
  requireAuth,
  validate({ body: executeSchema }),
  async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { id } = req.params;
    const { custom_prompt } = req.body;

    const agentService = new AgentService(req.supabase!);

    try {
      const result = await agentService.executeSession(
        id,
        userId,
        custom_prompt,
      );
      res.json(result);
    } catch (error) {
      const err = error as Error;
      logger.error("Failed to execute agent session", error);
      res
        .status(500)
        .json({ error: err.message || "Failed to execute session" });
    }
  },
);

router.post(
  "/sessions/:id/autonomous",
  requireAuth,
  validate({ body: autonomousSchema }),
  async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { id } = req.params;
    const { goal } = req.body;

    const agentService = new AgentService(req.supabase!);

    try {
      const result = await agentService.executeWithAutonomy(id, userId, goal);
      res.json(result);
    } catch (error) {
      const err = error as Error;
      logger.error("Failed to execute autonomous session", error);
      res.status(500).json({ error: err.message });
    }
  },
);

router.get("/skills", requireAuth, async (_req: AuthRequest, res: Response) => {
  res.json({ skills: SKILLS });
});

router.get("/tools", requireAuth, async (_req: AuthRequest, res: Response) => {
  try {
    const tools = allTools.map((t) => ({
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    }));
    res.json({ tools });
  } catch (error) {
    logger.error("Failed to get tools", error);
    res.status(500).json({ error: "Failed to get tools" });
  }
});

router.post(
  "/recommendations/apply",
  requireAuth,
  validate({ body: applyRecommendationsSchema }),
  async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { recommendations } = req.body;

    try {
      let created = 0;
      const errors: string[] = [];

      for (const rec of recommendations) {
        const { data: sourceGraph } = await req
          .supabase!.from("knowledge_graphs")
          .select("id")
          .eq("id", rec.source_graph_id)
          .eq("user_id", userId)
          .single();

        const { data: targetGraph } = await req
          .supabase!.from("knowledge_graphs")
          .select("id")
          .eq("id", rec.target_graph_id)
          .eq("user_id", userId)
          .single();

        if (!sourceGraph || !targetGraph) {
          errors.push(
            `图谱不存在或无权限: ${rec.source_graph_title} -> ${rec.target_graph_title}`,
          );
          continue;
        }

        const { error: insertError } = await req
          .supabase!.from("graph_relations")
          .upsert(
            {
              source_graph_id: rec.source_graph_id,
              target_graph_id: rec.target_graph_id,
              relation_type: rec.relation_type,
              context: rec.reason,
              source: "ai_suggested",
              confidence: rec.confidence,
            },
            {
              onConflict: "source_graph_id,target_graph_id,relation_type",
            },
          );

        if (insertError) {
          errors.push(
            `创建关系失败: ${rec.source_graph_title} -> ${rec.target_graph_title}: ${insertError.message}`,
          );
        } else {
          created++;
        }
      }

      logger.info("Applied recommendations", {
        userId,
        total: recommendations.length,
        created,
        errors: errors.length,
      });

      res.json({
        success: true,
        created,
        errors: errors.length > 0 ? errors : undefined,
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

export default router;

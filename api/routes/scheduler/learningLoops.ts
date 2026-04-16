import { Router, type Response } from "express";
import { requireAuth, type AuthRequest } from "../../middleware/auth";
import { z } from "zod";
import { logger } from "../../utils/logger";
import { learningLoopOrchestrator } from "../../services/scheduler/core/learningLoopOrchestrator";

const router = Router();

const startLoopSchema = z.object({
  knowledge_point_id: z.string().uuid().optional(),
  graph_id: z.string().uuid().optional(),
});

const startWithTaskSchema = z.object({
  knowledge_point_id: z.string().uuid(),
  graph_id: z.string().uuid().optional(),
});

const activeLoopQuerySchema = z.object({
  knowledge_point_id: z.string().uuid().optional(),
});

router.post(
  "/learning-loops",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      return res.status(500).json({ error: "Database connection not available" });
    }

    const parsed = startLoopSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid request data", details: parsed.error.errors });
    }

    const { knowledge_point_id, graph_id } = parsed.data;

    try {
      const loop = await learningLoopOrchestrator.startLoop(
        supabase,
        req.user.id,
        knowledge_point_id,
        graph_id,
      );
      res.status(201).json({ success: true, data: loop });
    } catch (error) {
      logger.error("[LearningLoops] Failed to start loop:", error);
      res.status(500).json({ error: "Failed to start learning loop" });
    }
  },
);

router.post(
  "/learning-loops/start-with-task",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      return res.status(500).json({ error: "Database connection not available" });
    }

    const parsed = startWithTaskSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid request data", details: parsed.error.errors });
    }

    const { knowledge_point_id, graph_id } = parsed.data;

    try {
      const loop = await learningLoopOrchestrator.startLearningWithTask(
        supabase,
        req.user.id,
        knowledge_point_id,
        graph_id,
      );
      res.status(201).json({ success: true, data: loop });
    } catch (error) {
      logger.error("[LearningLoops] Failed to start learning with task:", error);
      res.status(500).json({ error: "Failed to start learning with task" });
    }
  },
);

router.post(
  "/learning-loops/:id/advance",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      return res.status(500).json({ error: "Database connection not available" });
    }

    const { id } = req.params;

    try {
      const loop = await learningLoopOrchestrator.advanceLoop(
        supabase,
        id,
        req.user.id,
      );

      if (!loop) {
        return res.status(404).json({ error: "Learning loop not found" });
      }

      res.json({ success: true, data: loop });
    } catch (error) {
      logger.error("[LearningLoops] Failed to advance loop:", error);
      res.status(500).json({ error: "Failed to advance learning loop" });
    }
  },
);

router.get(
  "/learning-loops/active",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      return res.status(500).json({ error: "Database connection not available" });
    }

    const parsed = activeLoopQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid query parameters", details: parsed.error.errors });
    }

    const { knowledge_point_id } = parsed.data;

    try {
      const loop = await learningLoopOrchestrator.getActiveLoop(
        supabase,
        req.user.id,
        knowledge_point_id,
      );
      res.json({ success: true, data: loop });
    } catch (error) {
      logger.error("[LearningLoops] Failed to get active loop:", error);
      res.status(500).json({ error: "Failed to get active learning loop" });
    }
  },
);

export default router;

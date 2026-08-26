import { Router, type Response } from "express";
import { requireAuth, type AuthRequest } from "../../middleware/auth";
import { z } from "zod";
import { learningLoopOrchestrator } from "../../services/scheduler/core";
import { AppError } from "../../middleware/errorHandler";
import { ErrorCodes } from "../../../shared/types/errorCodes";

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
      throw new AppError("Database connection not available", 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }

    const parsed = startLoopSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError("Invalid request data", 400, ErrorCodes.VALIDATION_ERROR);
    }

    const { knowledge_point_id, graph_id } = parsed.data;

    const loop = await learningLoopOrchestrator.startLoop(
      supabase,
      req.user.id,
      knowledge_point_id,
      graph_id,
    );
    res.status(201).json({ success: true, data: loop });
  },
);

router.post(
  "/learning-loops/start-with-task",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      throw new AppError("Database connection not available", 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }

    const parsed = startWithTaskSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError("Invalid request data", 400, ErrorCodes.VALIDATION_ERROR);
    }

    const { knowledge_point_id, graph_id } = parsed.data;

    const loop = await learningLoopOrchestrator.startLearningWithTask(
      supabase,
      req.user.id,
      knowledge_point_id,
      graph_id,
    );
    res.status(201).json({ success: true, data: loop });
  },
);

router.post(
  "/learning-loops/:id/advance",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      throw new AppError("Database connection not available", 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }

    const { id } = req.params;

    const loop = await learningLoopOrchestrator.advanceLoop(
      supabase,
      id,
      req.user.id,
    );

    if (!loop) {
      throw new AppError("Learning loop not found", 404, ErrorCodes.RESOURCE_NOT_FOUND);
    }

    res.json({ success: true, data: loop });
  },
);

router.get(
  "/learning-loops/active",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      throw new AppError("Database connection not available", 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }

    const parsed = activeLoopQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw new AppError("Invalid query parameters", 400, ErrorCodes.VALIDATION_ERROR);
    }

    const { knowledge_point_id } = parsed.data;

    const loop = await learningLoopOrchestrator.getActiveLoop(
      supabase,
      req.user.id,
      knowledge_point_id,
    );
    res.json({ success: true, data: loop });
  },
);

export default router;

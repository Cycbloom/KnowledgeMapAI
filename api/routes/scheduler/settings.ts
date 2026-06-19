import { Router, type Response } from "express";
import { requireAuth, type AuthRequest } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { z } from "zod";
import { taskSettingService } from "../../services/scheduler";
import { AppError } from "../../middleware/errorHandler";
import { ErrorCodes } from "../../../shared/types/errorCodes";

const router = Router();

const uuidParamsSchema = z.object({
  id: z.string().uuid("无效的任务ID"),
});

const updateNotesBodySchema = z.object({
  notes: z.string(),
});

router.get(
  "/settings",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      throw new AppError("Database connection not available", 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }

    const settings = await taskSettingService.get(supabase, req.user.id);

    res.json({ success: true, data: settings });
  },
);

router.put(
  "/settings",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      throw new AppError("Database connection not available", 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }

    const settings = await taskSettingService.update(
      supabase,
      req.user.id,
      req.body,
    );

    res.json({ success: true, data: settings });
  },
);

router.put(
  "/tasks/:id/notes",
  requireAuth,
  validate({ params: uuidParamsSchema, body: updateNotesBodySchema }),
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      throw new AppError("Database connection not available", 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }

    const { id } = req.params;
    const { notes } = req.body;

    const task = await taskSettingService.updateNotes(
      supabase,
      req.user.id,
      id,
      notes,
    );

    res.json({ success: true, data: task });
  },
);

export default router;

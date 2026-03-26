import { Router, type Response } from "express";
import { requireAuth, type AuthRequest } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { z } from "zod";
import { logger } from "../../utils/logger";

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
      return res
        .status(500)
        .json({ error: "Database connection not available" });
    }

    const { data: settings, error } = await supabase
      .from("task_settings")
      .select("*")
      .eq("user_id", req.user.id)
      .maybeSingle();

    if (error) {
      return res.status(500).json({ error: "获取设置失败" });
    }

    if (!settings) {
      const { data: newSettings, error: createError } = await supabase
        .from("task_settings")
        .insert({ user_id: req.user.id })
        .select()
        .single();

      if (createError) {
        return res.status(500).json({ error: "创建设置失败" });
      }

      return res.json({ success: true, data: newSettings });
    }

    res.json({ success: true, data: settings });
  },
);

router.put(
  "/settings",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      return res
        .status(500)
        .json({ error: "Database connection not available" });
    }

    const allowedFields = [
      "q0_time_slice",
      "q1_time_slice",
      "q2_time_slice",
      "break_duration",
      "sound_enabled",
      "notification_enabled",
    ];
    const updateData: Record<string, unknown> = {};

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: "没有有效的更新字段" });
    }

    const { data: settings, error } = await supabase
      .from("task_settings")
      .update(updateData)
      .eq("user_id", req.user.id)
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: "更新设置失败" });
    }

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
      return res
        .status(500)
        .json({ error: "Database connection not available" });
    }

    const { id } = req.params;
    const { notes } = req.body;

    const { data: task, error } = await supabase
      .from("scheduled_tasks")
      .update({ notes, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", req.user.id)
      .is("deleted_at", null)
      .select()
      .single();

    if (error) {
      logger.error("Update notes error:", error);
      return res.status(500).json({ error: "更新笔记失败" });
    }

    if (!task) {
      return res.status(404).json({ error: "任务不存在" });
    }

    res.json({ success: true, data: task });
  },
);

export default router;

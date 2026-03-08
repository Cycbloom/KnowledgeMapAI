import { Router, type Response } from "express";
import { requireAuth, type AuthRequest } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { z } from "zod";
import { focusService } from "../../services/scheduler/focusService.js";
import { logger } from "../../utils/logger.js";

const router = Router();

const uuidParamsSchema = z.object({
  id: z.string().uuid("无效的ID"),
});

const createFocusSessionSchema = z.object({
  task_id: z.string().uuid().optional(),
  started_at: z.string().datetime(),
  ended_at: z.string().datetime().optional(),
  duration: z.number().int().min(0).optional(),
  pomodoro_count: z.number().int().min(0).optional(),
  white_noise_type: z.string().optional(),
  is_break: z.boolean().optional(),
});

const getFocusSessionsQuerySchema = z.object({
  from_date: z.string().datetime().optional(),
  to_date: z.string().datetime().optional(),
  task_id: z.string().uuid().optional(),
  is_break: z.coerce.boolean().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
});

const getMonthlyStatsQuerySchema = z.object({
  year: z.coerce.number().int().optional(),
  month: z.coerce.number().int().min(1).max(12).optional(),
});

router.post(
  "/focus-sessions",
  requireAuth,
  validate({ body: createFocusSessionSchema }),
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      return res
        .status(500)
        .json({ error: "Database connection not available" });
    }

    try {
      const session = await focusService.createFocusSession(
        supabase,
        req.user.id,
        req.body,
      );
      res.status(201).json({ success: true, data: session });
    } catch (error) {
      const err = error as Error;
      logger.error("Create focus session error:", err);
      res.status(500).json({ error: err.message || "创建专注会话失败" });
    }
  },
);

router.put(
  "/focus-sessions/:id",
  requireAuth,
  validate({ params: uuidParamsSchema }),
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      return res
        .status(500)
        .json({ error: "Database connection not available" });
    }

    const { id } = req.params;
    const updates = req.body;

    try {
      const session = await focusService.updateFocusSession(
        supabase,
        id,
        req.user.id,
        updates,
      );
      res.json({ success: true, data: session });
    } catch (error) {
      const err = error as Error;
      res.status(500).json({ error: err.message || "更新专注会话失败" });
    }
  },
);

router.get(
  "/focus-sessions",
  requireAuth,
  validate({ query: getFocusSessionsQuerySchema }),
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      return res
        .status(500)
        .json({ error: "Database connection not available" });
    }

    const { from_date, to_date, task_id, is_break, limit } =
      req.query as unknown as z.infer<typeof getFocusSessionsQuerySchema>;

    try {
      const sessions = await focusService.getFocusSessions(
        supabase,
        req.user.id,
        {
          from_date,
          to_date,
          task_id,
          is_break,
          limit,
        },
      );
      res.json({ success: true, data: sessions });
    } catch (error) {
      const err = error as Error;
      res.status(500).json({ error: err.message || "获取专注会话失败" });
    }
  },
);

router.get(
  "/focus-sessions/stats",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      return res
        .status(500)
        .json({ error: "Database connection not available" });
    }

    try {
      const stats = await focusService.getUserFocusStats(supabase, req.user.id);
      res.json({ success: true, data: stats });
    } catch (error) {
      const err = error as Error;
      res.status(500).json({ error: err.message || "获取专注统计失败" });
    }
  },
);

router.get(
  "/focus-sessions/monthly-stats",
  requireAuth,
  validate({ query: getMonthlyStatsQuerySchema }),
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      return res
        .status(500)
        .json({ error: "Database connection not available" });
    }

    const { year, month } = req.query as z.infer<
      typeof getMonthlyStatsQuerySchema
    >;

    try {
      const stats = await focusService.getMonthlyFocusStats(
        supabase,
        req.user.id,
        year,
        month,
      );
      res.json({ success: true, data: stats });
    } catch (error) {
      const err = error as Error;
      res.status(500).json({ error: err.message || "获取月统计失败" });
    }
  },
);

export default router;

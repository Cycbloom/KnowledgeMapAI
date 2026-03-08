import { Router, type Response } from "express";
import { requireAuth, type AuthRequest } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { z } from "zod";

const router = Router();

const uuidParamsSchema = z.object({
  id: z.string().uuid("无效的ID"),
});

const getExecutionsQuerySchema = z.object({
  task_id: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

router.get(
  "/tasks/:id/executions",
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

    const { data: task } = await supabase
      .from("scheduled_tasks")
      .select("id")
      .eq("id", id)
      .eq("user_id", req.user.id)
      .is("deleted_at", null)
      .single();

    if (!task) {
      return res.status(404).json({ error: "任务不存在" });
    }

    const { data: executions, error } = await supabase
      .from("task_executions")
      .select("*")
      .eq("task_id", id)
      .order("started_at", { ascending: false });

    if (error) {
      return res.status(500).json({ error: "获取执行记录失败" });
    }

    res.json({ success: true, data: executions });
  },
);

router.get(
  "/executions",
  requireAuth,
  validate({ query: getExecutionsQuerySchema }),
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      return res
        .status(500)
        .json({ error: "Database connection not available" });
    }

    const { task_id, limit, offset } = req.query as unknown as z.infer<
      typeof getExecutionsQuerySchema
    >;

    let query = supabase
      .from("task_executions")
      .select("*, scheduled_tasks(title, queue_level)", { count: "exact" })
      .eq("user_id", req.user.id)
      .order("started_at", { ascending: false });

    if (task_id) {
      query = query.eq("task_id", task_id);
    }

    const {
      data: executions,
      error,
      count,
    } = await query.range(offset, offset + limit - 1);

    if (error) {
      return res.status(500).json({ error: "获取执行历史失败" });
    }

    res.json({ success: true, data: executions, total: count });
  },
);

router.get(
  "/executions/:id",
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

    const { data: execution, error } = await supabase
      .from("task_executions")
      .select("*, scheduled_tasks(title, description, queue_level)")
      .eq("id", id)
      .eq("user_id", req.user.id)
      .single();

    if (error || !execution) {
      return res.status(404).json({ error: "执行记录不存在" });
    }

    res.json({ success: true, data: execution });
  },
);

export default router;

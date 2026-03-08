import { Router, type Response } from "express";
import { requireAuth, type AuthRequest } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { z } from "zod";
import { logger } from "../../utils/logger.js";

const router = Router();

const createSubtaskSchema = z.object({
  body: z.object({
    title: z.string().min(1, "标题不能为空"),
    description: z.string().optional(),
    priority: z.number().int().min(0).optional(),
    estimated_duration: z.number().int().min(0).optional(),
    due_date: z.string().datetime().optional(),
  }),
  params: z.object({
    id: z.string().uuid("无效的任务ID"),
  }),
});

const updateSubtaskSchema = z.object({
  body: z.object({
    title: z.string().min(1, "标题不能为空").optional(),
    description: z.string().optional(),
    status: z.enum(["pending", "in_progress", "completed"]).optional(),
    priority: z.number().int().min(0).optional(),
    estimated_duration: z.number().int().min(0).optional(),
    actual_duration: z.number().int().min(0).optional(),
    due_date: z.string().datetime().optional().nullable(),
  }),
  params: z.object({
    id: z.string().uuid("无效的任务ID"),
    subtaskId: z.string().uuid("无效的子任务ID"),
  }),
});

const subtaskParamsSchema = z.object({
  id: z.string().uuid("无效的任务ID"),
  subtaskId: z.string().uuid("无效的子任务ID"),
});

router.post(
  "/tasks/:id/subtasks",
  requireAuth,
  validate(createSubtaskSchema),
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      return res
        .status(500)
        .json({ error: "Database connection not available" });
    }

    const { id } = req.params;
    const { title, description, priority, estimated_duration, due_date } =
      req.body;

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

    const { count } = await supabase
      .from("task_subtasks")
      .select("*", { count: "exact", head: true })
      .eq("task_id", id);

    const { data: subtask, error } = await supabase
      .from("task_subtasks")
      .insert({
        task_id: id,
        title,
        description,
        priority: priority ?? 0,
        position: count ?? 0,
        estimated_duration,
        due_date,
        status: "pending",
      })
      .select()
      .single();

    if (error) {
      logger.error("Create subtask error:", error);
      return res.status(500).json({ error: "创建子任务失败" });
    }

    res.status(201).json({ success: true, data: subtask });
  },
);

router.get(
  "/tasks/:id/subtasks",
  requireAuth,
  validate({ params: z.object({ id: z.string().uuid("无效的任务ID") }) }),
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

    const { data: subtasks, error } = await supabase
      .from("task_subtasks")
      .select("*")
      .eq("task_id", id)
      .order("position", { ascending: true });

    if (error) {
      logger.error("Get subtasks error:", error);
      return res.status(500).json({ error: "获取子任务列表失败" });
    }

    res.json({ success: true, data: subtasks });
  },
);

router.put(
  "/tasks/:id/subtasks/:subtaskId",
  requireAuth,
  validate(updateSubtaskSchema),
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      return res
        .status(500)
        .json({ error: "Database connection not available" });
    }

    const { id, subtaskId } = req.params;
    const updates = req.body;

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

    if (updates.status === "completed") {
      updates.completed_at = new Date().toISOString();
    }

    const { data: subtask, error } = await supabase
      .from("task_subtasks")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", subtaskId)
      .eq("task_id", id)
      .select()
      .single();

    if (error) {
      logger.error("Update subtask error:", error);
      return res.status(500).json({ error: "更新子任务失败" });
    }

    if (!subtask) {
      return res.status(404).json({ error: "子任务不存在" });
    }

    res.json({ success: true, data: subtask });
  },
);

router.delete(
  "/tasks/:id/subtasks/:subtaskId",
  requireAuth,
  validate({ params: subtaskParamsSchema }),
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      return res
        .status(500)
        .json({ error: "Database connection not available" });
    }

    const { id, subtaskId } = req.params;

    const { error } = await supabase
      .from("task_subtasks")
      .delete()
      .eq("id", subtaskId)
      .eq("task_id", id);

    if (error) {
      logger.error("Delete subtask error:", error);
      return res.status(500).json({ error: "删除子任务失败" });
    }

    res.json({ success: true });
  },
);

export default router;

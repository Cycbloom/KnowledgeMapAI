import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { z } from "zod";
import { logger } from "../../utils/logger.js";
const router = Router();
const uuidParamsSchema = z.object({
    id: z.string().uuid("无效的任务ID"),
});
const createTaskKPSchema = z.object({
    body: z.object({
        knowledge_point_id: z.string().uuid("无效的知识点ID"),
        relevance_score: z.number().int().min(0).max(100).optional(),
        is_primary: z.boolean().optional(),
        notes: z.string().optional(),
    }),
    params: z.object({
        id: z.string().uuid("无效的任务ID"),
    }),
});
const updateTaskKPSchema = z.object({
    body: z.object({
        relevance_score: z.number().int().min(0).max(100).optional(),
        is_primary: z.boolean().optional(),
        notes: z.string().optional(),
    }),
    params: z.object({
        id: z.string().uuid("无效的任务ID"),
        kpId: z.string().uuid("无效的知识点关联ID"),
    }),
});
const taskKPParamsSchema = z.object({
    id: z.string().uuid("无效的任务ID"),
    kpId: z.string().uuid("无效的知识点关联ID"),
});
router.post("/tasks/:id/knowledge-points", requireAuth, validate(createTaskKPSchema), async (req, res) => {
    const supabase = req.supabase;
    if (!supabase) {
        return res
            .status(500)
            .json({ error: "Database connection not available" });
    }
    const { id } = req.params;
    const { knowledge_point_id, relevance_score, is_primary, notes } = req.body;
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
    const { data: kp } = await supabase
        .from("knowledge_points")
        .select("id, title, content")
        .eq("id", knowledge_point_id)
        .or(`visibility.eq.public,owner_id.eq.${req.user.id}`)
        .single();
    if (!kp) {
        return res.status(404).json({ error: "知识点不存在或无权访问" });
    }
    if (is_primary) {
        await supabase
            .from("task_knowledge_points")
            .update({ is_primary: false })
            .eq("task_id", id);
    }
    const { data: taskKP, error } = await supabase
        .from("task_knowledge_points")
        .insert({
        task_id: id,
        knowledge_point_id,
        relevance_score: relevance_score ?? 100,
        is_primary: is_primary ?? false,
        notes,
    })
        .select(`
        *,
        knowledge_point:knowledge_points(id, title, content, visibility)
      `)
        .single();
    if (error) {
        logger.error("Create task KP error:", error);
        return res.status(500).json({ error: "关联知识点失败" });
    }
    res.status(201).json({ success: true, data: taskKP });
});
router.get("/tasks/:id/knowledge-points", requireAuth, validate({ params: uuidParamsSchema }), async (req, res) => {
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
    const { data: taskKPs, error } = await supabase
        .from("task_knowledge_points")
        .select(`
        *,
        knowledge_point:knowledge_points(id, title, content, visibility, owner_id)
      `)
        .eq("task_id", id)
        .order("is_primary", { ascending: false })
        .order("created_at", { ascending: true });
    if (error) {
        logger.error("Get task KPs error:", error);
        return res.status(500).json({ error: "获取知识点关联失败" });
    }
    res.json({ success: true, data: taskKPs });
});
router.put("/tasks/:id/knowledge-points/:kpId", requireAuth, validate(updateTaskKPSchema), async (req, res) => {
    const supabase = req.supabase;
    if (!supabase) {
        return res
            .status(500)
            .json({ error: "Database connection not available" });
    }
    const { id, kpId } = req.params;
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
    if (updates.is_primary) {
        await supabase
            .from("task_knowledge_points")
            .update({ is_primary: false })
            .eq("task_id", id);
    }
    const { data: taskKP, error } = await supabase
        .from("task_knowledge_points")
        .update(updates)
        .eq("id", kpId)
        .eq("task_id", id)
        .select(`
        *,
        knowledge_point:knowledge_points(id, title, content, visibility)
      `)
        .single();
    if (error) {
        logger.error("Update task KP error:", error);
        return res.status(500).json({ error: "更新知识点关联失败" });
    }
    if (!taskKP) {
        return res.status(404).json({ error: "知识点关联不存在" });
    }
    res.json({ success: true, data: taskKP });
});
router.delete("/tasks/:id/knowledge-points/:kpId", requireAuth, validate({ params: taskKPParamsSchema }), async (req, res) => {
    const supabase = req.supabase;
    if (!supabase) {
        return res
            .status(500)
            .json({ error: "Database connection not available" });
    }
    const { id, kpId } = req.params;
    const { error } = await supabase
        .from("task_knowledge_points")
        .delete()
        .eq("id", kpId)
        .eq("task_id", id);
    if (error) {
        logger.error("Delete task KP error:", error);
        return res.status(500).json({ error: "取消知识点关联失败" });
    }
    res.json({ success: true });
});
export default router;
//# sourceMappingURL=knowledgePoints.js.map
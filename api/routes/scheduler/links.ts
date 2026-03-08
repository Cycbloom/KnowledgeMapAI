import { Router, type Response } from "express";
import { requireAuth, type AuthRequest } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { z } from "zod";
import { logger } from "../../utils/logger.js";

const router = Router();

const uuidParamsSchema = z.object({
  id: z.string().uuid("无效的任务ID"),
});

const createLinkSchema = z.object({
  body: z.object({
    link_type: z.enum(["web", "file", "api"]).default("web"),
    title: z.string().optional(),
    url: z.string().min(1, "链接地址不能为空"),
    description: z.string().optional(),
    icon: z.string().optional(),
    metadata: z.record(z.any()).optional(),
  }),
  params: z.object({
    id: z.string().uuid("无效的任务ID"),
  }),
});

const updateLinkSchema = z.object({
  body: z.object({
    title: z.string().optional(),
    description: z.string().optional(),
    icon: z.string().optional(),
    metadata: z.record(z.any()).optional(),
  }),
  params: z.object({
    id: z.string().uuid("无效的任务ID"),
    linkId: z.string().uuid("无效的链接ID"),
  }),
});

const linkParamsSchema = z.object({
  id: z.string().uuid("无效的任务ID"),
  linkId: z.string().uuid("无效的链接ID"),
});

router.post(
  "/tasks/:id/links",
  requireAuth,
  validate(createLinkSchema),
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      return res
        .status(500)
        .json({ error: "Database connection not available" });
    }

    const { id } = req.params;
    const { link_type, title, url, description, icon, metadata } = req.body;

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
      .from("task_links")
      .select("*", { count: "exact", head: true })
      .eq("task_id", id);

    const { data: link, error } = await supabase
      .from("task_links")
      .insert({
        task_id: id,
        link_type,
        title: title || url,
        url,
        description,
        icon,
        metadata: metadata || {},
        position: count ?? 0,
      })
      .select()
      .single();

    if (error) {
      logger.error("Create link error:", error);
      return res.status(500).json({ error: "创建链接失败" });
    }

    res.status(201).json({ success: true, data: link });
  },
);

router.get(
  "/tasks/:id/links",
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

    const { data: links, error } = await supabase
      .from("task_links")
      .select("*")
      .eq("task_id", id)
      .order("position", { ascending: true });

    if (error) {
      logger.error("Get links error:", error);
      return res.status(500).json({ error: "获取链接列表失败" });
    }

    res.json({ success: true, data: links });
  },
);

router.put(
  "/tasks/:id/links/:linkId",
  requireAuth,
  validate(updateLinkSchema),
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      return res
        .status(500)
        .json({ error: "Database connection not available" });
    }

    const { id, linkId } = req.params;
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

    const { data: link, error } = await supabase
      .from("task_links")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", linkId)
      .eq("task_id", id)
      .select()
      .single();

    if (error) {
      logger.error("Update link error:", error);
      return res.status(500).json({ error: "更新链接失败" });
    }

    if (!link) {
      return res.status(404).json({ error: "链接不存在" });
    }

    res.json({ success: true, data: link });
  },
);

router.delete(
  "/tasks/:id/links/:linkId",
  requireAuth,
  validate({ params: linkParamsSchema }),
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      return res
        .status(500)
        .json({ error: "Database connection not available" });
    }

    const { id, linkId } = req.params;

    const { error } = await supabase
      .from("task_links")
      .delete()
      .eq("id", linkId)
      .eq("task_id", id);

    if (error) {
      logger.error("Delete link error:", error);
      return res.status(500).json({ error: "删除链接失败" });
    }

    res.json({ success: true });
  },
);

export default router;

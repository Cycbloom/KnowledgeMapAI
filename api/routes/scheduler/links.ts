import { Router, type Response } from "express";
import { requireAuth, type AuthRequest } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { z } from "zod";
import { taskLinkService } from "../../services/scheduler";

const router = Router();

const uuidParamsSchema = z.object({
  id: z.string().uuid("无效的任务ID"),
});

const createLinkBodySchema = z.object({
  link_type: z.enum(["web", "file", "api"]).default("web"),
  title: z.string().optional(),
  url: z.string().min(1, "链接地址不能为空"),
  description: z.string().optional(),
  icon: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

const createLinkParamsSchema = z.object({
  id: z.string().uuid("无效的任务ID"),
});

const updateLinkBodySchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  icon: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

const updateLinkParamsSchema = z.object({
  id: z.string().uuid("无效的任务ID"),
  linkId: z.string().uuid("无效的链接ID"),
});

const linkParamsSchema = z.object({
  id: z.string().uuid("无效的任务ID"),
  linkId: z.string().uuid("无效的链接ID"),
});

router.post(
  "/tasks/:id/links",
  requireAuth,
  validate({ body: createLinkBodySchema, params: createLinkParamsSchema }),
  async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { link_type, title, url, description, icon, metadata } = req.body;

    const link = await taskLinkService.create(req.supabase!, req.user.id, id, {
      link_type,
      title,
      url,
      description,
      icon,
      metadata,
    });

    res.status(201).json({ success: true, data: link });
  },
);

router.get(
  "/tasks/:id/links",
  requireAuth,
  validate({ params: uuidParamsSchema }),
  async (req: AuthRequest, res: Response) => {
    const { id } = req.params;

    const links = await taskLinkService.list(req.supabase!, req.user.id, id);

    res.json({ success: true, data: links });
  },
);

router.put(
  "/tasks/:id/links/:linkId",
  requireAuth,
  validate({ body: updateLinkBodySchema, params: updateLinkParamsSchema }),
  async (req: AuthRequest, res: Response) => {
    const { id, linkId } = req.params;
    const updates = req.body;

    const link = await taskLinkService.update(req.supabase!, req.user.id, id, linkId, updates);

    res.json({ success: true, data: link });
  },
);

router.delete(
  "/tasks/:id/links/:linkId",
  requireAuth,
  validate({ params: linkParamsSchema }),
  async (req: AuthRequest, res: Response) => {
    const { id, linkId } = req.params;

    await taskLinkService.delete(req.supabase!, req.user.id, id, linkId);

    res.json({ success: true });
  },
);

export default router;

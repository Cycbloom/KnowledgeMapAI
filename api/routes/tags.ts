import { Router, type Response } from "express";
import { z } from "zod";
import { requireAuth, type AuthedRequest } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { tagService } from "../services/tags/tagService";

const router = Router();

const renameTagSchema = z.object({
  from: z.string().min(1).max(30),
  to: z.string().min(1).max(30),
});

const mergeTagSchema = z.object({
  sources: z.array(z.string().min(1).max(30)).min(1).max(10),
  target: z.string().min(1).max(30),
});

// 聚合 graphs / notes / tasks 三类资源的标签及计数
router.get("/", requireAuth, async (req: AuthedRequest, res: Response) => {
  const data = await tagService.list(req.supabase, req.user.id);
  res.json(data);
});

router.post(
  "/rename",
  requireAuth,
  validate({ body: renameTagSchema }),
  async (req: AuthedRequest, res: Response) => {
    const { from, to } = req.body;
    const updated = await tagService.rename(req.supabase, req.user.id, from, to);
    res.json({ updated });
  },
);

router.post(
  "/merge",
  requireAuth,
  validate({ body: mergeTagSchema }),
  async (req: AuthedRequest, res: Response) => {
    const { sources, target } = req.body;
    const updated = await tagService.merge(req.supabase, req.user.id, sources, target);
    res.json({ updated });
  },
);

// name 需 URL 编码传递（标签名可能含中文/特殊字符）
router.delete(
  "/:name",
  requireAuth,
  async (req: AuthedRequest, res: Response) => {
    const name = decodeURIComponent(req.params.name);
    const removed = await tagService.remove(req.supabase, req.user.id, name);
    res.json({ removed });
  },
);

export default router;

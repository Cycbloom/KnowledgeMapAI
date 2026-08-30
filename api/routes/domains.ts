import { Router, type Response } from "express";
import {
  requireAuth,
  type AuthedRequest,
} from "../middleware/auth";
import { validate } from "../middleware/validate";
import { z } from "zod";
import { domainService } from "../services/graph";

const createDomainSchema = z.object({
  name: z.string().min(2, "名称至少需要2个字符").max(200, "名称最多200个字符"),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "颜色格式无效，应为HEX格式如#FF5733"),
  description: z.string().max(1000).optional(),
  parent_id: z.string().uuid("无效的父领域ID").nullable().optional(),
  icon: z.string().max(50).optional(),
});

const updateDomainSchema = z.object({
  name: z.string().min(2, "名称至少需要2个字符").max(200, "名称最多200个字符").optional(),
  description: z.string().max(1000).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "颜色格式无效，应为HEX格式如#FF5733").optional(),
  icon: z.string().max(50).optional(),
  parent_id: z.string().uuid("无效的父领域ID").nullable().optional(),
  sort_order: z.number().int().optional(),
});

const uuidParamsSchema = z.object({
  id: z.string().uuid("无效的ID格式"),
});

const generateColorSchema = z.object({
  name: z.string().min(2).max(200),
  description: z.string().max(1000).optional(),
});

const recommendDomainsSchema = z.object({
  title: z.string().min(2).max(200),
  description: z.string().max(1000).optional(),
});

const reorderItemSchema = z.object({
  id: z.string().uuid(),
  parent_id: z.string().uuid().nullable().optional(),
  sort_order: z.number().int().min(0),
});

const reorderSchema = z.object({
  reorder_items: z.array(reorderItemSchema).min(1).max(100),
});

const router = Router();

router.get("/", requireAuth, async (req: AuthedRequest, res: Response) => {
  const supabase = req.supabase;
  const userId = req.user.id;

  const tree = await domainService.listDomainsTree(supabase, userId);
  res.json(tree);
});

// ---------- 静态路由必须放在 /:id 参数路由之前，否则会被误识别为 id ----------

router.get(
  "/ensure-uncategorized",
  requireAuth,
  async (req: AuthedRequest, res: Response) => {
    const supabase = req.supabase;
    const userId = req.user.id;

    const id = await domainService.ensureUncategorizedDomain(supabase, userId);
    res.json({ id, name: "未分类" });
  }
);

router.post(
  "/generate-color",
  requireAuth,
  validate({ body: generateColorSchema }),
  async (req: AuthedRequest, res: Response) => {
    const { name, description } = req.body;

    const result = await domainService.generateColor(name, description);
    res.json(result);
  }
);

router.post(
  "/recommend",
  requireAuth,
  validate({ body: recommendDomainsSchema }),
  async (req: AuthedRequest, res: Response) => {
    const supabase = req.supabase;
    const userId = req.user.id;
    const { title, description } = req.body;

    const result = await domainService.recommendDomains(supabase, userId, title, description);
    res.json(result);
  },
);

const autoClassifySchema = z.object({
  graph_ids: z.array(z.string().uuid()).optional(),
  max_domains: z.number().int().min(1).max(20).optional(),
});

const applyClassifySchema = z.object({
  domains: z
    .array(
      z.object({
        name: z.string().min(2).max(200),
        description: z.string().max(1000).optional(),
        color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
        graph_ids: z.array(z.string().uuid()).max(500),
      }),
    )
    .min(1)
    .max(20),
});

router.post(
  "/auto-classify",
  requireAuth,
  validate({ body: autoClassifySchema }),
  async (req: AuthedRequest, res: Response) => {
    const supabase = req.supabase;
    const userId = req.user.id;
    const { graph_ids, max_domains } = req.body;

    const result = await domainService.autoClassifyGraphs(supabase, userId, {
      graph_ids,
      max_domains,
    });
    res.json(result);
  },
);

router.post(
  "/apply-classify",
  requireAuth,
  validate({ body: applyClassifySchema }),
  async (req: AuthedRequest, res: Response) => {
    const supabase = req.supabase;
    const userId = req.user.id;

    const result = await domainService.applyClassifiedDomains(
      supabase,
      userId,
      req.body.domains,
    );
    res.json(result);
  },
);

router.put(
  "/reorder",
  requireAuth,
  validate({ body: reorderSchema }),
  async (req: AuthedRequest, res: Response) => {
    const supabase = req.supabase;
    const userId = req.user.id;
    const { reorder_items } = req.body;

    const result = await domainService.reorderDomains(supabase, userId, reorder_items);
    res.json(result);
  },
);

// ---------- 以下为 /:id 参数路由，静态路由必须在其上方定义 ----------

router.get(
  "/:id",
  requireAuth,
  validate({ params: uuidParamsSchema }),
  async (req: AuthedRequest, res: Response) => {
    const supabase = req.supabase;
    const { id } = req.params;
    const userId = req.user.id;

    const result = await domainService.getDomain(supabase, id, userId);
    res.json(result);
  },
);

router.post(
  "/",
  requireAuth,
  validate({ body: createDomainSchema }),
  async (req: AuthedRequest, res: Response) => {
    const supabase = req.supabase;
    const userId = req.user.id;

    const result = await domainService.createDomain(supabase, userId, req.body);
    res.status(201).json(result);
  },
);

router.put(
  "/:id",
  requireAuth,
  validate({ params: uuidParamsSchema, body: updateDomainSchema }),
  async (req: AuthedRequest, res: Response) => {
    const supabase = req.supabase;
    const { id } = req.params;
    const userId = req.user.id;

    const result = await domainService.updateDomain(supabase, id, userId, req.body);
    res.json(result);
  },
);

router.delete(
  "/:id",
  requireAuth,
  validate({ params: uuidParamsSchema }),
  async (req: AuthedRequest, res: Response) => {
    const supabase = req.supabase;
    const { id } = req.params;
    const userId = req.user.id;

    await domainService.deleteDomain(supabase, id, userId);
    res.json({ message: "领域已删除" });
  },
);

export default router;

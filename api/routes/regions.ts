import { Router, type Response } from "express";
import {
  requireAuth,
  type AuthRequest,
} from "../middleware/auth";
import { validate } from "../middleware/validate";
import { regionService } from "../services/graph";
import { z } from "zod";

const graphIdParamsSchema = z.object({
  graphId: z.string().uuid("无效的图谱ID格式"),
});

const regionIdParamsSchema = z.object({
  graphId: z.string().uuid("无效的图谱ID格式"),
  regionId: z.string().min(1, "区域ID不能为空"),
});

const createRegionSchema = z.object({
  name: z.string().min(1, "区域名称不能为空").max(100, "区域名称最多100个字符"),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "颜色格式无效，应为HEX格式如#FF5733"),
  nodeIds: z.array(z.string()).min(1, "至少需要一个节点"),
});

const updateRegionSchema = z.object({
  name: z.string().min(1, "区域名称不能为空").max(100, "区域名称最多100个字符").optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "颜色格式无效，应为HEX格式如#FF5733").optional(),
  nodeIds: z.array(z.string()).optional(),
});

const router = Router({ mergeParams: true });

router.get(
  "/",
  requireAuth,
  validate({ params: graphIdParamsSchema }),
  async (req: AuthRequest, res: Response) => {
    const { graphId } = req.params;
    const regions = await regionService.list(req.supabase!, req.user.id, graphId);
    res.json({ regions });
  },
);

router.post(
  "/",
  requireAuth,
  validate({ params: graphIdParamsSchema, body: createRegionSchema }),
  async (req: AuthRequest, res: Response) => {
    const { graphId } = req.params;
    const { name, color, nodeIds } = req.body;
    const region = await regionService.create(req.supabase!, req.user.id, graphId, { name, color, nodeIds });
    res.status(201).json(region);
  },
);

router.patch(
  "/:regionId",
  requireAuth,
  validate({ params: regionIdParamsSchema, body: updateRegionSchema }),
  async (req: AuthRequest, res: Response) => {
    const { graphId, regionId } = req.params;
    const updates = req.body;
    const region = await regionService.update(req.supabase!, req.user.id, graphId, regionId, updates);
    res.json(region);
  },
);

router.delete(
  "/:regionId",
  requireAuth,
  validate({ params: regionIdParamsSchema }),
  async (req: AuthRequest, res: Response) => {
    const { graphId, regionId } = req.params;
    await regionService.delete(req.supabase!, req.user.id, graphId, regionId);
    res.json({ success: true, message: "区域已删除" });
  },
);

export default router;

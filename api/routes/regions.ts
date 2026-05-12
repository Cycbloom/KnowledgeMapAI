import { Router, type Response } from "express";
import {
  requireAuth,
  type AuthRequest,
} from "../middleware/auth";
import { validate } from "../middleware/validate";
import { AppError } from "../middleware/errorHandler";
import { ErrorCodes } from "../../shared/types/errorCodes";
import { logger } from "../utils/logger";
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

interface CustomRegion {
  id: string;
  name: string;
  color: string;
  nodeIds: string[];
  createdAt: string;
  updatedAt: string;
}

const router = Router({ mergeParams: true });

router.get(
  "/",
  requireAuth,
  validate({ params: graphIdParamsSchema }),
  async (req: AuthRequest, res: Response) => {
    const { graphId } = req.params;
    const userId = req.user.id;
    const supabase = req.supabase!;

    const { data: graph, error: graphError } = await supabase
      .from("knowledge_graphs")
      .select("id, settings")
      .eq("id", graphId)
      .eq("user_id", userId)
      .is("deleted_at", null)
      .single();

    if (graphError || !graph) {
      throw new AppError("图谱不存在", 404, ErrorCodes.NOT_FOUND);
    }

    const settings = (graph.settings as Record<string, unknown>) || {};
    const quadrantViewState = settings.quadrantViewState as {
      customRegions?: CustomRegion[];
    } | undefined;

    const customRegions = quadrantViewState?.customRegions || [];

    res.json({ regions: customRegions });
  },
);

router.post(
  "/",
  requireAuth,
  validate({ params: graphIdParamsSchema, body: createRegionSchema }),
  async (req: AuthRequest, res: Response) => {
    const { graphId } = req.params;
    const { name, color, nodeIds } = req.body;
    const userId = req.user.id;
    const supabase = req.supabase!;

    const { data: graph, error: graphError } = await supabase
      .from("knowledge_graphs")
      .select("id, settings")
      .eq("id", graphId)
      .eq("user_id", userId)
      .is("deleted_at", null)
      .single();

    if (graphError || !graph) {
      throw new AppError("图谱不存在", 404, ErrorCodes.NOT_FOUND);
    }

    const settings = (graph.settings as Record<string, unknown>) || {};
    const quadrantViewState = (settings.quadrantViewState as Record<string, unknown>) || {};
    const customRegions = (quadrantViewState.customRegions as CustomRegion[]) || [];

    const newRegion: CustomRegion = {
      id: `region-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name,
      color,
      nodeIds,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const updatedRegions = [...customRegions, newRegion];

    const updatedSettings = {
      ...settings,
      quadrantViewState: {
        ...quadrantViewState,
        customRegions: updatedRegions,
      },
    };

    const { error: updateError } = await supabase
      .from("knowledge_graphs")
      .update({ settings: updatedSettings })
      .eq("id", graphId)
      .eq("user_id", userId);

    if (updateError) {
      logger.error("创建区域失败", { graphId, error: updateError.message });
      throw new AppError("创建区域失败", 500, ErrorCodes.INTERNAL_ERROR);
    }

    logger.info("区域创建成功", { graphId, regionId: newRegion.id, userId });

    res.status(201).json(newRegion);
  },
);

router.patch(
  "/:regionId",
  requireAuth,
  validate({ params: regionIdParamsSchema, body: updateRegionSchema }),
  async (req: AuthRequest, res: Response) => {
    const { graphId, regionId } = req.params;
    const updates = req.body;
    const userId = req.user.id;
    const supabase = req.supabase!;

    const { data: graph, error: graphError } = await supabase
      .from("knowledge_graphs")
      .select("id, settings")
      .eq("id", graphId)
      .eq("user_id", userId)
      .is("deleted_at", null)
      .single();

    if (graphError || !graph) {
      throw new AppError("图谱不存在", 404, ErrorCodes.NOT_FOUND);
    }

    const settings = (graph.settings as Record<string, unknown>) || {};
    const quadrantViewState = (settings.quadrantViewState as Record<string, unknown>) || {};
    const customRegions = (quadrantViewState.customRegions as CustomRegion[]) || [];

    const regionIndex = customRegions.findIndex((r) => r.id === regionId);

    if (regionIndex === -1) {
      throw new AppError("区域不存在", 404, ErrorCodes.NOT_FOUND);
    }

    const updatedRegion: CustomRegion = {
      ...customRegions[regionIndex],
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    const updatedRegions = [...customRegions];
    updatedRegions[regionIndex] = updatedRegion;

    const updatedSettings = {
      ...settings,
      quadrantViewState: {
        ...quadrantViewState,
        customRegions: updatedRegions,
      },
    };

    const { error: updateError } = await supabase
      .from("knowledge_graphs")
      .update({ settings: updatedSettings })
      .eq("id", graphId)
      .eq("user_id", userId);

    if (updateError) {
      logger.error("更新区域失败", { graphId, regionId, error: updateError.message });
      throw new AppError("更新区域失败", 500, ErrorCodes.INTERNAL_ERROR);
    }

    logger.info("区域更新成功", { graphId, regionId, userId });

    res.json(updatedRegion);
  },
);

router.delete(
  "/:regionId",
  requireAuth,
  validate({ params: regionIdParamsSchema }),
  async (req: AuthRequest, res: Response) => {
    const { graphId, regionId } = req.params;
    const userId = req.user.id;
    const supabase = req.supabase!;

    const { data: graph, error: graphError } = await supabase
      .from("knowledge_graphs")
      .select("id, settings")
      .eq("id", graphId)
      .eq("user_id", userId)
      .is("deleted_at", null)
      .single();

    if (graphError || !graph) {
      throw new AppError("图谱不存在", 404, ErrorCodes.NOT_FOUND);
    }

    const settings = (graph.settings as Record<string, unknown>) || {};
    const quadrantViewState = (settings.quadrantViewState as Record<string, unknown>) || {};
    const customRegions = (quadrantViewState.customRegions as CustomRegion[]) || [];

    const regionIndex = customRegions.findIndex((r) => r.id === regionId);

    if (regionIndex === -1) {
      throw new AppError("区域不存在", 404, ErrorCodes.NOT_FOUND);
    }

    const updatedRegions = customRegions.filter((r) => r.id !== regionId);

    const updatedSettings = {
      ...settings,
      quadrantViewState: {
        ...quadrantViewState,
        customRegions: updatedRegions,
      },
    };

    const { error: updateError } = await supabase
      .from("knowledge_graphs")
      .update({ settings: updatedSettings })
      .eq("id", graphId)
      .eq("user_id", userId);

    if (updateError) {
      logger.error("删除区域失败", { graphId, regionId, error: updateError.message });
      throw new AppError("删除区域失败", 500, ErrorCodes.INTERNAL_ERROR);
    }

    logger.info("区域删除成功", { graphId, regionId, userId });

    res.json({ success: true, message: "区域已删除" });
  },
);

export default router;

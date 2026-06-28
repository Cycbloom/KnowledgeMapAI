import { Router, type Response } from "express";
import { requireAuth, type AuthedRequest } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { AppError } from "../../middleware/errorHandler";
import { ErrorCodes } from "../../../shared/types/errorCodes";
import { logger } from "../../utils/logger";
import { z } from "zod";
import { structureService } from "../../services/story";

const createStoryStructureSchema = z.object({
  structure_level: z.enum(["story", "act", "sequence", "chapter", "scene"]),
  parent_structure_id: z.string().uuid().optional(),
  title: z.string().min(1).max(512),
  synopsis: z.string().max(2000).optional(),
  display_order: z.number().int().min(0),
  template_beat_id: z.string().max(100).optional(),
});

const updateStoryStructureSchema = z.object({
  title: z.string().min(1).max(512).optional(),
  synopsis: z.string().max(2000).optional(),
  display_order: z.number().int().min(0).optional(),
  template_beat_id: z.string().max(100).optional(),
  metadata: z.record(z.unknown()).optional(),
});

const initializeTemplateSchema = z.object({
  templateCode: z.string().min(1).max(100),
});

const router = Router();

router.get("/", requireAuth, async (req: AuthedRequest, res: Response) => {
  const { graphId } = req.params;
  const supabase = req.supabase;

  try {
    const tree = await structureService.listStructures(supabase, graphId);
    res.json({ structures: tree });
  } catch (error: unknown) {
    logger.error("Get story structures error:", error);
    if (error instanceof AppError) throw error;
    throw new AppError("获取故事结构失败", 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
  }
});

router.post(
  "/",
  requireAuth,
  validate(createStoryStructureSchema),
  async (req: AuthedRequest, res: Response) => {
    const { graphId } = req.params;
    const supabase = req.supabase;

    try {
      const structure = await structureService.createStructure(
        supabase,
        graphId,
        req.body,
      );
      res.status(201).json(structure);
    } catch (error: unknown) {
      logger.error("Create story structure error:", error);
      if (error instanceof AppError) throw error;
      throw new AppError("创建故事结构失败", 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }
  },
);

router.put(
  "/:id",
  requireAuth,
  validate(updateStoryStructureSchema),
  async (req: AuthedRequest, res: Response) => {
    const { graphId, id } = req.params;
    const supabase = req.supabase;

    try {
      const structure = await structureService.updateStructure(
        supabase,
        graphId,
        id,
        req.body,
      );
      res.json(structure);
    } catch (error: unknown) {
      logger.error("Update story structure error:", error);
      if (error instanceof AppError) throw error;
      throw new AppError("更新故事结构失败", 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }
  },
);

router.delete("/:id", requireAuth, async (req: AuthedRequest, res: Response) => {
  const { graphId, id } = req.params;
  const supabase = req.supabase;

  try {
    await structureService.deleteStructure(supabase, graphId, id);
    res.json({ message: "故事结构已删除" });
  } catch (error: unknown) {
    logger.error("Delete story structure error:", error);
    if (error instanceof AppError) throw error;
    throw new AppError("删除故事结构失败", 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
  }
});

router.post(
  "/initialize-template",
  requireAuth,
  validate(initializeTemplateSchema),
  async (req: AuthedRequest, res: Response) => {
    const { graphId } = req.params;
    const { templateCode } = req.body;
    const supabase = req.supabase;

    try {
      const result = await structureService.initializeFromTemplate(
        supabase,
        graphId,
        templateCode,
      );
      res.status(201).json(result);
    } catch (error: unknown) {
      logger.error("Initialize template error:", error);
      if (error instanceof AppError) throw error;
      throw new AppError("初始化模板失败", 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }
  },
);

export default router;

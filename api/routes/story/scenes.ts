import { Router, type Response } from "express";
import { requireAuth, type AuthRequest } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { AppError } from "../../middleware/errorHandler";
import { ErrorCodes } from "../../../shared/types/errorCodes";
import { logger } from "../../utils/logger";
import { z } from "zod";

const createSceneDetailSchema = z.object({
  structure_id: z.string().uuid(),
  pov_character_id: z.string().uuid().optional(),
  synopsis: z.string().optional(),
  content: z.string().optional(),
  location_name: z.string().max(255).optional(),
  time_setting: z.string().max(100).optional(),
  writing_status: z
    .enum(["draft", "revising", "complete"])
    .optional()
    .default("draft"),
  word_count: z.number().int().min(0).optional().default(0),
});

const updateSceneDetailSchema = z.object({
  pov_character_id: z.string().uuid().optional(),
  synopsis: z.string().optional(),
  content: z.string().optional(),
  location_name: z.string().max(255).optional(),
  time_setting: z.string().max(100).optional(),
  writing_status: z.enum(["draft", "revising", "complete"]).optional(),
  word_count: z.number().int().min(0).optional(),
});

const router = Router();

router.get(
  "/:structureId",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const { graphId, structureId } = req.params;
    const supabase = req.supabase!;

    try {
      const { data: scene, error } = await supabase
        .from("story_scene_details")
        .select(
          `
          *,
          story_characters!pov_character_id (
            id,
            name,
            role_type
          )
        `,
        )
        .eq("graph_id", graphId)
        .eq("structure_id", structureId)
        .maybeSingle();

      if (error) throw error;

      if (!scene) {
        return res.json({ scene: null });
      }

      const { data: appearances } = await supabase
        .from("story_appearances")
        .select(
          `
          id,
          character_id,
          role_in_scene,
          notes,
          story_characters!character_id (
            id,
            name,
            role_type
          )
        `,
        )
        .eq("scene_detail_id", scene.id);

      res.json({
        scene: {
          ...scene,
          appearances: appearances || [],
        },
      });
    } catch (error: unknown) {
      logger.error("Get scene detail error:", error);
      if (error instanceof AppError) throw error;
      throw new AppError(
        "获取场景详情失败",
        500,
        ErrorCodes.INTERNAL_ERROR,
      );
    }
  },
);

router.post(
  "/",
  requireAuth,
  validate(createSceneDetailSchema),
  async (req: AuthRequest, res: Response) => {
    const { graphId } = req.params;
    const supabase = req.supabase!;

    try {
      const {
        structure_id,
        pov_character_id,
        synopsis,
        content,
        location_name,
        time_setting,
        writing_status,
        word_count,
      } = req.body;

      const insertData = {
        graph_id: graphId,
        structure_id,
        pov_character_id: pov_character_id || null,
        synopsis: synopsis || null,
        content: content || null,
        location_name: location_name || null,
        time_setting: time_setting || null,
        writing_status: writing_status || "draft",
        word_count: word_count || 0,
      };

      const { data: scene, error } = await supabase
        .from("story_scene_details")
        .insert(insertData)
        .select()
        .single();

      if (error) throw error;

      res.status(201).json(scene);
    } catch (error: unknown) {
      logger.error("Create scene detail error:", error);
      if (error instanceof AppError) throw error;
      throw new AppError(
        "创建场景详情失败",
        500,
        ErrorCodes.INTERNAL_ERROR,
      );
    }
  },
);

router.put(
  "/:id",
  requireAuth,
  validate(updateSceneDetailSchema),
  async (req: AuthRequest, res: Response) => {
    const { graphId, id } = req.params;
    const supabase = req.supabase!;

    try {
      const updateData = {
        ...req.body,
        updated_at: new Date().toISOString(),
      };

      const { data: scene, error } = await supabase
        .from("story_scene_details")
        .update(updateData)
        .eq("id", id)
        .eq("graph_id", graphId)
        .select()
        .single();

      if (error) throw error;

      if (!scene) {
        throw new AppError("场景详情不存在", 404, ErrorCodes.NOT_FOUND);
      }

      res.json(scene);
    } catch (error: unknown) {
      logger.error("Update scene detail error:", error);
      if (error instanceof AppError) throw error;
      throw new AppError(
        "更新场景详情失败",
        500,
        ErrorCodes.INTERNAL_ERROR,
      );
    }
  },
);

export default router;

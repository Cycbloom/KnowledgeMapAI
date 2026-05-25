import { Router, type Response } from "express";
import { requireAuth, type AuthRequest } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { AppError } from "../../middleware/errorHandler";
import { ErrorCodes } from "../../../shared/types/errorCodes";
import { logger } from "../../utils/logger";
import { z } from "zod";

const createAppearanceSchema = z.object({
  character_id: z.string().uuid(),
  scene_detail_id: z.string().uuid(),
  role_in_scene: z
    .enum(["protagonist", "antagonist", "supporting", "minor", "mentioned"])
    .optional()
    .default("supporting"),
  notes: z.string().optional(),
});

const router = Router();

router.post(
  "/",
  requireAuth,
  validate(createAppearanceSchema),
  async (req: AuthRequest, res: Response) => {
    const { graphId } = req.params;
    const supabase = req.supabase!;

    try {
      const { character_id, scene_detail_id, role_in_scene, notes } = req.body;

      const insertData = {
        graph_id: graphId,
        character_id,
        scene_detail_id,
        role_in_scene: role_in_scene || "supporting",
        notes: notes || null,
      };

      const { data: appearance, error } = await supabase
        .from("story_appearances")
        .insert(insertData)
        .select()
        .single();

      if (error) throw error;

      res.status(201).json(appearance);
    } catch (error: unknown) {
      logger.error("Create appearance error:", error);
      if (error instanceof AppError) throw error;
      throw new AppError(
        "添加出场记录失败",
        500,
        ErrorCodes.INTERNAL_ERROR,
      );
    }
  },
);

router.delete("/:id", requireAuth, async (req: AuthRequest, res: Response) => {
  const { graphId, id } = req.params;
  const supabase = req.supabase!;

  try {
    const { error } = await supabase
      .from("story_appearances")
      .delete()
      .eq("id", id)
      .eq("graph_id", graphId);

    if (error) throw error;

    res.json({ message: "出场记录已删除" });
  } catch (error: unknown) {
    logger.error("Delete appearance error:", error);
    if (error instanceof AppError) throw error;
    throw new AppError(
      "删除出场记录失败",
      500,
      ErrorCodes.INTERNAL_ERROR,
    );
  }
});

router.get(
  "/stats/:characterId",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const { graphId, characterId } = req.params;
    const supabase = req.supabase!;

    try {
      const [
        { data: appearances },
        { data: relationships },
      ] = await Promise.all([
        supabase
          .from("story_appearances")
          .select(
            `
            id,
            scene_detail_id,
            role_in_scene,
            notes,
            story_scene_details!scene_detail_id (
              id,
              structure_id,
              location_name,
              writing_status
            ),
            story_structures!story_scene_details_structure_id_fkey (
              id,
              title,
              structure_level
            )
          `,
          )
          .eq("graph_id", graphId)
          .eq("character_id", characterId),
        supabase
          .from("story_character_relationships")
          .select(
            `
            id,
            relationship_type,
            strength,
            status,
            notes,
            target_character_id,
            story_characters!target_character_id (
              id,
              name,
              role_type
            )
          `,
          )
          .eq("graph_id", graphId)
          .eq("source_character_id", characterId),
      ]);

      const roleStats = {
        protagonist: 0,
        antagonist: 0,
        supporting: 0,
        minor: 0,
        mentioned: 0,
      };

      (appearances || []).forEach((app) => {
        const role = app.role_in_scene as keyof typeof roleStats;
        if (role in roleStats) {
          roleStats[role]++;
        }
      });

      const totalAppearances = appearances?.length || 0;
      const totalRelationships = relationships?.length || 0;

      res.json({
        characterId,
        stats: {
          totalAppearances,
          totalRelationships,
          roleBreakdown: roleStats,
        },
        appearances: appearances || [],
        relationships: relationships || [],
      });
    } catch (error: unknown) {
      logger.error("Get appearance stats error:", error);
      if (error instanceof AppError) throw error;
      throw new AppError(
        "获取出场统计失败",
        500,
        ErrorCodes.INTERNAL_ERROR,
      );
    }
  },
);

export default router;

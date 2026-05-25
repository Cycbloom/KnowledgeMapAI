import { Router, type Response } from "express";
import { requireAuth, type AuthRequest } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { AppError } from "../../middleware/errorHandler";
import { ErrorCodes } from "../../../shared/types/errorCodes";
import { logger } from "../../utils/logger";
import { z } from "zod";

const createCharacterSchema = z.object({
  name: z.string().min(1).max(255),
  role_type: z.enum(["protagonist", "antagonist", "supporting", "minor"]),
  archetype: z.string().max(100).optional(),
  appearance: z.string().optional(),
  age: z.string().max(50).optional(),
  gender: z.string().max(20).optional(),
  motivation: z.string().optional(),
  fear: z.string().optional(),
  desire: z.string().optional(),
  flaw: z.string().optional(),
  backstory: z.string().optional(),
  arc_start: z.string().optional(),
  arc_end: z.string().optional(),
});

const updateCharacterSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  role_type: z
    .enum(["protagonist", "antagonist", "supporting", "minor"])
    .optional(),
  archetype: z.string().max(100).optional(),
  appearance: z.string().optional(),
  age: z.string().max(50).optional(),
  gender: z.string().max(20).optional(),
  motivation: z.string().optional(),
  fear: z.string().optional(),
  desire: z.string().optional(),
  flaw: z.string().optional(),
  backstory: z.string().optional(),
  arc_start: z.string().optional(),
  arc_end: z.string().optional(),
});

const router = Router();

router.get("/", requireAuth, async (req: AuthRequest, res: Response) => {
  const { graphId } = req.params;
  const supabase = req.supabase!;

  try {
    const { data: characters, error } = await supabase
      .from("story_characters")
      .select("*")
      .eq("graph_id", graphId)
      .order("created_at", { ascending: true });

    if (error) throw error;

    let charactersWithStats = characters || [];

    if (charactersWithStats.length > 0) {
      const [
        { data: relationships },
        { data: appearances },
      ] = await Promise.all([
        supabase
          .from("story_character_relationships")
          .select(
            "source_character_id, target_character_id, relationship_type",
          )
          .eq("graph_id", graphId),
        supabase
          .from("story_appearances")
          .select("character_id")
          .eq("graph_id", graphId),
      ]);

      const relationshipCountMap = new Map<string, number>();
      (relationships || []).forEach((rel) => {
        relationshipCountMap.set(
          rel.source_character_id,
          (relationshipCountMap.get(rel.source_character_id) || 0) + 1,
        );
      });

      const appearanceCountMap = new Map<string, number>();
      (appearances || []).forEach((app) => {
        appearanceCountMap.set(
          app.character_id,
          (appearanceCountMap.get(app.character_id) || 0) + 1,
        );
      });

      charactersWithStats = charactersWithStats.map((character) => ({
        ...character,
        _count: {
          relationships:
            relationshipCountMap.get(character.id) || 0,
          appearances: appearanceCountMap.get(character.id) || 0,
        },
      }));
    }

    res.json({ characters: charactersWithStats });
  } catch (error: unknown) {
    logger.error("Get story characters error:", error);
    if (error instanceof AppError) throw error;
    throw new AppError(
      "获取角色列表失败",
      500,
      ErrorCodes.INTERNAL_ERROR,
    );
  }
});

router.post(
  "/",
  requireAuth,
  validate(createCharacterSchema),
  async (req: AuthRequest, res: Response) => {
    const { graphId } = req.params;
    const supabase = req.supabase!;

    try {
      const insertData = {
        graph_id: graphId,
        ...req.body,
      };

      const { data: character, error } = await supabase
        .from("story_characters")
        .insert(insertData)
        .select()
        .single();

      if (error) throw error;

      res.status(201).json(character);
    } catch (error: unknown) {
      logger.error("Create story character error:", error);
      if (error instanceof AppError) throw error;
      throw new AppError(
        "创建角色失败",
        500,
        ErrorCodes.INTERNAL_ERROR,
      );
    }
  },
);

router.put(
  "/:id",
  requireAuth,
  validate(updateCharacterSchema),
  async (req: AuthRequest, res: Response) => {
    const { graphId, id } = req.params;
    const supabase = req.supabase!;

    try {
      const updateData = {
        ...req.body,
        updated_at: new Date().toISOString(),
      };

      const { data: character, error } = await supabase
        .from("story_characters")
        .update(updateData)
        .eq("id", id)
        .eq("graph_id", graphId)
        .select()
        .single();

      if (error) throw error;

      if (!character) {
        throw new AppError("角色不存在", 404, ErrorCodes.NOT_FOUND);
      }

      res.json(character);
    } catch (error: unknown) {
      logger.error("Update story character error:", error);
      if (error instanceof AppError) throw error;
      throw new AppError(
        "更新角色失败",
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
      .from("story_characters")
      .delete()
      .eq("id", id)
      .eq("graph_id", graphId);

    if (error) throw error;

    res.json({ message: "角色已删除" });
  } catch (error: unknown) {
    logger.error("Delete story character error:", error);
    if (error instanceof AppError) throw error;
    throw new AppError(
      "删除角色失败",
      500,
      ErrorCodes.INTERNAL_ERROR,
    );
  }
});

export default router;

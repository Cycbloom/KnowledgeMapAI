import { Router, type Response } from "express";
import { requireAuth, type AuthRequest } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { AppError } from "../../middleware/errorHandler";
import { ErrorCodes } from "../../../shared/types/errorCodes";
import { logger } from "../../utils/logger";
import { z } from "zod";

const createRelationshipSchema = z.object({
  source_character_id: z.string().uuid(),
  target_character_id: z.string().uuid(),
  relationship_type: z.string().min(1).max(50),
  strength: z.number().int().min(1).max(10).optional().default(5),
  status: z.string().optional().default("active"),
  notes: z.string().optional(),
});

const router = Router();

// GET / - List relationships for a graph
router.get("/", requireAuth, async (req: AuthRequest, res: Response) => {
  const { graphId } = req.params;
  const supabase = req.supabase!;

  try {
    const { data: relationships, error } = await supabase
      .from("story_character_relationships")
      .select(
        `
        *,
        source_character:story_characters!source_character_id (id, name, role_type),
        target_character:story_characters!target_character_id (id, name, role_type)
      `,
      )
      .eq("graph_id", graphId)
      .order("created_at", { ascending: true });

    if (error) throw error;

    res.json({ relationships: relationships || [] });
  } catch (error: unknown) {
    logger.error("Get relationships error:", error);
    if (error instanceof AppError) throw error;
    throw new AppError(
      "获取角色关系失败",
      500,
      ErrorCodes.INTERNAL_ERROR,
    );
  }
});

// POST / - Create a new relationship
router.post(
  "/",
  requireAuth,
  validate(createRelationshipSchema),
  async (req: AuthRequest, res: Response) => {
    const { graphId } = req.params;
    const supabase = req.supabase!;

    try {
      const {
        source_character_id,
        target_character_id,
        relationship_type,
        strength,
        status,
        notes,
      } = req.body;

      const insertData = {
        graph_id: graphId,
        source_character_id,
        target_character_id,
        relationship_type,
        strength: strength ?? 5,
        status: status ?? "active",
        notes: notes || null,
      };

      const { data: relationship, error } = await supabase
        .from("story_character_relationships")
        .insert(insertData)
        .select(
          `
          *,
          source_character:story_characters!source_character_id (id, name, role_type),
          target_character:story_characters!target_character_id (id, name, role_type)
        `,
        )
        .single();

      if (error) throw error;

      res.status(201).json(relationship);
    } catch (error: unknown) {
      logger.error("Create relationship error:", error);
      if (error instanceof AppError) throw error;
      throw new AppError(
        "创建角色关系失败",
        500,
        ErrorCodes.INTERNAL_ERROR,
      );
    }
  },
);

// DELETE /:id - Delete a relationship
router.delete(
  "/:id",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const { graphId, id } = req.params;
    const supabase = req.supabase!;

    try {
      const { error } = await supabase
        .from("story_character_relationships")
        .delete()
        .eq("id", id)
        .eq("graph_id", graphId);

      if (error) throw error;

      res.json({ message: "角色关系已删除" });
    } catch (error: unknown) {
      logger.error("Delete relationship error:", error);
      if (error instanceof AppError) throw error;
      throw new AppError(
        "删除角色关系失败",
        500,
        ErrorCodes.INTERNAL_ERROR,
      );
    }
  },
);

export default router;

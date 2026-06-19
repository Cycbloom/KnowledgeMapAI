import { Router, type Response } from "express";
import { requireAuth, type AuthRequest } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { z } from "zod";
import { relationshipService } from "../../services/story";

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

  const relationships = await relationshipService.list(supabase, graphId);

  res.json({ relationships });
});

// POST / - Create a new relationship
router.post(
  "/",
  requireAuth,
  validate(createRelationshipSchema),
  async (req: AuthRequest, res: Response) => {
    const { graphId } = req.params;
    const supabase = req.supabase!;

    const {
      source_character_id,
      target_character_id,
      relationship_type,
      strength,
      status,
      notes,
    } = req.body;

    const relationship = await relationshipService.create(supabase, graphId, {
      source_character_id,
      target_character_id,
      relationship_type,
      strength: strength ?? 5,
      status: status ?? "active",
      notes: notes || undefined,
    });

    res.status(201).json(relationship);
  },
);

// DELETE /:id - Delete a relationship
router.delete(
  "/:id",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const { graphId, id } = req.params;
    const supabase = req.supabase!;

    await relationshipService.delete(supabase, graphId, id);

    res.json({ message: "角色关系已删除" });
  },
);

export default router;

import { Router, type Response } from "express";
import { requireAuth, type AuthRequest } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { z } from "zod";
import { appearanceService } from "../../services/story";

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

    const { character_id, scene_detail_id, role_in_scene, notes } = req.body;

    const appearance = await appearanceService.create(supabase, graphId, {
      character_id,
      scene_detail_id,
      role_in_scene: role_in_scene || "supporting",
      notes: notes || undefined,
    });

    res.status(201).json(appearance);
  },
);

router.delete("/:id", requireAuth, async (req: AuthRequest, res: Response) => {
  const { graphId, id } = req.params;
  const supabase = req.supabase!;

  await appearanceService.delete(supabase, graphId, id);

  res.json({ message: "出场记录已删除" });
});

router.get(
  "/stats/:characterId",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const { graphId, characterId } = req.params;
    const supabase = req.supabase!;

    const result = await appearanceService.getStats(
      supabase,
      graphId,
      characterId,
    );

    res.json(result);
  },
);

export default router;

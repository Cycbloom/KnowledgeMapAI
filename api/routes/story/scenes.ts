import { Router, type Response } from "express";
import { requireAuth, type AuthedRequest } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { z } from "zod";
import { sceneService } from "../../services/story";

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
  async (req: AuthedRequest, res: Response) => {
    const { graphId, structureId } = req.params;
    const supabase = req.supabase;

    const result = await sceneService.get(supabase, graphId, structureId);

    res.json(result);
  },
);

router.post(
  "/",
  requireAuth,
  validate(createSceneDetailSchema),
  async (req: AuthedRequest, res: Response) => {
    const { graphId } = req.params;
    const supabase = req.supabase;

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

    const scene = await sceneService.create(supabase, graphId, {
      structure_id,
      pov_character_id: pov_character_id || undefined,
      synopsis: synopsis || undefined,
      content: content || undefined,
      location_name: location_name || undefined,
      time_setting: time_setting || undefined,
      writing_status: writing_status || "draft",
      word_count: word_count || 0,
    });

    res.status(201).json(scene);
  },
);

router.put(
  "/:id",
  requireAuth,
  validate(updateSceneDetailSchema),
  async (req: AuthedRequest, res: Response) => {
    const { graphId, id } = req.params;
    const supabase = req.supabase;

    const scene = await sceneService.update(supabase, graphId, id, req.body);

    res.json(scene);
  },
);

export default router;

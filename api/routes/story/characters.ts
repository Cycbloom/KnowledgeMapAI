import { Router, type Response } from "express";
import { requireAuth, type AuthedRequest } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { characterService } from "../../services/story";
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

router.get("/", requireAuth, async (req: AuthedRequest, res: Response) => {
  const { graphId } = req.params;
  const { characters } = await characterService.list(req.supabase, graphId);
  res.json({ characters });
});

router.post(
  "/",
  requireAuth,
  validate(createCharacterSchema),
  async (req: AuthedRequest, res: Response) => {
    const { graphId } = req.params;
    const character = await characterService.create(
      req.supabase,
      graphId,
      req.body,
    );
    res.status(201).json(character);
  },
);

router.put(
  "/:id",
  requireAuth,
  validate(updateCharacterSchema),
  async (req: AuthedRequest, res: Response) => {
    const { graphId, id } = req.params;
    const character = await characterService.update(
      req.supabase,
      graphId,
      id,
      req.body,
    );
    res.json(character);
  },
);

router.delete("/:id", requireAuth, async (req: AuthedRequest, res: Response) => {
  const { graphId, id } = req.params;
  await characterService.delete(req.supabase, graphId, id);
  res.json({ message: "角色已删除" });
});

export default router;

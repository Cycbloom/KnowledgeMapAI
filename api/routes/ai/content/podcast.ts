import { Router, type Response } from "express";
import { requireAuth, type AuthedRequest } from "../../../middleware/auth";
import { validate } from "../../../middleware/validate";
import { podcastScriptSchema } from "../../../schemas/index";
import { aiService } from "../../../services/ai";

const router = Router();

router.post(
  "/podcast/script",
  requireAuth,
  validate(podcastScriptSchema),
  async (req: AuthedRequest, res: Response) => {
    const { context, language } = req.body;

    const script = await aiService.generatePodcastScript(context, language);
    res.json({ script });
  },
);

export default router;

import { Router, type Response } from "express";
import { requireAuth, type AuthedRequest } from "../../../middleware/auth";
import { validate } from "../../../middleware/validate";
import { podcastScriptSchema } from "../../../schemas/index";
import { ErrorCodes } from "../../../../shared/types/errorCodes";
import { AppError } from "../../../middleware/errorHandler";
import { aiService } from "../../../services/ai";
import { logger } from "../../../utils/logger";

const router = Router();

router.post(
  "/podcast/script",
  requireAuth,
  validate(podcastScriptSchema),
  async (req: AuthedRequest, res: Response) => {
    const { context, language } = req.body;

    try {
      const script = await aiService.generatePodcastScript(context, language);
      res.json({ script });
    } catch (error: unknown) {
      const err = error as Error;
      logger.error("Podcast Script Generation Error:", error);
      throw new AppError(err.message, 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }
  },
);

export default router;

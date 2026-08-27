import { Router, type Response } from "express";
import { requireAuth, type AuthedRequest } from "../../../middleware/auth";
import { validate } from "../../../middleware/validate";
import { z } from "zod";
import { nodeStyleService } from "../../../services/ai";
import { logger } from "../../../utils/logger";

const router = Router();

const suggestNodeStylesSchema = z.object({
  body: z.object({
    nodes: z
      .array(
        z.object({
          id: z.string(),
          title: z.string(),
          content: z.string().optional(),
          level: z.string().optional(),
        }),
      )
      .min(1)
      .max(100),
    language: z.string().optional(),
  }),
});

/**
 * POST /ai/suggest-node-styles
 * 为图谱节点批量推荐颜色与图标。
 */
router.post(
  "/suggest-node-styles",
  requireAuth,
  validate(suggestNodeStylesSchema),
  async (req: AuthedRequest, res: Response) => {
    const { nodes, language } = req.body;

    try {
      const result = await nodeStyleService.suggestStyles(nodes, language);
      res.json(result);
    } catch (error) {
      logger.error("Suggest node styles error:", error);
      res.status(500).json({ suggestions: [], usedDefault: true });
    }
  },
);

export default router;

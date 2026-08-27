import { Router, type Response } from "express";
import { requireAuth, type AuthedRequest } from "../../../middleware/auth";
import { validate } from "../../../middleware/validate";
import { z } from "zod";
import { nodeTranslationService } from "../../../services/ai";
import { logger } from "../../../utils/logger";

const router = Router();

const translateNodesSchema = z.object({
  body: z.object({
    nodes: z
      .array(
        z.object({
          id: z.string(),
          title: z.string(),
          content: z.string().optional(),
          summary: z.string().optional(),
        }),
      )
      .min(1)
      .max(50),
    target_language: z.string().min(1).max(20),
  }),
});

/**
 * POST /ai/translate-nodes
 * 按字段型 schema（标题/内容/摘要）翻译图谱节点为目标语言（返回预览，不直接写库）。
 */
router.post(
  "/translate-nodes",
  requireAuth,
  validate(translateNodesSchema),
  async (req: AuthedRequest, res: Response) => {
    const { nodes, target_language } = req.body;

    try {
      const result = await nodeTranslationService.translateNodes(
        nodes,
        target_language,
      );
      res.json(result);
    } catch (error) {
      logger.error("Translate nodes error:", error);
      res.status(500).json({ translations: [], usedDefault: true });
    }
  },
);

export default router;

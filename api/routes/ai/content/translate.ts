import { Router, type Response } from "express";
import { requireAuth, type AuthedRequest } from "../../../middleware/auth";
import { validate } from "../../../middleware/validate";
import { z } from "zod";
import { nodeTranslationService, textTranslationService } from "../../../services/ai";
import { logger } from "../../../utils/logger";

const router = Router();

const translateNodesSchema = z.object({
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
});

/**
 * POST /ai/translate-nodes
 * 按字段型 schema（标题/内容/摘要）翻译图谱节点为目标语言（返回预览，不直接写库）。
 */
router.post(
  "/translate-nodes",
  requireAuth,
  validate({ body: translateNodesSchema }),
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

/**
 * POST /ai/translate-text
 * 选词翻译：把阅读时选中的单词/短语翻译为目标语言（默认简体中文）。
 */
const translateTextSchema = z.object({
  text: z.string().min(1).max(500),
  context: z.string().max(2000).optional(),
  target_language: z.string().min(1).max(20).default("zh-CN"),
});

router.post(
  "/translate-text",
  requireAuth,
  validate({ body: translateTextSchema }),
  async (req: AuthedRequest, res: Response) => {
    const { text, context, target_language } = req.body;
    try {
      const result = await textTranslationService.translateText(
        text,
        target_language,
        context,
      );
      res.json(result);
    } catch (error) {
      logger.error("Translate text error:", error);
      res.status(500).json({ translation: text, usedDefault: true });
    }
  },
);

export default router;

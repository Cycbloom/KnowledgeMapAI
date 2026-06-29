import { Router, type Response } from "express";
import { requireAuth, type AuthedRequest } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { AppError } from "../../middleware/errorHandler";
import { ErrorCodes } from "../../../shared/types/errorCodes";
import { getAIProviderForTask, promptService } from "../../services/ai";
import { withAIMonitoring } from "../../services/ai/aiMonitor";
import { logger } from "../../utils/logger";
import { z } from "zod";

const router = Router();

const optimizePromptSchema = z.object({
  topic: z.string().min(1),
  currentPrompt: z.string().optional(),
});

router.post(
  "/optimize-prompt",
  requireAuth,
  validate(optimizePromptSchema),
  async (req: AuthedRequest, res: Response) => {
    const { topic, currentPrompt } = req.body;
    const supabase = req.supabase;
    const provider = await getAIProviderForTask("text");

    if (!provider.hasKey) {
      throw new AppError(
        "AI provider not configured",
        503,
        ErrorCodes.SYSTEM_INTERNAL_ERROR,
      );
    }

    try {
      const systemPrompt = await promptService.getRenderedPrompt(
        supabase,
        "optimize_prompt",
        {
          topic,
          currentPrompt: currentPrompt || "",
          hasCurrentPrompt: !!currentPrompt,
        },
        req.user.id,
      );

      const userMessage = `主题：${topic}

${currentPrompt ? `用户当前的自定义规则：\n${currentPrompt}` : "用户尚未输入任何规则，请根据主题生成一个合适的默认规则。"}

请优化这个规则，使其更适合生成知识图谱节点。`;

      const completion = await withAIMonitoring(
        {
          operation: "auto_graph_optimize_prompt",
          provider: provider.providerType,
          model: provider.model,
          metadata: { userId: req.user.id },
        },
        async () => {
          const result = await provider.client.chat.completions.create({
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userMessage },
            ],
            model: provider.model,
            response_format: { type: "json_object" },
            max_tokens: 1000,
          });
          return {
            result,
            usage: result.usage as
              | { prompt_tokens?: number; completion_tokens?: number }
              | undefined,
          };
        },
      );

      const content = completion.choices[0].message.content;
      let parsed;
      try {
        parsed = JSON.parse(content || '{"optimizedPrompt": ""}');
      } catch (e) {
        throw new AppError("优化结果解析失败", 422, ErrorCodes.SYSTEM_INTERNAL_ERROR);
      }

      res.json({ optimizedPrompt: parsed.optimizedPrompt || "" });
    } catch (error) {
      const err = error as Error;
      logger.error("Optimize Prompt Error:", error);
      if (error instanceof AppError) throw error;
      throw new AppError(
        err.message || "优化失败",
        500,
        ErrorCodes.SYSTEM_INTERNAL_ERROR,
      );
    }
  },
);

export default router;

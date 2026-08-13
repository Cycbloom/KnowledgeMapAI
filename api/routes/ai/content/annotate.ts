import { Router, type Response } from "express";
import { requireAuth, type AuthedRequest } from "../../../middleware/auth";
import { validate } from "../../../middleware/validate";
import { annotateTermsSchema } from "../../../schemas/index";
import { ErrorCodes } from "../../../../shared/types/errorCodes";
import { AppError } from "../../../middleware/errorHandler";
import {
  getAIProviderForTask,
  promptService,
  enrichMetadata,
  performanceMonitor,
  pricingService,
  annotationService,
} from "../../../services/ai";
import { logger } from "../../../utils/logger";

const router = Router();

router.post(
  "/annotate-terms",
  requireAuth,
  validate(annotateTermsSchema),
  async (req: AuthedRequest, res: Response) => {
    const { content, graph_id } = req.body;
    const provider = await getAIProviderForTask("text");

    if (!provider.hasKey) {
      throw new AppError(
        "AI provider not configured",
        503,
        ErrorCodes.SYSTEM_INTERNAL_ERROR,
      );
    }

    try {
      const prompt = await promptService.getRenderedPrompt(
        req.supabase,
        "term_annotation",
        { nodeContent: content },
        req.user.id,
        graph_id,
      );

      const enrichedMetadata = await enrichMetadata(req.supabase, {
        graphId: graph_id,
        userId: req.user.id,
        topic: content?.slice(0, 50),
      });

      const startTime = Date.now();
      const completion = await provider.client.chat.completions.create({
        messages: [{ role: "user", content: prompt }],
        model: provider.model,
        response_format: { type: "json_object" },
      });
      const duration = Date.now() - startTime;

      const usage = completion.usage;
      if (usage) {
        const cost = pricingService.calculateCost(
          provider.providerType,
          provider.model,
          usage.prompt_tokens,
          usage.completion_tokens,
          0
        );
        await performanceMonitor.recordLog({
          operation: 'annotate_terms',
          provider: provider.providerType,
          model: provider.model,
          inputTokens: usage.prompt_tokens,
          outputTokens: usage.completion_tokens,
          totalTokens: usage.prompt_tokens + usage.completion_tokens,
          cachedInputTokens: 0,
          duration,
          success: true,
          estimatedCost: cost,
          metadata: enrichedMetadata,
        });
      }

      const aiContent = completion.choices[0].message.content || "{}";
      const terms = annotationService.parseTermsResponse(aiContent);
      const annotatedContent = annotationService.annotateContent(content || "", terms);

      res.json({ content: annotatedContent });
    } catch (error: unknown) {
      const err = error as Error;
      logger.error("Annotate Terms Error:", error);
      throw new AppError(err.message || "Annotation failed", 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }
  },
);

export default router;

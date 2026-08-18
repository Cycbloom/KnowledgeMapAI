import { Router, type Response } from "express";
import { requireAuth, type AuthedRequest } from "../../../middleware/auth";
import { validate } from "../../../middleware/validate";
import {
  generateContentSchema,
  generateLearningMaterialSchema,
  assistLearningSchemaSchema,
} from "../../../schemas/index";
import { ErrorCodes } from "../../../../shared/types/errorCodes";
import { AppError } from "../../../middleware/errorHandler";
import {
  aiService,
  getMockResponse,
  getAIProviderForTask,
  getAIProvider,
  promptService,
  performanceMonitor,
  enrichMetadata,
  pricingService,
  annotationService,
} from "../../../services/ai";
import { logger } from "../../../utils/logger";
import {
  setSSEHeaders,
  sendStreamChunk,
  sendStreamDone,
  sendStreamError,
} from "../utils";

const router = Router();

router.post(
  "/generate-content",
  requireAuth,
  validate(generateContentSchema),
  async (req: AuthedRequest, res: Response) => {
    const {
      topic,
      context,
      provider: providerType,
      model,
      graph_id,
      level,
      language,
    } = req.body;
    const provider = providerType
      ? await getAIProvider(providerType)
      : await getAIProviderForTask("text");

    if (!provider.hasKey) {
      return res.json({ content: getMockResponse("content", topic) as string });
    }

    try {
      const templateContext = annotationService.buildTemplateContext(topic, context, level);

      const systemPrompt = await promptService.getRenderedPrompt(
        req.supabase,
        "generate_content",
        templateContext,
        req.user.id,
        graph_id,
        language,
      );

      const enrichedMetadata = await enrichMetadata(req.supabase, {
        graphId: graph_id,
        userId: req.user.id,
        topic,
        nodeLevel: level,
      });

      const startTime = Date.now();
      const completion = await provider.client.chat.completions.create({
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `Topic: ${topic}\nContext: ${context || "General knowledge"}`,
          },
        ],
        model: model || provider.model,
      });
      const duration = Date.now() - startTime;

      const usage = completion.usage;
      if (usage) {
        const cost = pricingService.calculateCost(
          provider.providerType,
          model || provider.model,
          usage.prompt_tokens,
          usage.completion_tokens,
          0
        );
        await performanceMonitor.recordLog({
          operation: 'generate_content',
          provider: provider.providerType,
          model: model || provider.model,
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

      res.json({ content: completion.choices[0].message.content });
    } catch (error: unknown) {
      const err = error as Error;
      logger.error("AI Error:", error);
      throw new AppError(err.message || "AI 生成失败", 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }
  },
);

router.post(
  "/learning-material",
  requireAuth,
  validate(generateLearningMaterialSchema),
  async (req: AuthedRequest, res: Response) => {
    const { topic, context, level, provider, model, graph_id, language, schema_id } =
      req.body;

    try {
      const result = await aiService.generateLearningMaterial(topic, context, {
        provider,
        model,
        level,
        userId: req.user.id,
        graphId: graph_id,
        language,
        schema_id,
      });
      res.json({ content: result.content, keywords: result.keywords });
    } catch (error: unknown) {
      const err = error as Error;
      logger.error("AI Learning Material Error:", error);
      throw new AppError(err.message || "AI 生成学习内容失败", 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }
  },
);

// AI 辅助设计/优化学习材料章节结构
router.post(
  "/learning-material-schema/assist",
  requireAuth,
  validate(assistLearningSchemaSchema),
  async (req: AuthedRequest, res: Response) => {
    const { mode, topic, goal, existing_sections, provider, model, language, graph_id } =
      req.body;

    try {
      const result = await aiService.assistLearningSchema(mode, topic, {
        goal,
        existingSections: existing_sections,
        language,
        userId: req.user.id,
        graphId: graph_id,
        provider,
        model,
      });
      res.json(result);
    } catch (error: unknown) {
      if (error instanceof AppError) throw error;
      const err = error as Error;
      logger.error("AI Assist Learning Schema Error:", error);
      throw new AppError(err.message || "AI 辅助章节结构失败", 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }
  },
);

router.post(
  "/generate-content-stream",
  requireAuth,
  validate(generateContentSchema),
  async (req: AuthedRequest, res: Response) => {
    const {
      topic,
      context,
      level,
      provider: providerType,
      model,
      graph_id,
      language,
    } = req.body;
    const provider = providerType
      ? await getAIProvider(providerType)
      : await getAIProviderForTask("text");

    setSSEHeaders(res);

    if (!provider.hasKey) {
      const mockContent = getMockResponse("content", topic) as string;
      const chunks = mockContent.split("");

      const sendMockChunks = async () => {
        for (const chunk of chunks) {
          sendStreamChunk(res, chunk);
          await new Promise((resolve) => setTimeout(resolve, 30));
        }
        sendStreamDone(res);
      };

      sendMockChunks();
      return;
    }

    try {
      const templateContext = annotationService.buildTemplateContext(topic, context, level);

      const systemPrompt = await promptService.getRenderedPrompt(
        req.supabase,
        "generate_content",
        templateContext,
        req.user.id,
        graph_id,
        language,
      );

      const enrichedMetadata = await enrichMetadata(req.supabase, {
        graphId: graph_id,
        userId: req.user.id,
        topic,
        nodeLevel: level,
      });

      const startTime = Date.now();
      const stream = await provider.client.chat.completions.create({
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `Topic: ${topic}\nContext: ${context || "General knowledge"}`,
          },
        ],
        model: model || provider.model,
        stream: true,
      });

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || "";
        if (content) {
          sendStreamChunk(res, content);
        }
      }
      const duration = Date.now() - startTime;

      await performanceMonitor.recordLog({
        operation: 'generate_content_stream',
        provider: provider.providerType,
        model: model || provider.model,
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        cachedInputTokens: 0,
        duration,
        success: true,
        estimatedCost: 0,
        metadata: enrichedMetadata,
      });

      sendStreamDone(res);
    } catch (error: unknown) {
      const err = error as Error;
      logger.error("AI Stream Error:", error);
      sendStreamError(
        res,
        err.message || "AI 生成失败",
        ErrorCodes.SYSTEM_INTERNAL_ERROR,
      );
    }
  },
);

export default router;

import { Router, type Response } from "express";
import { requireAuth, type AuthRequest } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import {
  generateContentSchema,
  generateLearningMaterialSchema,
  annotateTermsSchema,
  podcastScriptSchema,
} from "../../schemas/index";
import { ErrorCodes } from "../../../shared/types/errorCodes";
import { AppError } from "../../middleware/errorHandler";
import { aiService } from "../../services/ai/aiService";
import { getMockResponse } from "../../services/ai/mock";
import { getAIProviderForTask, getAIProvider } from "../../services/ai/factory";
import { logger } from "../../utils/logger";
import { promptService } from "../../services/ai/promptService";
import { getSupabaseAdmin } from "../../supabase";
import {
  setSSEHeaders,
  sendStreamChunk,
  sendStreamDone,
  sendStreamError,
} from "./utils";
import { performanceMonitor, enrichMetadata } from "../../services/ai/performanceMonitor";
import { pricingService } from "../../services/ai/pricingService";

const router = Router();

router.get("/status", requireAuth, async (_req: AuthRequest, res: Response) => {
  const provider = await getAIProviderForTask("text");
  res.json({
    enabled: provider.hasKey,
    provider: provider.providerType,
    model: provider.model,
  });
});

router.post(
  "/annotate-terms",
  requireAuth,
  validate(annotateTermsSchema),
  async (req: AuthRequest, res: Response) => {
    const { content, graph_id } = req.body;
    const provider = await getAIProviderForTask("text");

    if (!provider.hasKey) {
      throw new AppError(
        "AI provider not configured",
        503,
        ErrorCodes.INTERNAL_ERROR,
      );
    }

    try {
      const systemPrompt = await promptService.getRenderedPrompt(
        getSupabaseAdmin(),
        "annotate_terms",
        { nodeContent: content },
        req.user.id,
        graph_id,
      );

      const prompt =
        systemPrompt ||
        `请分析以下内容，识别其中的专业术语。对于每个术语，提供一个简短的解释（不超过20字）。
请返回一个 JSON 格式的数组，包含对象 { "term": "术语", "explanation": "解释" }。

内容：
${content}`;

      const enrichedMetadata = await enrichMetadata(getSupabaseAdmin(), {
        graphId: graph_id,
        userId: req.user.id,
        topic: content?.slice(0, 50),
      });

      const startTime = Date.now();
      const completion = await provider.client.chat.completions.create({
        messages: [
          {
            role: "system",
            content:
              "你是一个专业的学术编辑。请仅返回 JSON 格式的数据。不要包含 markdown 代码块标记。",
          },
          { role: "user", content: prompt },
        ],
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
      let terms: { term: string; explanation: string }[] = [];

      try {
        const parsed = JSON.parse(aiContent);
        if (Array.isArray(parsed)) {
          terms = parsed;
        } else if (parsed.terms && Array.isArray(parsed.terms)) {
          terms = parsed.terms;
        } else {
          const values = Object.values(parsed);
          const arrayVal = values.find((v) => Array.isArray(v));
          if (arrayVal)
            terms = arrayVal as { term: string; explanation: string }[];
        }
      } catch (e) {
        logger.error("Failed to parse annotation terms JSON", {
          aiContent,
          error: e,
        });
      }

      let annotatedContent = content || "";

      if (terms.length > 0) {
        const placeholders: string[] = [];

        annotatedContent = annotatedContent.replace(
          /```[\s\S]*?```|`[^`]*`/g,
          (match: string) => {
            placeholders.push(match);
            return `__CODE_BLOCK_${placeholders.length - 1}__`;
          },
        );

        terms.forEach(({ term, explanation }) => {
          if (!term || !explanation) return;

          const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          const index = annotatedContent.indexOf(term);
          if (index !== -1) {
            const regex = new RegExp(`(?<!\\[)${escapedTerm}(?!\\]\\(term:)`);
            annotatedContent = annotatedContent.replace(
              regex,
              `[${term}](term:${explanation})`,
            );
          }
        });

        placeholders.forEach((code, i) => {
          annotatedContent = annotatedContent.replace(
            `__CODE_BLOCK_${i}__`,
            () => code,
          );
        });
      }

      res.json({ content: annotatedContent });
    } catch (error: unknown) {
      const err = error as Error;
      logger.error("Annotate Terms Error:", error);
      res.status(500).json({ error: err.message || "Annotation failed" });
    }
  },
);

router.post(
  "/podcast/script",
  requireAuth,
  validate(podcastScriptSchema),
  async (req: AuthRequest, res: Response) => {
    const { topic, content } = req.body;

    try {
      const script = await aiService.generatePodcastScript(topic, content);
      res.json({ script });
    } catch (error: unknown) {
      const err = error as Error;
      logger.error("Podcast Script Generation Error:", error);
      res.status(500).json({ error: err.message });
    }
  },
);

router.post(
  "/generate-content",
  requireAuth,
  validate(generateContentSchema),
  async (req: AuthRequest, res: Response) => {
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
      const templateContext = {
        topic,
        context: context || "General knowledge",
        isRoot: level === "root" || level === "core",
        isNormal: level === "sub" || level === "normal",
        isLeaf: level === "leaf",
      };

      const systemPrompt = await promptService.getRenderedPrompt(
        getSupabaseAdmin(),
        "generate_content",
        templateContext,
        req.user.id,
        graph_id,
        language,
      );

      const enrichedMetadata = await enrichMetadata(getSupabaseAdmin(), {
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
      res.status(500).json({ error: err.message || "AI 生成失败" });
    }
  },
);

router.post(
  "/learning-material",
  requireAuth,
  validate(generateLearningMaterialSchema),
  async (req: AuthRequest, res: Response) => {
    const { topic, context, level, provider, model, graph_id, language } =
      req.body;

    try {
      const result = await aiService.generateLearningMaterial(topic, context, {
        provider,
        model,
        level,
        userId: req.user.id,
        graphId: graph_id,
        language,
      });
      res.json({ content: result.content, keywords: result.keywords });
    } catch (error: unknown) {
      const err = error as Error;
      logger.error("AI Learning Material Error:", error);
      res.status(500).json({ error: err.message || "AI 生成学习内容失败" });
    }
  },
);

router.post(
  "/generate-content-stream",
  requireAuth,
  validate(generateContentSchema),
  async (req: AuthRequest, res: Response) => {
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
      const templateContext = {
        topic,
        context: context || "General knowledge",
        isRoot: level === "root" || level === "core",
        isNormal: level === "sub" || level === "normal",
        isLeaf: level === "leaf",
      };

      const systemPrompt = await promptService.getRenderedPrompt(
        getSupabaseAdmin(),
        "generate_content",
        templateContext,
        req.user.id,
        graph_id,
        language,
      );

      const enrichedMetadata = await enrichMetadata(getSupabaseAdmin(), {
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
        ErrorCodes.INTERNAL_ERROR,
      );
    }
  },
);

export default router;

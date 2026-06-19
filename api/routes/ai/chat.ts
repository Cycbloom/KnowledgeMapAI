import { Router, type Response } from "express";
import OpenAI from "openai";
import { requireAuth, type AuthRequest } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import {
  chatSchema,
  tutorChatSchema,
  extractConceptsSchema,
  suggestNextTopicSchema,
} from "../../schemas/index";
import { ErrorCodes } from "../../../shared/types/errorCodes";
import { AppError } from "../../middleware/errorHandler";
import { aiService } from "../../services/ai";
import { getMockResponse } from "../../services/ai";
import { getAIProviderForTask, getAIProvider } from "../../services/ai";
import { logger } from "../../utils/logger";
import { graphService } from "../../services/graph";
import { promptService } from "../../services/ai";
import { getSupabaseAdmin } from "../../supabase";
import {
  setSSEHeaders,
  sendStreamChunk,
  sendStreamDone,
  sendStreamError,
} from "./utils";
import {
  performanceMonitor,
  enrichMetadata,
} from "../../services/ai";

const router = Router();

router.post(
  "/chat",
  requireAuth,
  validate(chatSchema),
  async (req: AuthRequest, res: Response) => {
    const {
      message,
      graph_id,
      history = [],
      context_node_ids,
      provider: providerType,
      model,
      language,
      session_id,
    } = req.body;
    const provider = providerType
      ? await getAIProvider(providerType)
      : await getAIProviderForTask("text");
    const sessionId = session_id || crypto.randomUUID();

    setSSEHeaders(res);
    res.setHeader("X-Session-Id", sessionId);

    if (!provider.hasKey) {
      const mockContent = getMockResponse("chat", message) as string;
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
      const { nodes, edges } = await graphService.getGraphNodes(
        req.supabase!,
        req.user.id,
        graph_id,
      );

      const contextText = aiService.buildGraphContext(nodes, edges, {
        contextNodeIds: context_node_ids,
        graphId: graph_id,
      });

      const systemPrompt = await promptService.getRenderedPrompt(
        getSupabaseAdmin(),
        "chat",
        { contextText },
        req.user.id,
        graph_id,
        language,
      );

      const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        { role: "system", content: systemPrompt },
        ...history.map((msg: { role: string; content: string }) => ({
          role: msg.role,
          content: msg.content,
        })),
        { role: "user", content: message },
      ];

      const enrichedMetadata = await enrichMetadata(getSupabaseAdmin(), {
        graphId: graph_id,
        userId: req.user.id,
        topic: message?.slice(0, 50),
      });

      const startTime = Date.now();
      const stream = await provider.client.chat.completions.create({
        messages,
        model: model || provider.model,
        stream: true,
        stream_options: { include_usage: true },
      });

      let inputTokens = 0;
      let outputTokens = 0;
      let cachedInputTokens = 0;

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || "";
        if (content) {
          sendStreamChunk(res, content);
        }
        if (chunk.usage) {
          inputTokens = chunk.usage.prompt_tokens || 0;
          outputTokens = chunk.usage.completion_tokens || 0;
          cachedInputTokens =
            chunk.usage.prompt_tokens_details?.cached_tokens || 0;
        }
      }
      const duration = Date.now() - startTime;

      await performanceMonitor.recordLog({
        operation: "chat",
        provider: provider.providerType,
        model: model || provider.model,
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
        cachedInputTokens,
        duration,
        success: true,
        estimatedCost: 0,
        metadata: enrichedMetadata,
        sessionId,
      });

      sendStreamDone(res);
    } catch (error: unknown) {
      const err = error as Error;
      logger.error("AI Chat Error:", error);
      sendStreamError(
        res,
        err.message || "AI 对话失败",
        ErrorCodes.INTERNAL_ERROR,
      );
    }
  },
);

router.post(
  "/tutor-chat",
  requireAuth,
  validate(tutorChatSchema),
  async (req: AuthRequest, res: Response) => {
    const {
      message,
      graph_id,
      history = [],
      context_node_ids,
      mode = "free",
      provider: providerType,
      model,
      session_id,
    } = req.body;
    const provider = providerType
      ? await getAIProvider(providerType)
      : await getAIProviderForTask("text");
    const sessionId = session_id || crypto.randomUUID();

    setSSEHeaders(res);
    res.setHeader("X-Session-Id", sessionId);

    if (!provider.hasKey) {
      const mockContent = await aiService.tutorChat(
        [{ role: "user", content: message }],
        { mode },
        { provider: providerType, model },
      );
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
      let context: {
        mode: string;
        graphId?: string;
        existingNodes?: string[];
        currentNodeId?: string;
        currentNodeTitle?: string;
        currentNodeContent?: string;
      } = { mode };

      if (graph_id) {
        const { nodes } = await graphService.getGraphNodes(
          req.supabase!,
          req.user.id,
          graph_id,
        );
        context = aiService.buildTutorContext(
          nodes,
          context_node_ids?.[0],
          mode,
          graph_id,
        );
      }

      const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        ...history.map(
          (msg: {
            role: "user" | "assistant" | "system";
            content: string;
          }) => ({ role: msg.role, content: msg.content }),
        ),
        { role: "user", content: message },
      ];

      const enrichedMetadata = await enrichMetadata(getSupabaseAdmin(), {
        graphId: graph_id,
        userId: req.user.id,
        topic: message?.slice(0, 50),
        style: mode,
      });

      const startTime = Date.now();
      const systemPrompt = await promptService.getRenderedPrompt(
        getSupabaseAdmin(),
        "tutor_chat",
        {
          isGuided: mode === "guided",
          currentNodeId: context.currentNodeId,
          currentNodeTitle: context.currentNodeTitle,
          currentNodeContent: context.currentNodeContent,
          existingNodes: context.existingNodes
            ? context.existingNodes.slice(0, 20).join(", ")
            : undefined,
        },
      );

      const stream = await provider.client.chat.completions.create({
        messages: [
          {
            role: "system",
            content: systemPrompt,
          },
          ...messages,
        ],
        model: model || provider.model,
        stream: true,
        stream_options: { include_usage: true },
      });

      let inputTokens = 0;
      let outputTokens = 0;
      let cachedInputTokens = 0;

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || "";
        if (content) {
          sendStreamChunk(res, content);
        }
        if (chunk.usage) {
          inputTokens = chunk.usage.prompt_tokens || 0;
          outputTokens = chunk.usage.completion_tokens || 0;
          cachedInputTokens =
            chunk.usage.prompt_tokens_details?.cached_tokens || 0;
        }
      }
      const duration = Date.now() - startTime;

      await performanceMonitor.recordLog({
        operation: "tutor_chat",
        provider: provider.providerType,
        model: model || provider.model,
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
        cachedInputTokens,
        duration,
        success: true,
        estimatedCost: 0,
        metadata: enrichedMetadata,
        sessionId,
      });

      sendStreamDone(res);
    } catch (error: unknown) {
      const err = error as Error;
      logger.error("AI Tutor Chat Error:", error);
      sendStreamError(
        res,
        err.message || "AI 助教对话失败",
        ErrorCodes.INTERNAL_ERROR,
      );
    }
  },
);

router.post(
  "/extract-concepts",
  requireAuth,
  validate(extractConceptsSchema),
  async (req: AuthRequest, res: Response) => {
    const {
      text,
      existing_nodes,
      max_concepts,
      provider: providerType,
      model,
    } = req.body;
    const provider = providerType
      ? await getAIProvider(providerType)
      : await getAIProviderForTask("text");

    if (!provider.hasKey) {
      const mockResult = await aiService.extractConcepts(text, existing_nodes, {
        provider: providerType,
        model,
        maxConcepts: max_concepts,
      });
      return res.json(mockResult);
    }

    try {
      const result = await aiService.extractConcepts(text, existing_nodes, {
        provider: providerType,
        model,
        maxConcepts: max_concepts,
      });
      res.json(result);
    } catch (error: unknown) {
      const err = error as Error;
      logger.error("AI Extract Concepts Error:", error);
      throw new AppError(err.message || "AI 概念提取失败", 500, ErrorCodes.INTERNAL_ERROR);
    }
  },
);

router.post(
  "/suggest-next-topic",
  requireAuth,
  validate(suggestNextTopicSchema),
  async (req: AuthRequest, res: Response) => {
    const {
      node_title,
      node_content,
      existing_nodes,
      user_progress,
      provider: providerType,
      model,
    } = req.body;
    const provider = providerType
      ? await getAIProvider(providerType)
      : await getAIProviderForTask("text");

    if (!provider.hasKey) {
      const mockResult = await aiService.suggestNextTopic(
        node_title,
        node_content,
        existing_nodes,
        { provider: providerType, model, userProgress: user_progress },
      );
      return res.json(mockResult);
    }

    try {
      const result = await aiService.suggestNextTopic(
        node_title,
        node_content,
        existing_nodes,
        { provider: providerType, model, userProgress: user_progress },
      );
      res.json(result);
    } catch (error: unknown) {
      const err = error as Error;
      logger.error("AI Suggest Next Topic Error:", error);
      throw new AppError(err.message || "AI 主题建议失败", 500, ErrorCodes.INTERNAL_ERROR);
    }
  },
);

export default router;

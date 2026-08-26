import { Router, type Response } from "express";

import { requireAuth, type AuthedRequest } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { textToGraphSchema, urlToTextSchema } from "../../schemas/index";
import { ErrorCodes } from "../../../shared/types/errorCodes";
import { AppError } from "../../middleware/errorHandler";
import {
  aiService,
  getAIProviderForTask,
  getAIProvider,
  promptService,
  performanceMonitor,
  enrichMetadata,
  pricingService,
  documentParsingService,
} from "../../services/ai";
import { logger } from "../../utils/logger";
import { scrapeUrl } from "../../utils/scraper";
import { upload } from "./utils";
import { autoGraphService } from "../../services/graph";

const router = Router();

router.post(
  "/text-to-graph",
  requireAuth,
  validate(textToGraphSchema),
  async (req: AuthedRequest, res: Response) => {
    const {
      text,
      graph_id,
      action = "analyze",
      nodes,
      edges,
      provider: providerType,
      model,
      language,
    } = req.body;

    if (action === "save") {
      if (!graph_id) {
        throw new AppError(
          "Graph ID is required for saving",
          400,
          ErrorCodes.VALIDATION_ERROR,
        );
      }

      if (!nodes || !Array.isArray(nodes)) {
        throw new AppError(
          "No nodes provided for saving",
          400,
          ErrorCodes.VALIDATION_ERROR,
        );
      }

      const validNodes = nodes.filter(
        (node: { title?: string }) => node.title && node.title.trim() !== "",
      );

      if (validNodes.length === 0) {
        return res.json({
          success: true,
          nodeCount: 0,
          edgeCount: 0,
          message: "No valid nodes found to save",
        });
      }

      const { nodeCount, edgeCount } = await autoGraphService.saveTextToGraph(
        req.supabase,
        req.user.id,
        graph_id,
        nodes,
        edges,
      );

      return res.json({
        success: true,
        nodeCount,
        edgeCount,
      });
    }

    if (!text || text.length < 10) {
      throw new AppError(
        "Text content must be at least 10 characters long",
        400,
        ErrorCodes.VALIDATION_ERROR,
      );
    }

    const provider = providerType
      ? await getAIProvider(providerType)
      : await getAIProviderForTask("text");

    if (!provider.hasKey) {
      return res.json({
        nodes: [
          {
            id: "mock_1",
            title: "核心主题 (Mock)",
            content: "这是核心主题",
            level: "root",
          },
          {
            id: "mock_2",
            title: "主要分支 A",
            content: "分支 A 的描述",
            level: "core",
          },
          {
            id: "mock_3",
            title: "主要分支 B",
            content: "分支 B 的描述",
            level: "core",
          },
          {
            id: "mock_4",
            title: "子节点 A1",
            content: "A 的子节点",
            level: "sub",
          },
          {
            id: "mock_5",
            title: "子节点 B1",
            content: "B 的子节点",
            level: "sub",
          },
        ],
        edges: [
          { source: "mock_1", target: "mock_2", relationship: "contains" },
          { source: "mock_1", target: "mock_3", relationship: "contains" },
          { source: "mock_2", target: "mock_4", relationship: "related" },
          { source: "mock_3", target: "mock_5", relationship: "related" },
        ],
      });
    }

    const systemPrompt = await promptService.getRenderedPrompt(
      req.supabase,
      "text_to_graph",
      {},
      req.user.id,
      graph_id,
      language,
    );

    const enrichedMetadata = await enrichMetadata(req.supabase, {
      graphId: graph_id,
      userId: req.user.id,
      topic: text?.slice(0, 50),
    });

    const startTime = Date.now();
    const completion = await provider.client.chat.completions.create({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Text: ${text.substring(0, 15000)}` },
      ],
      model: model || provider.model,
      response_format: { type: "json_object" },
      max_tokens: 8000,
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
        operation: 'text_to_graph',
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

    const content = completion.choices[0].message.content;
    let parsed;
    try {
      parsed = JSON.parse(content || '{"nodes": [], "edges": []}');
    } catch {
      throw new AppError(
        "AI 生成内容过长被截断，请尝试减少文本量或分段生成。",
        422,
        ErrorCodes.SYSTEM_INTERNAL_ERROR,
      );
    }

    if (parsed.nodes) {
      parsed.nodes = parsed.nodes.filter(
        (n: { title?: string }) => n.title && n.title.trim() !== "",
      );
    }
    res.json(parsed);
  },
);

router.post(
  "/document-to-graph",
  requireAuth,
  upload.single("file"),
  async (req: AuthedRequest, res: Response) => {
    const {
      graph_id,
      provider: providerOverride,
      model: modelOverride,
      language,
    } = req.body;
    const file = req.file;
    const provider = await getAIProviderForTask(
      "text",
      providerOverride,
      modelOverride,
    );

    if (!file) {
      throw new AppError(ErrorCodes.NO_FILE_UPLOADED);
    }

    if (!provider.hasKey) {
      throw new AppError(ErrorCodes.AI_PROVIDER_NOT_CONFIGURED);
    }

    const text = await documentParsingService.parseDocument(file);

    if (!text || text.trim().length < 20) {
      throw new AppError(
        "Document extraction failed: No readable text found",
        400,
        ErrorCodes.VALIDATION_ERROR,
      );
    }

    logger.info(
      `Sending ${text.length} characters to AI for graph generation...`,
    );

    const systemPrompt = await promptService.getRenderedPrompt(
      req.supabase,
      "document_to_graph",
      {},
      req.user.id,
      graph_id,
      language,
    );

    const enrichedMetadata = await enrichMetadata(req.supabase, {
      graphId: graph_id,
      userId: req.user.id,
      documentName: file.originalname,
    });

    const startTime = Date.now();
    const completion = await provider.client.chat.completions.create({
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `文件名: ${file.originalname}\n文本内容:\n\n${text.substring(0, 15000)}`,
        },
      ],
      model: provider.model,
      response_format: { type: "json_object" },
      max_tokens: 4000,
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
        operation: 'document_to_graph',
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

    const content = completion.choices[0].message.content;
    const parsed = JSON.parse(content || '{"nodes": [], "edges": []}');

    if (parsed.nodes) {
      parsed.nodes = parsed.nodes.filter(
        (n: { title?: string }) => n.title && n.title.trim() !== "",
      );
    }

    res.json(parsed);
  },
);

router.post(
  "/image-to-graph",
  requireAuth,
  upload.single("file"),
  async (req: AuthedRequest, res: Response) => {
    const { provider: providerOverride, model: modelOverride } = req.body;
    const file = req.file;

    if (!file) {
      throw new AppError(ErrorCodes.NO_FILE_UPLOADED);
    }

    const base64Image = `data:${file.mimetype};base64,${file.buffer.toString("base64")}`;

    const result = await aiService.generateGraphFromImage(base64Image, {
      provider: providerOverride,
      model: modelOverride,
    });

    if (result.nodes) {
      result.nodes = result.nodes.filter((n: unknown) => {
        const node = n as { title?: string };
        return node.title && node.title.trim() !== "";
      });
    }

    res.json(result);
  },
);

router.post(
  "/url-to-text",
  requireAuth,
  validate(urlToTextSchema),
  async (req: AuthedRequest, res: Response) => {
    const { url } = req.body;

    const result = await scrapeUrl(url);
    res.json(result);
  },
);

export default router;

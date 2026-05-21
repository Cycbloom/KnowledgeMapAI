import { Router, type Response } from "express";
import { requireAuth, type AuthRequest } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { AppError } from "../middleware/errorHandler";
import { ErrorCodes } from "../../shared/types/errorCodes";
import type { AIProviderType } from "@shared/types";
import { getAIProviderForTask, getAIProvider } from "../services/ai/factory";
import { promptService } from "../services/ai/promptService";
import { cacheService, CacheKeys } from "../services/common/cacheService";
import {
  performanceMonitor,
  enrichMetadata,
} from "../services/ai/performanceMonitor";
import { pricingService } from "../services/ai/pricingService";
import { logger } from "../utils/logger";
import { scrapeUrl } from "../utils/scraper";
import { autoGraphService, graphNodeService } from "../services/graph/index";
import { achievementService } from "../services/achievementService";
import { embeddingService } from "../services/ai/embeddingService";
import { templateGeneratorService } from "../services/ai/templateGeneratorService";
import type {
  TemplateCategory,
  TemplateType,
  LayoutSuggestion,
} from "@shared/types/graph";
import { z } from "zod";
import { saveNodesSchema } from "../schemas/index";

const router = Router();

const URL_PATTERN = /^https?:\/\/.+/;

async function withAutoGraphTracking<T>(
  operation: string,
  providerType: AIProviderType,
  model: string,
  fn: () => Promise<{
    result: T;
    usage?: {
      prompt_tokens?: number;
      completion_tokens?: number;
      prompt_tokens_details?: {
        cached_tokens?: number;
        audio_tokens?: number;
      };
      completion_tokens_details?: {
        reasoning_tokens?: number;
        audio_tokens?: number;
      };
    };
  }>,
  metadata?: {
    graphId?: string;
    graphTitle?: string;
    userId?: string;
    userName?: string;
    topic?: string;
    nodeTitle?: string;
    nodeId?: string;
    nodeLevel?: string;
    style?: string;
  },
  sessionId?: string,
): Promise<T> {
  const startTime = Date.now();
  let success = true;
  let errorMessage: string | undefined;
  let inputTokens = 0;
  let outputTokens = 0;
  let cachedInputTokens = 0;
  let uncachedInputTokens = 0;
  let reasoningTokens = 0;

  try {
    const { result, usage } = await fn();
    inputTokens = usage?.prompt_tokens || 0;
    outputTokens = usage?.completion_tokens || 0;

    cachedInputTokens = usage?.prompt_tokens_details?.cached_tokens || 0;
    uncachedInputTokens = Math.max(0, inputTokens - cachedInputTokens);
    reasoningTokens = usage?.completion_tokens_details?.reasoning_tokens || 0;

    return result;
  } catch (error: unknown) {
    success = false;
    const err = error as Error;
    errorMessage = err.message;
    throw error;
  } finally {
    const duration = Date.now() - startTime;
    const totalTokens = inputTokens + outputTokens;
    const cacheHitRate =
      inputTokens > 0 ? (cachedInputTokens / inputTokens) * 100 : 0;

    const costBreakdown = pricingService.calculateDetailedCost(
      providerType,
      model,
      inputTokens,
      outputTokens,
      cachedInputTokens,
    );

    performanceMonitor.recordLog({
      operation,
      provider: providerType,
      model,
      inputTokens,
      outputTokens,
      totalTokens,
      estimatedCost: costBreakdown.totalCost,
      duration,
      success,
      errorMessage,
      metadata,
      sessionId,

      cachedInputTokens,
      uncachedInputTokens,
      reasoningTokens,
      cacheHitRate: parseFloat(cacheHitRate.toFixed(2)),
      costBreakdown,
    });
  }
}

async function processSource(source: string): Promise<string> {
  const trimmed = source.trim();

  if (URL_PATTERN.test(trimmed)) {
    try {
      logger.info(`Fetching URL content: ${trimmed}`);
      const result = await scrapeUrl(trimmed);
      return `【来源: ${result.title}】\n${result.text.slice(0, 3000)}`;
    } catch (error) {
      logger.warn(`Failed to scrape URL: ${trimmed}`, error);
      return `【URL: ${trimmed}】(无法获取内容)`;
    }
  }

  return trimmed;
}

const initGraphSchema = z.object({
  topic: z.string().min(2).max(200),
  style: z
    .enum(["academic", "practical", "beginner", "custom"])
    .default("academic"),
  customPrompt: z.string().optional(),
  sources: z.array(z.string()).optional(),
  graph_id: z.string().uuid().optional(),
  provider: z.string().optional(),
  model: z.string().optional(),
  language: z.string().optional(),
  session_id: z.string().uuid().optional(),
  template_type: z.string().optional(),
});

const expandNodeSchema = z.object({
  node_id: z.string().min(1),
  node_title: z.string().min(1),
  node_content: z.string().optional(),
  node_level: z.string().optional(),
  graph_id: z.string().min(1),
  style: z
    .enum(["academic", "practical", "beginner", "custom"])
    .default("academic"),
  customPrompt: z.string().optional(),
  existing_children: z
    .array(
      z.object({
        title: z.string(),
        content: z.string().optional(),
      }),
    )
    .optional(),
  provider: z.string().optional(),
  model: z.string().optional(),
  language: z.string().optional(),
  session_id: z.string().uuid().optional(),
});

const optimizePromptSchema = z.object({
  topic: z.string().min(1),
  currentPrompt: z.string().optional(),
});

const generateTemplatesSchema = z.object({
  topic: z.string().min(2).max(200),
  context: z.string().max(1000).optional(),
  category: z
    .enum(["knowledge", "project", "analysis", "architecture"])
    .optional(),
  template_type: z.string().optional(),
  provider: z.string().optional(),
  model: z.string().optional(),
  graph_id: z.string().uuid().optional(),
  maxNodes: z.number().min(5).max(50).optional(),
  preferredLayout: z
    .enum(["radial", "tree", "network", "hierarchical"])
    .optional(),
});

const applyTemplateSchema = z.object({
  template: z
    .object({
      id: z.string().min(1),
      name: z.string().min(1),
      description: z.string().optional(),
      nodes: z.array(
        z.object({
          id: z.string().min(1),
          title: z.string().min(1),
          description: z.string().optional(),
          level: z.enum(["root", "core", "sub", "normal", "leaf"]),
          parentId: z.string().optional(),
          suggestedContent: z.string().optional(),
          color: z.string().optional(),
        }),
      ),
      edges: z.array(
        z.object({
          source: z.string().min(1),
          target: z.string().min(1),
          relationship_type: z.string().optional(),
          description: z.string().optional(),
        }),
      ),
      layoutSuggestion: z.enum(["radial", "tree", "network", "hierarchical"]),
      estimatedNodes: z.number().optional(),
      difficulty: z.enum(["easy", "medium", "hard"]).optional(),
      tags: z.array(z.string()).optional(),
      reasoning: z.string().optional(),
    })
    .optional(),
  templateId: z.string().optional(),
  topic: z.string().min(2).max(200),
  style: z
    .enum(["academic", "practical", "beginner", "custom"])
    .default("academic"),
  customPrompt: z.string().optional(),
  graph_id: z.string().uuid(),
  provider: z.string().optional(),
  model: z.string().optional(),
});

router.post(
  "/init",
  requireAuth,
  validate(initGraphSchema),
  async (req: AuthRequest, res: Response) => {
    const {
      topic,
      style,
      customPrompt,
      sources,
      graph_id,
      provider: providerType,
      model,
      language,
      session_id,
      template_type,
    } = req.body;
    const supabase = req.supabase;
    if (!supabase) {
      throw new AppError(ErrorCodes.UNAUTHORIZED, {
        message: "Unauthorized: No Supabase client",
      });
    }

    const sessionId = session_id || crypto.randomUUID();

    if (template_type === "topic_research") {
      try {
        const result = await templateGeneratorService.generateTemplates({
          topic,
          templateType: "topic_research",
          provider: providerType as AIProviderType,
          model,
        });

        const template = result.templates[0];
        if (!template) {
          throw new AppError("生成模板失败", 500, ErrorCodes.INTERNAL_ERROR);
        }

        const rootNode = template.nodes.find((n) => n.level === "root");
        const coreNodes = template.nodes.filter((n) => n.level === "core");

        const rootContent =
          rootNode?.description ||
          rootNode?.suggestedContent ||
          `${topic}：本专题研究的核心主题，涵盖研究背景、文献综述、研究方法、核心概念、应用领域和未来方向六大模块`;

        res.json({
          sessionId,
          root: {
            title: rootNode?.title || topic,
            content: rootContent,
          },
          coreNodes: coreNodes.map((n) => ({
            title: n.title,
            content:
              n.description ||
              n.suggestedContent ||
              `${n.title}：${(n as any).backboneModule ? `${n.title}模块的核心内容` : "该节点的详细内容"}`,
            level: n.level || "core",
            backboneModule: (n as any).backboneModule,
            needsRefinement: (n as any).needsRefinement,
            color: (n as any).color,
          })),
        });
        return;
      } catch (error: any) {
        logger.error("Topic Research Template Error:", error);
        throw new AppError(
          error.message || "专题研究模板生成失败",
          500,
          ErrorCodes.INTERNAL_ERROR,
        );
      }
    }

    const provider = providerType
      ? await getAIProvider(providerType)
      : await getAIProviderForTask("text");

    if (!provider.hasKey) {
      throw new AppError(
        "AI provider not configured",
        503,
        ErrorCodes.INTERNAL_ERROR,
      );
    }

    try {
      let processedSources: string[] = [];
      if (sources && sources.length > 0) {
        processedSources = await Promise.all(sources.map(processSource));
      }

      let systemPrompt: string;

      if (style === "custom" && customPrompt) {
        systemPrompt = await promptService.getRenderedPrompt(
          supabase,
          "auto_graph_init",
          {
            topic,
            isCustom: true,
            customPrompt,
            hasSources: processedSources.length > 0,
            sources: processedSources.join("\n\n---\n\n"),
            isInit: true,
          },
          req.user.id,
          graph_id,
          language,
        );
      } else {
        const templateData: Record<string, any> = {
          topic,
          isAcademic: style === "academic",
          isPractical: style === "practical",
          hasSources: processedSources.length > 0,
          sources: processedSources.join("\n\n---\n\n"),
          isInit: true,
        };

        systemPrompt = await promptService.getRenderedPrompt(
          supabase,
          "auto_graph_init",
          templateData,
          req.user.id,
          graph_id,
          language,
        );
      }

      const completion = await withAutoGraphTracking(
        "auto_graph_init",
        provider.providerType,
        model || provider.model,
        async () => {
          const result = await provider.client.chat.completions.create({
            messages: [
              { role: "system", content: systemPrompt },
              {
                role: "user",
                content: `主题：${topic}${processedSources.length > 0 ? `\n\n参考来源：\n${processedSources.join("\n\n---\n\n")}` : ""}`,
              },
            ],
            model: model || provider.model,
            response_format: { type: "json_object" },
            max_tokens: 4000,
          });
          return {
            result,
            usage: result.usage,
          };
        },
        await enrichMetadata(supabase, {
          graphId: graph_id,
          userId: req.user.id,
          topic,
          style,
        }),
        sessionId,
      );

      const content = completion.choices[0].message.content;
      let parsed;
      try {
        parsed = JSON.parse(content || '{"root": null, "coreNodes": []}');
      } catch (e) {
        logger.error("JSON Parse Error:", { content: content?.slice(-100) });
        throw new AppError(
          "AI 生成内容解析失败",
          422,
          ErrorCodes.INTERNAL_ERROR,
        );
      }

      res.json({
        sessionId,
        root: parsed.root || {
          title: topic,
          content: `${topic}的核心概念和知识体系`,
        },
        coreNodes: parsed.coreNodes || [],
      });
    } catch (error: any) {
      logger.error("Auto Graph Init Error:", error);
      if (error instanceof AppError) throw error;
      throw new AppError(
        error.message || "知识图谱初始化失败",
        500,
        ErrorCodes.INTERNAL_ERROR,
      );
    }
  },
);

router.post(
  "/expand",
  requireAuth,
  validate(expandNodeSchema),
  async (req: AuthRequest, res: Response) => {
    const {
      node_id,
      node_title,
      node_content,
      node_level,
      graph_id,
      style,
      customPrompt,
      existing_children,
      provider: providerType,
      model,
      language,
      session_id,
    } = req.body;
    const supabase = req.supabase!;
    const provider = providerType
      ? await getAIProvider(providerType)
      : await getAIProviderForTask("text");

    if (!provider.hasKey) {
      throw new AppError(
        "AI provider not configured",
        503,
        ErrorCodes.INTERNAL_ERROR,
      );
    }

    const sessionId = session_id || crypto.randomUUID();

    try {
      let systemPrompt: string;

      if (style === "custom" && customPrompt) {
        systemPrompt = await promptService.getRenderedPrompt(
          supabase,
          "auto_graph_expand",
          {
            nodeTitle: node_title,
            nodeContent: node_content || "",
            nodeLevel: node_level || "normal",
            isCustom: true,
            customPrompt,
            hasExistingChildren:
              existing_children && existing_children.length > 0,
            existingChildren:
              existing_children?.map((c: any) => c.title).join("、") || "",
          },
          req.user.id,
          graph_id,
          language,
        );
      } else {
        const templateData: Record<string, any> = {
          nodeTitle: node_title,
          nodeContent: node_content || "",
          nodeLevel: node_level || "normal",
          isAcademic: style === "academic",
          isPractical: style === "practical",
          hasExistingChildren:
            existing_children && existing_children.length > 0,
          existingChildren:
            existing_children?.map((c: any) => c.title).join("、") || "",
        };

        systemPrompt = await promptService.getRenderedPrompt(
          supabase,
          "auto_graph_expand",
          templateData,
          req.user.id,
          graph_id,
          language,
        );
      }

      const completion = await withAutoGraphTracking(
        "auto_graph_expand",
        provider.providerType,
        model || provider.model,
        async () => {
          const result = await provider.client.chat.completions.create({
            messages: [
              { role: "system", content: systemPrompt },
              {
                role: "user",
                content: `请为「${node_title}」生成子节点。${existing_children && existing_children.length > 0 ? `\n\n已有的子节点：${existing_children.map((c: any) => c.title).join("、")}\n请生成新的、不同的子节点。` : ""}`,
              },
            ],
            model: model || provider.model,
            response_format: { type: "json_object" },
            max_tokens: 3000,
          });
          return {
            result,
            usage: result.usage,
          };
        },
        await enrichMetadata(supabase, {
          graphId: graph_id,
          userId: req.user.id,
          nodeTitle: node_title,
          nodeId: node_id,
          nodeLevel: node_level,
        }),
        sessionId,
      );

      const content = completion.choices[0].message.content;
      let parsed;
      try {
        parsed = JSON.parse(content || '{"children": []}');
      } catch (e) {
        logger.error("JSON Parse Error:", { content: content?.slice(-100) });
        throw new AppError(
          "AI 生成内容解析失败",
          422,
          ErrorCodes.INTERNAL_ERROR,
        );
      }

      res.json({
        sessionId,
        parentNodeId: node_id,
        children: parsed.children || [],
      });
    } catch (error: any) {
      logger.error("Auto Graph Expand Error:", error);
      if (error instanceof AppError) throw error;
      throw new AppError(
        error.message || "节点展开失败",
        500,
        ErrorCodes.INTERNAL_ERROR,
      );
    }
  },
);

router.post(
  "/optimize-prompt",
  requireAuth,
  validate(optimizePromptSchema),
  async (req: AuthRequest, res: Response) => {
    const { topic, currentPrompt } = req.body;
    const provider = await getAIProviderForTask("text");

    if (!provider.hasKey) {
      throw new AppError(
        "AI provider not configured",
        503,
        ErrorCodes.INTERNAL_ERROR,
      );
    }

    try {
      const systemPrompt = `You are a prompt optimization expert. Your task is to improve the user's custom prompt for generating knowledge graph nodes.

## Guidelines for Optimization
1. Make the instructions more specific and actionable
2. Add constraints on content length, depth, and style
3. Include examples of desired output format
4. Ensure the prompt is clear and unambiguous
5. Keep the user's original intent

## Output Format
Return a JSON object with:
{
  "optimizedPrompt": "The improved prompt text"
}

Respond in Chinese.`;

      const userMessage = `主题：${topic}

${currentPrompt ? `用户当前的自定义规则：\n${currentPrompt}` : "用户尚未输入任何规则，请根据主题生成一个合适的默认规则。"}

请优化这个规则，使其更适合生成知识图谱节点。`;

      const completion = await withAutoGraphTracking(
        "auto_graph_optimize_prompt",
        provider.providerType,
        provider.model,
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
        { userId: req.user.id },
      );

      const content = completion.choices[0].message.content;
      let parsed;
      try {
        parsed = JSON.parse(content || '{"optimizedPrompt": ""}');
      } catch (e) {
        throw new AppError("优化结果解析失败", 422, ErrorCodes.INTERNAL_ERROR);
      }

      res.json({ optimizedPrompt: parsed.optimizedPrompt || "" });
    } catch (error: any) {
      logger.error("Optimize Prompt Error:", error);
      if (error instanceof AppError) throw error;
      throw new AppError(
        error.message || "优化失败",
        500,
        ErrorCodes.INTERNAL_ERROR,
      );
    }
  },
);

router.post(
  "/save-nodes",
  requireAuth,
  validate(saveNodesSchema),
  async (req: AuthRequest, res: Response) => {
    const { graph_id, nodes } = req.body;

    try {
      const existingGraphNodes = await graphNodeService.getGraphNodes(
        req.supabase!,
        graph_id,
      );

      const existingCount = existingGraphNodes?.length || 0;

      const nodesWithTempId = nodes
        .filter((node: any) => node.title && node.title.trim() !== "")
        .map((node: any, index: number) => {
          const angle =
            ((existingCount + index) / (existingCount + nodes.length)) *
            Math.PI *
            2;
          const radius = 15 + (existingCount + index) * 2;

          const tempId = node.id || `temp-${index}`;

          const properties = {
            ...(node.backboneModule && { backboneModule: node.backboneModule }),
            ...(node.needsRefinement !== undefined && { needsRefinement: node.needsRefinement }),
            ...(node.suggestedContent && { suggestedContent: node.suggestedContent }),
            ...(node.color && { color: node.color }),
          };

          return {
            tempId,
            parentId: node.parentId || null,
            title: node.title,
            content: node.content || "",
            level: node.level || "normal",
            x_position: Math.round(Math.cos(angle) * radius),
            y_position: Math.round(Math.sin(angle) * radius),
            properties: Object.keys(properties).length > 0 ? properties : undefined,
          };
        });

      if (nodesWithTempId.length === 0) {
        return res.json({ success: true, nodeCount: 0, edgeCount: 0 });
      }

      const result = await autoGraphService.processAINodes(
        req.supabase!,
        req.user.id,
        graph_id,
        nodesWithTempId,
      );

      await cacheService.del(CacheKeys.GRAPH_NODES(req.user.id, graph_id));
      await cacheService.del(CacheKeys.GRAPH_NODES("public", graph_id));

      achievementService
        .updateCreationStats(req.user.id)
        .catch((err) => logger.error("Achievement update failed:", err));

      const nodeMapping: Record<
        string,
        { graphNodeId: string; knowledgePointId: string }
      > = result.nodeMapping;

      res.json({
        success: true,
        nodeCount: result.nodeCount,
        edgeCount: result.edgeCount,
        nodeMapping,
      });
    } catch (error: any) {
      logger.error("Save nodes error:", error);
      throw new AppError(
        error.message || "保存节点失败",
        500,
        ErrorCodes.INTERNAL_ERROR,
      );
    }
  },
);

router.post("/generate-embeddings", async (req: AuthRequest, res) => {
  try {
    const { limit = 100 } = req.body || {};

    const result = await embeddingService.generateEmbeddingsBatch(
      req.supabase!,
      Math.min(limit, 500),
    );

    res.json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    logger.error("Generate embeddings error:", error);
    throw new AppError(
      error.message || "生成嵌入向量失败",
      500,
      ErrorCodes.INTERNAL_ERROR,
    );
  }
});

router.get("/embedding-status", async (req: AuthRequest, res) => {
  try {
    const status = embeddingService.getStatus();

    const { count } = await req
      .supabase!.from("knowledge_points")
      .select("*", { count: "exact", head: true })
      .is("embedding", null);

    res.json({
      ...status,
      pendingCount: count || 0,
    });
  } catch (error: any) {
    logger.error("Get embedding status error:", error);
    throw new AppError(
      error.message || "获取嵌入状态失败",
      500,
      ErrorCodes.INTERNAL_ERROR,
    );
  }
});

router.post(
  "/generate-templates",
  requireAuth,
  validate(generateTemplatesSchema),
  async (req: AuthRequest, res: Response) => {
    const {
      topic,
      context,
      category,
      template_type,
      provider: providerType,
      model,
      graph_id,
      maxNodes,
      preferredLayout,
    } = req.body;

    try {
      logger.info("Generating templates", {
        topic,
        category,
        userId: req.user.id,
        graphId: graph_id,
      });

      const result = await templateGeneratorService.generateTemplates({
        topic,
        context,
        category: category as TemplateCategory | undefined,
        templateType: template_type as TemplateType | undefined,
        provider: providerType as AIProviderType | undefined,
        model,
        userId: req.user.id,
        graphId: graph_id,
        maxNodes,
        preferredLayout: preferredLayout as LayoutSuggestion | undefined,
      });

      logger.info("Templates generated successfully", {
        topic,
        templateCount: result.templates.length,
        provider: result.metadata.provider,
        model: result.metadata.model,
      });

      res.json(result);
    } catch (error: unknown) {
      const err = error as Error;
      logger.error("Generate templates error:", {
        topic,
        error: err.message,
        stack: err.stack,
      });

      if (error instanceof AppError) throw error;
      throw new AppError(
        err.message || "模板生成失败",
        500,
        ErrorCodes.INTERNAL_ERROR,
      );
    }
  },
);

router.post(
  "/apply-template",
  requireAuth,
  validate(applyTemplateSchema),
  async (req: AuthRequest, res: Response) => {
    const {
      template,
      templateId,
      topic,
      style,
      customPrompt,
      graph_id,
      provider: providerType,
      model,
    } = req.body;

    const supabase = req.supabase!;
    const startTime = Date.now();

    if (!template && !templateId) {
      throw new AppError(
        "必须提供 template 或 templateId 参数",
        400,
        ErrorCodes.VALIDATION_ERROR,
      );
    }

    const provider = providerType
      ? await getAIProvider(providerType)
      : await getAIProviderForTask("text");

    if (!provider.hasKey) {
      throw new AppError(
        "AI provider not configured",
        503,
        ErrorCodes.INTERNAL_ERROR,
      );
    }

    try {
      logger.info("Applying template", {
        topic,
        templateId: template?.id || templateId,
        style,
        userId: req.user.id,
        graphId: graph_id,
      });

      let selectedTemplate = template;

      if (!selectedTemplate && templateId) {
        const { data: storedTemplate, error: fetchError } = await supabase
          .from("graph_templates")
          .select("*")
          .eq("id", templateId)
          .single();

        if (fetchError || !storedTemplate) {
          throw new AppError("模板不存在或无权访问", 404, ErrorCodes.NOT_FOUND);
        }

        selectedTemplate = {
          id: storedTemplate.id,
          name: storedTemplate.name,
          description: storedTemplate.description || undefined,
          nodes: storedTemplate.template_data?.nodes || [],
          edges: storedTemplate.template_data?.edges || [],
          layoutSuggestion: storedTemplate.layout_suggestion || "radial",
          estimatedNodes: storedTemplate.estimated_nodes,
          difficulty: storedTemplate.difficulty || "medium",
          tags: storedTemplate.tags || [],
          reasoning: undefined,
        };
      }

      const systemPrompt = await promptService.getRenderedPrompt(
        supabase,
        "apply_template",
        {
          topic,
          template: selectedTemplate,
          style,
          isCustom: style === "custom",
          customPrompt: customPrompt || "",
          isAcademic: style === "academic",
          isPractical: style === "practical",
          isBeginner: style === "beginner",
        },
        req.user.id,
        graph_id,
      );

      const completion = await withAutoGraphTracking(
        "apply_template",
        provider.providerType,
        model || provider.model,
        async () => {
          const result = await provider.client.chat.completions.create({
            messages: [
              { role: "system", content: systemPrompt },
              {
                role: "user",
                content: `主题：${topic}\n\n模板名称：${selectedTemplate!.name}\n模板结构：\n${JSON.stringify(
                  {
                    nodes: selectedTemplate!.nodes.map(
                      (n: {
                        id: string;
                        title: string;
                        level: string;
                        parentId?: string;
                      }) => ({
                        id: n.id,
                        title: n.title,
                        level: n.level,
                        parentId: n.parentId,
                      }),
                    ),
                    edges: selectedTemplate!.edges,
                  },
                  null,
                  2,
                )}\n\n请根据模板结构生成完整的知识图谱内容。`,
              },
            ],
            model: model || provider.model,
            response_format: { type: "json_object" },
            max_tokens: 6000,
          });
          return {
            result,
            usage: result.usage as
              | { prompt_tokens?: number; completion_tokens?: number }
              | undefined,
          };
        },
        { graphId: graph_id, userId: req.user.id },
      );

      const content = completion.choices[0].message.content;
      let parsed;
      try {
        parsed = JSON.parse(content || '{"nodes": [], "edges": []}');
      } catch (e) {
        logger.error("JSON Parse Error in apply-template:", {
          content: content?.slice(-200),
        });
        throw new AppError(
          "AI 生成内容解析失败",
          422,
          ErrorCodes.INTERNAL_ERROR,
        );
      }

      const duration = Date.now() - startTime;

      logger.info("Template applied successfully", {
        topic,
        templateId: selectedTemplate!.id,
        nodeCount: parsed.nodes?.length || 0,
        edgeCount: parsed.edges?.length || 0,
        duration,
      });

      res.json({
        templateId: selectedTemplate!.id,
        templateName: selectedTemplate!.name,
        nodes: parsed.nodes || [],
        edges: parsed.edges || [],
        layoutSuggestion: selectedTemplate!.layoutSuggestion,
        metadata: {
          topic,
          style,
          generatedAt: new Date().toISOString(),
          provider: provider.providerType,
          model: model || provider.model,
        },
      });
    } catch (error: unknown) {
      const err = error as Error;
      logger.error("Apply template error:", {
        topic,
        error: err.message,
        stack: err.stack,
      });

      if (error instanceof AppError) throw error;
      throw new AppError(
        err.message || "模板应用失败",
        500,
        ErrorCodes.INTERNAL_ERROR,
      );
    }
  },
);

export default router;

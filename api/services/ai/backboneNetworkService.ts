import type { AIProviderType } from "@shared/types";
import type {
  BackboneModule,
  NodeLevel,
  LayoutSuggestion,
} from "@shared/types/graph";
import {
  BACKBONE_MODULE_LABELS,
  BACKBONE_MODULE_COLORS,
} from "@shared/types/graph";
import { getAIProviderForTask, getAIProvider } from "./factory";
import { promptService } from "./promptService";
import { performanceMonitor } from "./performanceMonitor";
import { pricingService } from "./pricingService";
import { logger } from "../../utils/logger";
import { parseAIResponse } from "./utils";
import {
  withTimeoutAndRetry,
  TimeoutError,
  RetryError,
  LONG_TIMEOUT,
} from "../../utils/retry";
import { AppError } from "../../middleware/errorHandler";
import { ErrorCodes } from "../../../shared/types/errorCodes";
import { getSupabaseAdmin } from "../../supabase";

export interface BackboneNode {
  id: string;
  title: string;
  description?: string;
  level: NodeLevel;
  module: BackboneModule;
  parentId?: string;
  suggestedContent?: string;
  color?: string;
}

export interface BackboneEdge {
  source: string;
  target: string;
  relationship_type?: string;
  description?: string;
}

export interface BackboneModuleConfig {
  module: BackboneModule;
  label: string;
  description: string;
  color: string;
  suggestedNodes: string[];
  relationshipToCore: string;
}

export interface BackboneNetwork {
  id: string;
  topic: string;
  description: string;
  nodes: BackboneNode[];
  edges: BackboneEdge[];
  modules: BackboneModuleConfig[];
  layoutSuggestion: LayoutSuggestion;
  estimatedNodes: number;
  reasoning: string;
}

export interface GenerateBackboneOptions {
  topic: string;
  context?: string;
  provider?: AIProviderType;
  model?: string;
  userId?: string;
  graphId?: string;
  includeModules?: BackboneModule[];
  maxNodesPerModule?: number;
}

export interface GenerateBackboneResult {
  backbone: BackboneNetwork;
  metadata: {
    topic: string;
    generatedAt: string;
    provider: string;
    model: string;
  };
}

const BACKBONE_MODULE_CONFIGS: Record<
  BackboneModule,
  Omit<BackboneModuleConfig, "module">
> = {
  research_background: {
    label: BACKBONE_MODULE_LABELS.research_background,
    description: "研究主题的背景信息、发展历程和现状",
    color: BACKBONE_MODULE_COLORS.research_background,
    suggestedNodes: ["研究背景", "发展历程", "研究现状", "问题陈述"],
    relationshipToCore: "提供研究的基础和动机",
  },
  literature_review: {
    label: BACKBONE_MODULE_LABELS.literature_review,
    description: "相关文献的综述和分析",
    color: BACKBONE_MODULE_COLORS.literature_review,
    suggestedNodes: ["理论基础", "相关工作", "研究空白", "文献分析"],
    relationshipToCore: "建立理论基础和研究脉络",
  },
  research_methods: {
    label: BACKBONE_MODULE_LABELS.research_methods,
    description: "研究采用的方法论和技术手段",
    color: BACKBONE_MODULE_COLORS.research_methods,
    suggestedNodes: ["研究方法", "技术路线", "实验设计", "数据分析"],
    relationshipToCore: "提供研究的实施路径",
  },
  core_concepts: {
    label: BACKBONE_MODULE_LABELS.core_concepts,
    description: "研究的核心概念、定义和理论框架",
    color: BACKBONE_MODULE_COLORS.core_concepts,
    suggestedNodes: ["核心概念", "关键定义", "理论框架", "主要发现"],
    relationshipToCore: "研究的核心内容和贡献",
  },
  application_domains: {
    label: BACKBONE_MODULE_LABELS.application_domains,
    description: "研究成果的应用领域和实际场景",
    color: BACKBONE_MODULE_COLORS.application_domains,
    suggestedNodes: ["应用场景", "实践案例", "行业应用", "工具实现"],
    relationshipToCore: "展示研究的实际价值",
  },
  future_directions: {
    label: BACKBONE_MODULE_LABELS.future_directions,
    description: "未来研究方向和发展趋势",
    color: BACKBONE_MODULE_COLORS.future_directions,
    suggestedNodes: ["研究展望", "发展趋势", "开放问题", "潜在方向"],
    relationshipToCore: "指明后续研究方向",
  },
};

const BACKBONE_GENERATION_PROMPT = `你是一个专业的知识图谱架构师，专门为学术研究和知识体系构建骨干网络结构。

## 任务目标

为给定的研究主题生成一个结构化的骨干网络，该网络将作为知识图谱的核心框架。

## 骨干网络模块

骨干网络由以下六个核心模块组成：

1. **研究背景 (research_background)**: 研究主题的背景信息、发展历程和现状
2. **文献综述 (literature_review)**: 相关文献的综述和分析
3. **研究方法 (research_methods)**: 研究采用的方法论和技术手段
4. **核心概念 (core_concepts)**: 研究的核心概念、定义和理论框架
5. **应用领域 (application_domains)**: 研究成果的应用领域和实际场景
6. **未来方向 (future_directions)**: 未来研究方向和发展趋势

## 节点粒度要求

**重要**: 只生成 root（根节点）和 core（核心节点）两个级别的节点：
- **root**: 主题根节点，每个模块的根节点
- **core**: 模块内的核心概念节点

不要生成 sub、normal 或 leaf 级别的节点。

## 输出格式

返回一个 JSON 对象，结构如下：

{
  "backbone": {
    "id": "backbone-unique-id",
    "topic": "研究主题",
    "description": "骨干网络的整体描述",
    "nodes": [
      {
        "id": "node-unique-id",
        "title": "节点标题",
        "description": "节点描述",
        "level": "root|core",
        "module": "research_background|literature_review|research_methods|core_concepts|application_domains|future_directions",
        "parentId": "父节点ID（如果是根节点则为null）",
        "suggestedContent": "建议的内容要点",
        "color": "#hexcolor"
      }
    ],
    "edges": [
      {
        "source": "source-node-id",
        "target": "target-node-id",
        "relationship_type": "contains|related|prerequisite",
        "description": "关系描述"
      }
    ],
    "layoutSuggestion": "radial|tree|network|hierarchical",
    "estimatedNodes": 预估总节点数,
    "reasoning": "设计思路说明"
  }
}

## 设计原则

1. **模块化结构**: 每个模块应有清晰的边界和职责
2. **层次分明**: root 节点代表模块入口，core 节点代表关键概念
3. **关系清晰**: 边应表示有意义的语义关系
4. **可扩展性**: 结构应便于后续添加更细粒度的节点
5. **语义连贯**: 节点标题和描述应准确反映研究主题

## 注意事项

1. 每个模块至少生成 1 个 root 节点和 2-4 个 core 节点
2. 确保所有边的 source 和 target 指向有效的节点 ID
3. 节点颜色应与模块颜色一致
4. 所有描述和内容使用中文`;

const BACKBONE_VALIDATION_RULES = {
  validLevels: ["root", "core"] as NodeLevel[],
  validModules: [
    "research_background",
    "literature_review",
    "research_methods",
    "core_concepts",
    "application_domains",
    "future_directions",
  ] as BackboneModule[],
  validLayouts: [
    "radial",
    "tree",
    "network",
    "hierarchical",
  ] as LayoutSuggestion[],
  minNodesPerModule: 2,
  maxNodesPerModule: 10,
};

function validateBackboneNode(
  node: unknown,
  index: number,
  validModuleSet: Set<BackboneModule>,
): BackboneNode | null {
  if (typeof node !== "object" || node === null) {
    logger.warn(
      `[Backbone Network] Invalid node at index ${index}: not an object`,
    );
    return null;
  }

  const n = node as Record<string, unknown>;

  if (typeof n.id !== "string" || !n.id.trim()) {
    logger.warn(
      `[Backbone Network] Invalid node at index ${index}: missing id`,
    );
    return null;
  }

  if (typeof n.title !== "string" || !n.title.trim()) {
    logger.warn(
      `[Backbone Network] Invalid node at index ${index}: missing title`,
    );
    return null;
  }

  const level = n.level as NodeLevel;
  if (!BACKBONE_VALIDATION_RULES.validLevels.includes(level)) {
    logger.warn(
      `[Backbone Network] Invalid node at index ${index}: invalid level "${level}", only root and core are allowed`,
    );
    return null;
  }

  const module = n.module as BackboneModule;
  if (!validModuleSet.has(module)) {
    logger.warn(
      `[Backbone Network] Invalid node at index ${index}: invalid module "${module}"`,
    );
    return null;
  }

  let description = n.description as string | undefined;
  if (!description || !description.trim()) {
    const moduleConfig = BACKBONE_MODULE_CONFIGS[module];
    if (level === "root") {
      description = `${n.title}：${moduleConfig.description}`;
    } else {
      description = `${n.title}：${moduleConfig.label}中的核心概念`;
    }
    logger.info(
      `[Backbone Network] Generated default description for node "${n.title}": ${description}`,
    );
  }

  return {
    id: n.id as string,
    title: n.title as string,
    description,
    level,
    module,
    parentId: n.parentId as string | undefined,
    suggestedContent: n.suggestedContent as string | undefined,
    color: n.color as string | undefined,
  };
}

function validateBackboneEdge(
  edge: unknown,
  validNodeIds: Set<string>,
  index: number,
): BackboneEdge | null {
  if (typeof edge !== "object" || edge === null) {
    logger.warn(
      `[Backbone Network] Invalid edge at index ${index}: not an object`,
    );
    return null;
  }

  const e = edge as Record<string, unknown>;

  if (typeof e.source !== "string" || !validNodeIds.has(e.source)) {
    logger.warn(
      `[Backbone Network] Invalid edge at index ${index}: invalid source "${e.source}"`,
    );
    return null;
  }

  if (typeof e.target !== "string" || !validNodeIds.has(e.target)) {
    logger.warn(
      `[Backbone Network] Invalid edge at index ${index}: invalid target "${e.target}"`,
    );
    return null;
  }

  return {
    source: e.source as string,
    target: e.target as string,
    relationship_type: e.relationship_type as string | undefined,
    description: e.description as string | undefined,
  };
}

function validateBackbone(
  backbone: unknown,
  topic: string,
  includeModules: BackboneModule[],
): BackboneNetwork | null {
  if (typeof backbone !== "object" || backbone === null) {
    logger.warn("[Backbone Network] Invalid backbone: not an object");
    return null;
  }

  const b = backbone as Record<string, unknown>;

  const validModuleSet = new Set(includeModules);

  if (!Array.isArray(b.nodes) || b.nodes.length === 0) {
    logger.warn("[Backbone Network] Invalid backbone: no nodes");
    return null;
  }

  const validNodes: BackboneNode[] = [];
  for (let i = 0; i < b.nodes.length; i++) {
    const validatedNode = validateBackboneNode(b.nodes[i], i, validModuleSet);
    if (validatedNode) {
      validNodes.push(validatedNode);
    }
  }

  if (validNodes.length === 0) {
    logger.warn("[Backbone Network] No valid nodes after validation");
    return null;
  }

  const validNodeIds = new Set(validNodes.map((n) => n.id));

  const validEdges: BackboneEdge[] = [];
  if (Array.isArray(b.edges)) {
    for (let i = 0; i < b.edges.length; i++) {
      const validatedEdge = validateBackboneEdge(b.edges[i], validNodeIds, i);
      if (validatedEdge) {
        validEdges.push(validatedEdge);
      }
    }
  }

  const layoutSuggestion = b.layoutSuggestion as LayoutSuggestion;
  const validLayout = BACKBONE_VALIDATION_RULES.validLayouts.includes(
    layoutSuggestion,
  )
    ? layoutSuggestion
    : "radial";

  const modules: BackboneModuleConfig[] = includeModules.map((module) => ({
    module,
    ...BACKBONE_MODULE_CONFIGS[module],
  }));

  return {
    id: (b.id as string) || `backbone-${Date.now()}`,
    topic: (b.topic as string) || topic,
    description: (b.description as string) || "",
    nodes: validNodes,
    edges: validEdges,
    modules,
    layoutSuggestion: validLayout,
    estimatedNodes: Math.max(
      validNodes.length,
      (b.estimatedNodes as number) || validNodes.length,
    ),
    reasoning: (b.reasoning as string) || "",
  };
}

function getMockBackbone(
  topic: string,
  includeModules: BackboneModule[],
): GenerateBackboneResult {
  const nodes: BackboneNode[] = [];
  const edges: BackboneEdge[] = [];

  const mainRootId = "root-main";
  nodes.push({
    id: mainRootId,
    title: topic,
    description: `${topic}研究的核心主题`,
    level: "root",
    module: "core_concepts",
    suggestedContent: `关于${topic}的核心概念和定义`,
    color: BACKBONE_MODULE_COLORS.core_concepts,
  });

  for (const module of includeModules) {
    const config = BACKBONE_MODULE_CONFIGS[module];
    const moduleRootId = `root-${module}`;

    nodes.push({
      id: moduleRootId,
      title: config.label,
      description: config.description,
      level: "root",
      module,
      suggestedContent: config.description,
      color: config.color,
    });

    edges.push({
      source: mainRootId,
      target: moduleRootId,
      relationship_type: "contains",
      description: `${topic}包含${config.label}模块`,
    });

    const suggestedNodes = config.suggestedNodes.slice(0, 3);
    suggestedNodes.forEach((suggestedTitle, idx) => {
      const coreNodeId = `core-${module}-${idx}`;
      nodes.push({
        id: coreNodeId,
        title: suggestedTitle,
        description: `${config.label}中的核心概念`,
        level: "core",
        module,
        parentId: moduleRootId,
        suggestedContent: `关于${suggestedTitle}的详细内容`,
        color: config.color,
      });

      edges.push({
        source: moduleRootId,
        target: coreNodeId,
        relationship_type: "contains",
        description: `${config.label}包含${suggestedTitle}`,
      });
    });
  }

  return {
    backbone: {
      id: `backbone-mock-${Date.now()}`,
      topic,
      description: `${topic}的骨干网络结构（模拟数据）`,
      nodes,
      edges,
      modules: includeModules.map((module) => ({
        module,
        ...BACKBONE_MODULE_CONFIGS[module],
      })),
      layoutSuggestion: "radial",
      estimatedNodes: nodes.length * 3,
      reasoning: "模拟骨干网络结构，用于无 API Key 时的展示",
    },
    metadata: {
      topic,
      generatedAt: new Date().toISOString(),
      provider: "mock",
      model: "mock",
    },
  };
}

export class BackboneNetworkService {
  async generateBackbone(
    options: GenerateBackboneOptions,
  ): Promise<GenerateBackboneResult> {
    const {
      topic,
      provider: providerType,
      includeModules = [
        "research_background",
        "literature_review",
        "research_methods",
        "core_concepts",
        "application_domains",
        "future_directions",
      ],
    } = options;

    const provider = providerType
      ? await getAIProvider(providerType)
      : await getAIProviderForTask("text");

    if (!provider.hasKey) {
      logger.info(
        "[Backbone Network] No API key configured, returning mock backbone",
      );
      return getMockBackbone(topic, includeModules);
    }

    const startTime = Date.now();

    try {
      const { result, usage } = await this.callAI(provider, {
        ...options,
        includeModules,
      });

      const inputTokens = usage?.prompt_tokens || 0;
      const outputTokens = usage?.completion_tokens || 0;
      const cachedInputTokens =
        usage?.prompt_tokens_details?.cached_tokens || 0;
      const uncachedInputTokens = Math.max(0, inputTokens - cachedInputTokens);
      const reasoningTokens =
        usage?.completion_tokens_details?.reasoning_tokens || 0;
      const totalTokens = inputTokens + outputTokens;
      const cacheHitRate =
        inputTokens > 0 ? (cachedInputTokens / inputTokens) * 100 : 0;

      const costBreakdown = pricingService.calculateDetailedCost(
        provider.providerType,
        options.model || provider.model,
        inputTokens,
        outputTokens,
        cachedInputTokens,
      );

      performanceMonitor.recordLog({
        operation: "backbone_generation",
        provider: provider.providerType,
        model: options.model || provider.model,
        inputTokens,
        outputTokens,
        totalTokens,
        estimatedCost: costBreakdown.totalCost,
        duration: Date.now() - startTime,
        success: true,
        metadata: {
          userId: options.userId,
          graphId: options.graphId,
          topic: options.topic,
          templateType: includeModules.join(","),
        },
        cachedInputTokens,
        uncachedInputTokens,
        reasoningTokens,
        cacheHitRate: parseFloat(cacheHitRate.toFixed(2)),
        costBreakdown,
      });

      return result;
    } catch (error: unknown) {
      const err = error as Error;
      logger.error("[Backbone Network] AI Error:", error);

      performanceMonitor.recordLog({
        operation: "backbone_generation",
        provider: provider.providerType,
        model: options.model || provider.model,
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        estimatedCost: 0,
        duration: Date.now() - startTime,
        success: false,
        errorMessage: err.message,
        metadata: {
          userId: options.userId,
          graphId: options.graphId,
          topic: options.topic,
          templateType: includeModules.join(","),
        },
      });

      if (err instanceof TimeoutError) {
        throw new AppError(ErrorCodes.AI_TIMEOUT);
      }
      if (err instanceof RetryError) {
        throw new AppError(ErrorCodes.AI_PROVIDER_ERROR, {
          message: `AI 请求失败，已重试 ${err.attempts} 次: ${err.lastError.message}`,
        });
      }
      throw new AppError(ErrorCodes.AI_PROVIDER_ERROR, {
        message: err.message || "AI backbone generation failed",
      });
    }
  }

  private async callAI(
    provider: {
      providerType: AIProviderType;
      model: string;
      hasKey: boolean;
      client: unknown;
    },
    options: GenerateBackboneOptions & { includeModules: BackboneModule[] },
  ): Promise<{
    result: GenerateBackboneResult;
    usage?: {
      prompt_tokens?: number;
      completion_tokens?: number;
      prompt_tokens_details?: { cached_tokens?: number; audio_tokens?: number };
      completion_tokens_details?: {
        reasoning_tokens?: number;
        audio_tokens?: number;
      };
    };
  }> {
    const { topic, context, includeModules, maxNodesPerModule = 5 } = options;
    const model = options.model || provider.model;

    const systemPrompt = await this.buildSystemPrompt(
      includeModules,
      maxNodesPerModule,
      options.userId,
      options.graphId,
    );

    const userPrompt = this.buildUserPrompt(topic, context, includeModules);

    const client = provider.client as {
      chat: {
        completions: {
          create: (params: {
            messages: Array<{ role: string; content: string }>;
            model: string;
            response_format?: { type: string };
            max_tokens?: number;
          }) => Promise<{
            choices: Array<{ message: { content: string | null } }>;
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
          }>;
        };
      };
    };

    const completion = await withTimeoutAndRetry(
      () =>
        client.chat.completions.create({
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          model,
          response_format: { type: "json_object" },
          max_tokens: 4000,
        }),
      {
        timeout: LONG_TIMEOUT,
        maxRetries: 3,
        onRetry: (attempt, error) => {
          logger.warn(
            `[Backbone Network] Retry attempt ${attempt}: ${error.message}`,
          );
        },
      },
    );

    const content = completion.choices[0].message.content;

    if (!content) {
      logger.error("[Backbone Network] Empty response from AI");
      throw new AppError(ErrorCodes.AI_PROVIDER_ERROR, {
        message: "AI 返回了空响应",
      });
    }

    const parsed = parseAIResponse<{ backbone: unknown }>(
      content,
      "Backbone Generation",
    );

    const validatedBackbone = validateBackbone(
      parsed.backbone,
      topic,
      includeModules,
    );

    if (!validatedBackbone) {
      logger.warn("[Backbone Network] No valid backbone generated, using mock");
      return {
        result: getMockBackbone(topic, includeModules),
        usage: completion.usage,
      };
    }

    return {
      result: {
        backbone: validatedBackbone,
        metadata: {
          topic,
          generatedAt: new Date().toISOString(),
          provider: provider.providerType,
          model,
        },
      },
      usage: completion.usage,
    };
  }

  private async buildSystemPrompt(
    includeModules: BackboneModule[],
    maxNodesPerModule: number,
    userId?: string,
    graphId?: string,
  ): Promise<string> {
    const moduleDescriptions = includeModules
      .map((module) => {
        const config = BACKBONE_MODULE_CONFIGS[module];
        return `- **${config.label}** (${module}): ${config.description}`;
      })
      .join("\n");

    const customPrompt = await promptService.getRenderedPrompt(
      getSupabaseAdmin(),
      "backbone_generation",
      {
        modules: moduleDescriptions,
        maxNodesPerModule: maxNodesPerModule.toString(),
      },
      userId,
      graphId,
    );

    if (customPrompt && customPrompt.trim().length > 0) {
      return customPrompt;
    }

    return `${BACKBONE_GENERATION_PROMPT}

## 本次生成的模块

请为以下模块生成骨干节点：

${moduleDescriptions}

## 节点数量限制

- 每个模块最多生成 ${maxNodesPerModule} 个核心节点
- 每个模块必须有 1 个 root 节点作为模块入口`;
  }

  private buildUserPrompt(
    topic: string,
    context?: string,
    includeModules?: BackboneModule[],
  ): string {
    let prompt = `研究主题：${topic}`;

    if (context && context.trim()) {
      prompt += `\n\n背景信息：\n${context}`;
    }

    if (includeModules && includeModules.length > 0) {
      const moduleLabels = includeModules
        .map((m) => BACKBONE_MODULE_LABELS[m])
        .join("、");
      prompt += `\n\n请为这个研究主题生成包含以下模块的骨干网络：${moduleLabels}`;
    }

    prompt += `\n\n注意：`;
    prompt += `\n1. 只生成 root 和 core 级别的节点，不要生成更细粒度的节点`;
    prompt += `\n2. **每个节点都必须有 description 字段**，描述应该针对具体研究主题，不能使用通用描述`;
    prompt += `\n3. 根节点的描述应该概括该模块或主题的核心内容`;
    prompt += `\n\n请以有效的 json 格式返回结果。`;

    return prompt;
  }

  getModuleConfigs(): Record<
    BackboneModule,
    Omit<BackboneModuleConfig, "module">
  > {
    return BACKBONE_MODULE_CONFIGS;
  }

  getModuleConfig(module: BackboneModule): BackboneModuleConfig {
    return {
      module,
      ...BACKBONE_MODULE_CONFIGS[module],
    };
  }

  getAllModules(): BackboneModuleConfig[] {
    return Object.entries(BACKBONE_MODULE_CONFIGS).map(([module, config]) => ({
      module: module as BackboneModule,
      ...config,
    }));
  }
}

export const backboneNetworkService = new BackboneNetworkService();

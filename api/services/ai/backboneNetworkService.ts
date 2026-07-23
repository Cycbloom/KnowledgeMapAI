import type { AIProviderType } from "@shared/types";
import {
  BackboneModule,
  BACKBONE_MODULE_LABELS,
  BACKBONE_MODULE_COLORS,
  BACKBONE_MODULE_TITLES,
  type NodeLevel,
  type LayoutSuggestion,
  type BackboneModuleCustomConfig,
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
} from "../../../shared/utils/retry";
import { AppError } from "../../middleware/errorHandler";
import { ErrorCodes } from "../../../shared/types/errorCodes";
import { getSupabaseAdmin } from "../../supabase";

export interface BackboneNode {
  id: string;
  title: string;
  description?: string;
  summary?: string;
  level: NodeLevel;
  module: string;
  parentId?: string;
  suggestedContent?: string;
  color?: string;
  properties?: {
    backboneModule?: string;
    [key: string]: unknown;
  };
}

export interface BackboneEdge {
  source: string;
  target: string;
  relationship_type?: string;
  description?: string;
}

export interface BackboneModuleConfig {
  module: string;
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
  customModules?: BackboneModuleCustomConfig[];
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

## 标准标题要求

**重要**: 骨干网络的结构如下：

1. **根节点（root 级别）**：研究主题本身，只有一个根节点，标题为研究主题，**不需要**固定标题
2. **核心节点（core 级别）**：六个骨干模块，必须使用以下标准标题，不允许使用任何变体：
   - 研究背景模块必须使用标题："研究背景"
   - 文献综述模块必须使用标题："文献综述"
   - 研究方法模块必须使用标题："研究方法"
   - 核心概念模块必须使用标题："核心概念"
   - 应用领域模块必须使用标题："应用领域"
   - 未来方向模块必须使用标题："未来方向"

不允许使用以下变体：
- ❌ "背景介绍"、"研究背景介绍"、"背景概述"
- ❌ "文献回顾"、"相关文献"、"文献分析"
- ❌ "方法论"、"研究方法论"、"技术方法"
- ❌ "核心理论"、"关键概念"、"基本概念"
- ❌ "应用场景"、"实践应用"、"应用实践"
- ❌ "未来展望"、"发展趋势"、"研究展望"

## 节点粒度要求

**重要**: 生成的节点级别：
- **root**: 主题根节点，只有一个，标题为研究主题本身
- **core**: 六个骨干模块节点，标题必须使用标准标题

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
        "summary": "20-30字的简短概览，概括该知识点的核心内容",
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

1. **必须且只能生成 1 个根节点**：研究主题本身
2. **必须且只能生成 6 个核心节点**：每个骨干模块恰好一个核心节点
3. 每个骨干模块的核心节点必须使用上述标准标题
4. 不要为同一个模块生成多个核心节点
5. 确保所有边的 source 和 target 指向有效的节点 ID
6. 节点颜色应与模块颜色一致
7. 所有描述和内容使用中文`;

const BACKBONE_VALIDATION_RULES = {
  validLevels: ["root", "core"] as NodeLevel[],
  validModules: [
    BackboneModule.RESEARCH_BACKGROUND,
    BackboneModule.LITERATURE_REVIEW,
    BackboneModule.RESEARCH_METHODS,
    BackboneModule.CORE_CONCEPTS,
    BackboneModule.APPLICATION_DOMAINS,
    BackboneModule.FUTURE_DIRECTIONS,
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
  validModuleSet: Set<string>,
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

  const module = n.module as string;
  if (!validModuleSet.has(module)) {
    logger.warn(
      `[Backbone Network] Invalid node at index ${index}: invalid module "${module}"`,
    );
    return null;
  }

  let description = n.description as string | undefined;
  if (!description || !description.trim()) {
    const moduleConfig = BACKBONE_MODULE_CONFIGS[module as BackboneModule];
    if (level === "root") {
      description = `${n.title}：${moduleConfig?.description || `关于${n.title}的核心内容`}`;
    } else {
      description = `${n.title}：${moduleConfig?.label || module}中的核心概念`;
    }
    logger.info(
      `[Backbone Network] Generated default description for node "${n.title}": ${description}`,
    );
  }

  return {
    id: n.id as string,
    title: n.title as string,
    description,
    summary: n.summary as string | undefined,
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
  customModules?: BackboneModuleCustomConfig[],
): BackboneNetwork | null {
  if (typeof backbone !== "object" || backbone === null) {
    logger.warn("[Backbone Network] Invalid backbone: not an object");
    return null;
  }

  const b = backbone as Record<string, unknown>;

  const validModuleSet = new Set<string>(
    customModules && customModules.length > 0
      ? customModules.map((m) => m.module_type)
      : includeModules,
  );

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

  const modules: BackboneModuleConfig[] =
    customModules && customModules.length > 0
      ? customModules.map((cm) => ({
          module: cm.module_type,
          label: cm.title,
          description: cm.description,
          color: cm.color,
          suggestedNodes: cm.suggestedNodes,
          relationshipToCore: cm.relationshipToCore,
        }))
      : includeModules.map((module) => ({
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

function validateAndCorrectBackboneNodeTitle(
  node: BackboneNode,
  customModuleTitles?: Map<string, string>,
): {
  correctedNode: BackboneNode;
  wasCorrected: boolean;
  originalTitle?: string;
} {
  if (node.level !== "core") {
    return { correctedNode: node, wasCorrected: false };
  }

  if (customModuleTitles) {
    const expectedTitle = customModuleTitles.get(node.module);
    if (expectedTitle && node.title !== expectedTitle) {
      const originalTitle = node.title;
      logger.info(
        `[Backbone Network] Correcting core node title: "${originalTitle}" -> "${expectedTitle}" for module ${node.module}`,
      );
      return {
        correctedNode: {
          ...node,
          title: expectedTitle,
        },
        wasCorrected: true,
        originalTitle,
      };
    }
    return { correctedNode: node, wasCorrected: false };
  }

  const expectedTitle = BACKBONE_MODULE_TITLES[node.module as BackboneModule];

  if (node.title !== expectedTitle) {
    const originalTitle = node.title;
    logger.info(
      `[Backbone Network] Correcting core node title: "${originalTitle}" -> "${expectedTitle}" for module ${node.module}`,
    );

    return {
      correctedNode: {
        ...node,
        title: expectedTitle,
      },
      wasCorrected: true,
      originalTitle,
    };
  }

  return { correctedNode: node, wasCorrected: false };
}

function getMockBackbone(
  topic: string,
  includeModules: BackboneModule[],
  customModules?: BackboneModuleCustomConfig[],
): GenerateBackboneResult {
  const nodes: BackboneNode[] = [];
  const edges: BackboneEdge[] = [];

  const mainRootId = "root-main";
  const defaultModule =
    customModules?.[0]?.module_type ||
    includeModules[0] ||
    BackboneModule.CORE_CONCEPTS;
  const defaultColor =
    customModules?.[0]?.color ||
    BACKBONE_MODULE_COLORS[defaultModule as BackboneModule] ||
    "#10B981";

  nodes.push({
    id: mainRootId,
    title: topic,
    description: `${topic}研究的核心主题`,
    level: "root",
    module: defaultModule,
    suggestedContent: `关于${topic}的核心概念和定义`,
    color: defaultColor,
  });

  const useCustomModules = customModules && customModules.length > 0;

  const moduleItems = useCustomModules && customModules ? customModules : includeModules;

  for (const item of moduleItems) {
    const moduleType = useCustomModules
      ? (item as BackboneModuleCustomConfig).module_type
      : (item as BackboneModule);
    const title = useCustomModules
      ? (item as BackboneModuleCustomConfig).title
      : BACKBONE_MODULE_CONFIGS[item as BackboneModule].label;
    const description = useCustomModules
      ? (item as BackboneModuleCustomConfig).description
      : BACKBONE_MODULE_CONFIGS[item as BackboneModule].description;
    const color = useCustomModules
      ? (item as BackboneModuleCustomConfig).color
      : BACKBONE_MODULE_CONFIGS[item as BackboneModule].color;
    const suggestedNodes = useCustomModules
      ? (item as BackboneModuleCustomConfig).suggestedNodes
      : BACKBONE_MODULE_CONFIGS[item as BackboneModule].suggestedNodes;

    const coreNodeId = `core-${moduleType}`;

    nodes.push({
      id: coreNodeId,
      title,
      description,
      level: "core",
      module: moduleType,
      suggestedContent: description,
      color,
      properties: {
        backboneModule: moduleType,
      },
    });

    edges.push({
      source: mainRootId,
      target: coreNodeId,
      relationship_type: "contains",
      description: `${topic}包含${title}模块`,
    });

    const suggested = suggestedNodes.slice(0, 3);
    suggested.forEach((suggestedTitle, idx) => {
      const subNodeId = `sub-${moduleType}-${idx}`;
      nodes.push({
        id: subNodeId,
        title: suggestedTitle,
        description: `${title}中的核心概念`,
        level: "sub",
        module: moduleType,
        parentId: coreNodeId,
        suggestedContent: `关于${suggestedTitle}的详细内容`,
        color,
      });

      edges.push({
        source: coreNodeId,
        target: subNodeId,
        relationship_type: "contains",
        description: `${title}包含${suggestedTitle}`,
      });
    });
  }

  const backboneModules: BackboneModuleConfig[] = (useCustomModules && customModules)
    ? customModules.map((cm) => ({
        module: cm.module_type,
        label: cm.title,
        description: cm.description,
        color: cm.color,
        suggestedNodes: cm.suggestedNodes,
        relationshipToCore: cm.relationshipToCore,
      }))
    : includeModules.map((module) => ({
        module,
        ...BACKBONE_MODULE_CONFIGS[module],
      }));

  return {
    backbone: {
      id: `backbone-mock-${Date.now()}`,
      topic,
      description: `${topic}的骨干网络结构（模拟数据）`,
      nodes,
      edges,
      modules: backboneModules,
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
        BackboneModule.RESEARCH_BACKGROUND,
        BackboneModule.LITERATURE_REVIEW,
        BackboneModule.RESEARCH_METHODS,
        BackboneModule.CORE_CONCEPTS,
        BackboneModule.APPLICATION_DOMAINS,
        BackboneModule.FUTURE_DIRECTIONS,
      ],
      customModules,
    } = options;

    const effectiveIncludeModules =
      customModules && customModules.length > 0
        ? (customModules.map((m) => m.module_type) as BackboneModule[])
        : includeModules;

    const provider = providerType
      ? await getAIProvider(providerType)
      : await getAIProviderForTask("text");

    if (!provider.hasKey) {
      logger.info(
        "[Backbone Network] No API key configured, returning mock backbone",
      );
      return getMockBackbone(topic, effectiveIncludeModules, customModules);
    }

    const startTime = Date.now();

    try {
      const { result, usage } = await this.callAI(provider, {
        ...options,
        includeModules: effectiveIncludeModules,
        customModules,
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
          templateType: effectiveIncludeModules.join(","),
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
          templateType: effectiveIncludeModules.join(","),
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

  private deduplicateBackboneNodes(nodes: BackboneNode[]): BackboneNode[] {
    const moduleMap = new Map<string, BackboneNode>();
    const rootNodes: BackboneNode[] = [];
    const otherNodes: BackboneNode[] = [];

    for (const node of nodes) {
      if (node.level === "root" && !node.properties?.backboneModule) {
        rootNodes.push(node);
        continue;
      }

      if (
        node.level === "core" &&
        node.properties?.backboneModule &&
        node.title
      ) {
        const existing = moduleMap.get(node.properties.backboneModule);
        if (!existing) {
          moduleMap.set(node.properties.backboneModule, node);
        } else {
          logger.info(
            `[Backbone Network] Duplicating backbone node for module ${node.properties.backboneModule}, keeping first one`,
          );
        }
      } else {
        otherNodes.push(node);
      }
    }

    return [...rootNodes, ...Array.from(moduleMap.values()), ...otherNodes];
  }

  private async callAI(
    provider: {
      providerType: AIProviderType;
      model: string;
      hasKey: boolean;
      client: unknown;
    },
    options: GenerateBackboneOptions & {
      includeModules: BackboneModule[];
      customModules?: BackboneModuleCustomConfig[];
    },
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
    const {
      topic,
      context,
      includeModules,
      maxNodesPerModule = 5,
      customModules,
    } = options;
    const model = options.model || provider.model;

    const systemPrompt = await this.buildSystemPrompt(
      includeModules,
      maxNodesPerModule,
      options.userId,
      options.graphId,
      customModules,
    );

    const userPrompt = this.buildUserPrompt(
      topic,
      context,
      includeModules,
      customModules,
    );

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
      customModules,
    );

    if (!validatedBackbone) {
      logger.warn("[Backbone Network] No valid backbone generated, using mock");
      return {
        result: getMockBackbone(topic, includeModules, customModules),
        usage: completion.usage,
      };
    }

    const correctedNodes: BackboneNode[] = [];
    const titleCorrections: Array<{
      nodeId: string;
      originalTitle: string;
      correctedTitle: string;
      module: string;
    }> = [];

    const customModuleTitles =
      customModules && customModules.length > 0
        ? new Map(customModules.map((cm) => [cm.module_type, cm.title]))
        : undefined;

    for (const node of validatedBackbone.nodes) {
      const { correctedNode, wasCorrected, originalTitle } =
        validateAndCorrectBackboneNodeTitle(node, customModuleTitles);

      if (wasCorrected && originalTitle) {
        titleCorrections.push({
          nodeId: node.id,
          originalTitle,
          correctedTitle: correctedNode.title,
          module: node.module,
        });
      }

      const nodeWithModule: BackboneNode = {
        ...correctedNode,
        properties: {
          ...correctedNode.properties,
          backboneModule: correctedNode.module,
        },
      };

      correctedNodes.push(nodeWithModule);
    }

    if (titleCorrections.length > 0) {
      logger.info("[Backbone Network] Title corrections applied:", {
        count: titleCorrections.length,
        corrections: titleCorrections.map(
          (c) => `"${c.originalTitle}" -> "${c.correctedTitle}" (${c.module})`,
        ),
      });
    }

    const deduplicatedNodes = this.deduplicateBackboneNodes(correctedNodes);

    if (deduplicatedNodes.length < correctedNodes.length) {
      logger.info("[Backbone Network] Deduplicated backbone nodes:", {
        originalCount: correctedNodes.length,
        deduplicatedCount: deduplicatedNodes.length,
        removedCount: correctedNodes.length - deduplicatedNodes.length,
      });
    }

    const finalBackbone: BackboneNetwork = {
      ...validatedBackbone,
      nodes: deduplicatedNodes,
    };

    return {
      result: {
        backbone: finalBackbone,
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
    customModules?: BackboneModuleCustomConfig[],
  ): Promise<string> {
    const useCustomModules = customModules && customModules.length > 0;

    const moduleDescriptions = useCustomModules
      ? customModules
          .map(
            (cm) => `- **${cm.title}** (${cm.module_type}): ${cm.description}`,
          )
          .join("\n")
      : includeModules
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
    customModules?: BackboneModuleCustomConfig[],
  ): string {
    let prompt = `研究主题：${topic}`;

    if (context && context.trim()) {
      prompt += `\n\n背景信息：\n${context}`;
    }

    if (customModules && customModules.length > 0) {
      const moduleLabels = customModules.map((cm) => cm.title).join("、");
      prompt += `\n\n请为这个研究主题生成包含以下模块的骨干网络：${moduleLabels}`;
    } else if (includeModules && includeModules.length > 0) {
      const moduleLabels = includeModules
        .map((m) => BACKBONE_MODULE_LABELS[m])
        .join("、");
      prompt += `\n\n请为这个研究主题生成包含以下模块的骨干网络：${moduleLabels}`;
    }

    prompt += `\n\n注意：`;
    prompt += `\n1. 只生成 root 和 core 级别的节点，不要生成更细粒度的节点`;
    prompt += `\n2. **每个节点都必须有 description 字段**，描述应该针对具体研究主题，不能使用通用描述`;
    prompt += `\n3. **每个节点都必须有 summary 字段**：20-30字的简短概览，概括该知识点的核心内容，应比标题更具体但比完整内容更精炼`;
    prompt += `\n4. 根节点的描述应该概括该模块或主题的核心内容`;
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

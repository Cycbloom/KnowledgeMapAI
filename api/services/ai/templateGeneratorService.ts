import type { AIProviderType } from "@shared/types";
import {
  BackboneModule,
  BACKBONE_MODULE_LABELS,
  BACKBONE_MODULE_COLORS,
  type TemplateCategory,
  type TemplateType,
  type LayoutSuggestion,
} from "@shared/types/graph";
import { getAIProviderForTask, getAIProvider } from "./factory";
import { promptService } from "./promptService";
import { withAIMonitoring } from "./aiMonitor";
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
import { backboneNetworkService } from "./backboneNetworkService";
import { backboneValidatorService } from "./backboneValidatorService";
import {
  validateTemplate,
  type GeneratedTemplateNode,
  type GeneratedTemplateEdge,
  type GeneratedTemplateScheme,
} from "./templateValidationService";

export interface GenerateTemplatesOptions {
  topic: string;
  context?: string;
  category?: TemplateCategory;
  templateType?: TemplateType;
  provider?: AIProviderType;
  model?: string;
  userId?: string;
  graphId?: string;
  maxNodes?: number;
  preferredLayout?: LayoutSuggestion;
}

export interface GenerateTemplatesResult {
  templates: GeneratedTemplateScheme[];
  metadata: {
    topic: string;
    generatedAt: string;
    provider: string;
    model: string;
  };
}

const TEMPLATE_GENERATION_PROMPT = `You are an expert knowledge graph template designer. Your task is to generate 3 different template schemes for the given topic.

## Requirements

For each template scheme, provide:
1. **Unique Structure**: Each template should have a different organizational approach
2. **Node Hierarchy**: Clear parent-child relationships with appropriate levels (root, core, sub, normal, leaf)
3. **Edge Relationships**: Meaningful connections between nodes
4. **Content Suggestions**: Brief description of what each node should contain
5. **Layout Recommendation**: Suggest the best layout type (radial, tree, network, hierarchical)
6. **Difficulty Assessment**: Rate the complexity (easy, medium, hard)
7. **Tags**: Auto-generate relevant tags for categorization

## Template Types to Consider

1. **Hierarchical/Tree Structure**: Top-down organization with clear levels
2. **Network/Mesh Structure**: Interconnected concepts with multiple relationships
3. **Process/Flow Structure**: Sequential or cyclical knowledge flow
4. **Quadrant/Matrix Structure**: Organized by two dimensions
5. **Timeline Structure**: Chronological or evolutionary progression

## Output Format

Return a JSON object with the following structure:
{
  "templates": [
    {
      "id": "template-1",
      "name": "Template Name",
      "description": "Brief description of this template approach",
      "nodes": [
        {
          "id": "node-1",
          "title": "Node Title",
          "description": "What this node represents",
          "level": "root|core|sub|normal|leaf",
          "parentId": null or "parent-node-id",
          "suggestedContent": "Brief suggestion for content",
          "color": "#hexcolor"
        }
      ],
      "edges": [
        {
          "source": "node-id",
          "target": "node-id",
          "relationship_type": "contains|related|prerequisite",
          "description": "Why this connection exists"
        }
      ],
      "layoutSuggestion": "radial|tree|network|hierarchical",
      "estimatedNodes": 10,
      "difficulty": "easy|medium|hard",
      "tags": ["tag1", "tag2"],
      "reasoning": "Why this structure works for the topic"
    }
  ]
}

## Guidelines

1. Generate exactly 3 different template schemes
2. Each template should have 5-15 nodes as examples
3. Use meaningful node titles (not generic like "Node 1")
4. Ensure all edge references point to valid node IDs
5. Consider the topic's nature when choosing structures
6. Provide clear reasoning for each template choice
7. Respond in Chinese for all descriptions and content`;

function generateTopicResearchBackboneNodes(
  topic: string,
): GeneratedTemplateNode[] {
  const backboneModules: BackboneModule[] = [
    BackboneModule.RESEARCH_BACKGROUND,
    BackboneModule.LITERATURE_REVIEW,
    BackboneModule.RESEARCH_METHODS,
    BackboneModule.CORE_CONCEPTS,
    BackboneModule.APPLICATION_DOMAINS,
    BackboneModule.FUTURE_DIRECTIONS,
  ];

  const nodes: GeneratedTemplateNode[] = [
    {
      id: "root",
      title: topic,
      description: `${topic}专题研究的核心主题`,
      level: "root",
      suggestedContent: `${topic}的核心概念和研究价值`,
      needsRefinement: false,
    },
  ];

  backboneModules.forEach((module, index) => {
    const angle = (2 * Math.PI * index) / backboneModules.length - Math.PI / 2;
    const radius = 200;

    nodes.push({
      id: `core-${module}`,
      title: BACKBONE_MODULE_LABELS[module],
      description: `${BACKBONE_MODULE_LABELS[module]}模块，需要进一步补充内容`,
      level: "core",
      parentId: "root",
      backboneModule: module,
      suggestedContent: `待完善：${BACKBONE_MODULE_LABELS[module]}相关内容`,
      needsRefinement: true,
      color: BACKBONE_MODULE_COLORS[module],
      x_position: 400 + radius * Math.cos(angle),
      y_position: 300 + radius * Math.sin(angle),
    });
  });

  return nodes;
}

function generateTopicResearchBackboneEdges(): GeneratedTemplateEdge[] {
  const backboneModules: BackboneModule[] = [
    BackboneModule.RESEARCH_BACKGROUND,
    BackboneModule.LITERATURE_REVIEW,
    BackboneModule.RESEARCH_METHODS,
    BackboneModule.CORE_CONCEPTS,
    BackboneModule.APPLICATION_DOMAINS,
    BackboneModule.FUTURE_DIRECTIONS,
  ];

  const edges: GeneratedTemplateEdge[] = [];

  backboneModules.forEach((module) => {
    edges.push({
      source: "root",
      target: `core-${module}`,
      relationship_type: "related",
      description: `${BACKBONE_MODULE_LABELS[module]}是专题研究的核心模块`,
    });
  });

  edges.push({
    source: "core-research_background",
    target: "core-literature_review",
    relationship_type: "related",
    description: "研究背景为文献综述提供基础",
  });

  edges.push({
    source: "core-literature_review",
    target: "core-core_concepts",
    relationship_type: "related",
    description: "文献综述提炼核心概念",
  });

  edges.push({
    source: "core-core_concepts",
    target: "core-research_methods",
    relationship_type: "related",
    description: "核心概念指导研究方法选择",
  });

  edges.push({
    source: "core-research_methods",
    target: "core-application_domains",
    relationship_type: "related",
    description: "研究方法应用于具体领域",
  });

  edges.push({
    source: "core-application_domains",
    target: "core-future_directions",
    relationship_type: "related",
    description: "应用领域指引未来方向",
  });

  return edges;
}

function getMockTemplates(
  topic: string,
  templateType?: TemplateType,
): GenerateTemplatesResult {
  if (templateType === "topic_research") {
    const backboneNodes = generateTopicResearchBackboneNodes(topic);
    const backboneEdges = generateTopicResearchBackboneEdges();

    const topicResearchTemplate: GeneratedTemplateScheme = {
      id: "topic-research-backbone",
      name: `${topic} - 专题研究骨架`,
      description:
        "采用专题研究结构，包含研究背景、文献综述、研究方法、核心概念、应用领域和未来方向六大模块",
      nodes: backboneNodes,
      edges: backboneEdges,
      layoutSuggestion: "radial",
      estimatedNodes: 7,
      difficulty: "hard",
      tags: ["专题研究", "学术调研", "深度分析", topic],
      reasoning: "适合进行深度专题研究，六大骨干模块帮助系统化组织研究内容",
    };

    return {
      templates: [topicResearchTemplate],
      metadata: {
        topic,
        generatedAt: new Date().toISOString(),
        provider: "mock",
        model: "mock",
      },
    };
  }

  const mockTemplates: GeneratedTemplateScheme[] = [
    {
      id: "mock-template-1",
      name: `${topic} - 层级结构`,
      description: "采用自上而下的层级结构，适合系统性学习",
      nodes: [
        {
          id: "root",
          title: topic,
          level: "root",
          parentId: undefined,
          suggestedContent: `${topic}的核心概念和定义`,
        },
        {
          id: "core-1",
          title: "基础概念",
          level: "core",
          parentId: "root",
          suggestedContent: "基本定义和术语",
        },
        {
          id: "core-2",
          title: "核心原理",
          level: "core",
          parentId: "root",
          suggestedContent: "核心理论和方法",
        },
        {
          id: "sub-1",
          title: "应用场景",
          level: "sub",
          parentId: "core-2",
          suggestedContent: "实际应用案例",
        },
        {
          id: "sub-2",
          title: "进阶内容",
          level: "sub",
          parentId: "core-2",
          suggestedContent: "深入研究方向",
        },
      ],
      edges: [
        { source: "root", target: "core-1", relationship_type: "contains" },
        { source: "root", target: "core-2", relationship_type: "contains" },
        { source: "core-2", target: "sub-1", relationship_type: "contains" },
        { source: "core-2", target: "sub-2", relationship_type: "contains" },
      ],
      layoutSuggestion: "tree",
      estimatedNodes: 10,
      difficulty: "medium",
      tags: ["层级结构", "系统学习", topic],
      reasoning: "适合初学者建立知识体系",
    },
    {
      id: "mock-template-2",
      name: `${topic} - 网络结构`,
      description: "采用网络状结构，展示概念间的关联",
      nodes: [
        {
          id: "center",
          title: topic,
          level: "root",
          parentId: undefined,
          suggestedContent: "中心主题",
        },
        {
          id: "node-1",
          title: "相关概念A",
          level: "core",
          parentId: "center",
          suggestedContent: "关联知识",
        },
        {
          id: "node-2",
          title: "相关概念B",
          level: "core",
          parentId: "center",
          suggestedContent: "关联知识",
        },
        {
          id: "node-3",
          title: "相关概念C",
          level: "core",
          parentId: "center",
          suggestedContent: "关联知识",
        },
        {
          id: "node-4",
          title: "交叉领域",
          level: "sub",
          parentId: "node-1",
          suggestedContent: "跨领域知识",
        },
      ],
      edges: [
        { source: "center", target: "node-1", relationship_type: "related" },
        { source: "center", target: "node-2", relationship_type: "related" },
        { source: "center", target: "node-3", relationship_type: "related" },
        { source: "node-1", target: "node-4", relationship_type: "related" },
        { source: "node-2", target: "node-3", relationship_type: "related" },
      ],
      layoutSuggestion: "network",
      estimatedNodes: 12,
      difficulty: "medium",
      tags: ["网络结构", "关联学习", topic],
      reasoning: "适合理解概念间的复杂关系",
    },
    {
      id: "mock-template-3",
      name: `${topic} - 流程结构`,
      description: "采用流程化结构，展示知识的演进过程",
      nodes: [
        {
          id: "start",
          title: `${topic}入门`,
          level: "root",
          parentId: undefined,
          suggestedContent: "入门基础",
        },
        {
          id: "step-1",
          title: "第一步：理解基础",
          level: "core",
          parentId: "start",
          suggestedContent: "基础知识",
        },
        {
          id: "step-2",
          title: "第二步：掌握方法",
          level: "core",
          parentId: "step-1",
          suggestedContent: "核心方法",
        },
        {
          id: "step-3",
          title: "第三步：实践应用",
          level: "sub",
          parentId: "step-2",
          suggestedContent: "实践练习",
        },
        {
          id: "end",
          title: "高级进阶",
          level: "leaf",
          parentId: "step-3",
          suggestedContent: "高级内容",
        },
      ],
      edges: [
        {
          source: "start",
          target: "step-1",
          relationship_type: "prerequisite",
        },
        {
          source: "step-1",
          target: "step-2",
          relationship_type: "prerequisite",
        },
        {
          source: "step-2",
          target: "step-3",
          relationship_type: "prerequisite",
        },
        { source: "step-3", target: "end", relationship_type: "prerequisite" },
      ],
      layoutSuggestion: "hierarchical",
      estimatedNodes: 8,
      difficulty: "easy",
      tags: ["流程结构", "循序渐进", topic],
      reasoning: "适合按步骤学习",
    },
  ];

  return {
    templates: mockTemplates,
    metadata: {
      topic,
      generatedAt: new Date().toISOString(),
      provider: "mock",
      model: "mock",
    },
  };
}

export class TemplateGeneratorService {
  async generateTemplates(
    options: GenerateTemplatesOptions,
  ): Promise<GenerateTemplatesResult> {
    const { topic, provider: providerType, templateType } = options;

    if (templateType === "topic_research") {
      logger.info(
        "[Template Generator] Using backboneNetworkService for topic_research",
      );

      const backboneResult = await backboneNetworkService.generateBackbone({
        topic,
        provider: providerType,
        model: options.model,
        userId: options.userId,
        graphId: options.graphId,
      });

      const nodes: GeneratedTemplateNode[] = backboneResult.backbone.nodes.map(
        (n) => ({
          id: n.id,
          title: n.title,
          description: n.description,
          summary: n.summary,
          level: n.level,
          parentId: n.parentId,
          suggestedContent: n.suggestedContent,
          backboneModule: n.module as BackboneModule,
          needsRefinement: n.level === "core",
          color: n.color,
        }),
      );

      const edges: GeneratedTemplateEdge[] = backboneResult.backbone.edges.map(
        (e) => ({
          source: e.source,
          target: e.target,
          relationship_type: e.relationship_type,
          description: e.description,
        }),
      );

      const coreNodes = nodes.filter((n) => n.level === "core");
      if (coreNodes.length > 0) {
        const nodesToValidate = coreNodes.map((n) => ({
          id: n.id,
          title: n.title,
          properties: {
            backboneModule: n.backboneModule,
          },
        }));

        const validationResult = await backboneValidatorService.validateNodes(
          nodesToValidate,
          {
            graphId: options.graphId,
            userId: options.userId,
            provider: providerType,
            model: options.model,
          },
        );

        if (
          !validationResult.valid &&
          validationResult.corrections.length > 0
        ) {
          logger.info(
            "[Template Generator] Applying corrections to backbone nodes",
            {
              correctionCount: validationResult.corrections.length,
            },
          );

          // 预构建 id -> node 索引，避免循环内 find 线性扫描（O(n×m) → O(n+m)）
          const nodesById = new Map(nodes.map((n) => [n.id, n]));
          for (const correction of validationResult.corrections) {
            const node = nodesById.get(correction.nodeId);
            if (node) {
              node.title = correction.correctedTitle;
              node.backboneModule = correction.backboneModule;
              logger.info(
                `[Template Generator] Corrected node ${correction.nodeId}: "${correction.originalTitle}" -> "${correction.correctedTitle}"`,
              );
            }
          }
        }
      }

      return {
        templates: [
          {
            id: "topic-research-backbone",
            name: `${topic} - 专题研究骨架`,
            description:
              "采用专题研究结构，包含研究背景、文献综述、研究方法、核心概念、应用领域和未来方向六大模块",
            nodes,
            edges,
            layoutSuggestion: backboneResult.backbone.layoutSuggestion,
            estimatedNodes: backboneResult.backbone.estimatedNodes,
            difficulty: "hard",
            tags: ["专题研究", "学术调研", "深度分析", topic],
            reasoning:
              backboneResult.backbone.reasoning ||
              "适合进行深度专题研究，六大骨干模块帮助系统化组织研究内容",
          },
        ],
        metadata: backboneResult.metadata,
      };
    }

    const provider = providerType
      ? await getAIProvider(providerType)
      : await getAIProviderForTask("text");

    if (!provider.hasKey) {
      logger.info(
        "[Template Generator] No API key configured, returning mock templates",
      );
      return getMockTemplates(topic, templateType);
    }

    try {
      // withAIMonitoring 统一记录 token/成本/耗时/成功率，替代手写双 recordLog
      return await withAIMonitoring<GenerateTemplatesResult>(
        {
          operation: "template_generation",
          provider: provider.providerType,
          model: options.model || provider.model,
          metadata: {
            userId: options.userId,
            graphId: options.graphId,
            topic: options.topic,
            templateType: options.templateType,
          },
        },
        () => this.callAI(provider, options),
      );
    } catch (error: unknown) {
      const err = error as Error;
      logger.error("[Template Generator] AI Error:", error);

      if (err instanceof TimeoutError) {
        throw new AppError(ErrorCodes.AI_TIMEOUT);
      }
      if (err instanceof RetryError) {
        throw new AppError(ErrorCodes.AI_PROVIDER_ERROR, {
          message: `AI 请求失败，已重试 ${err.attempts} 次: ${err.lastError.message}`,
        });
      }
      throw new AppError(ErrorCodes.AI_PROVIDER_ERROR, {
        message: err.message || "AI template generation failed",
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
    options: GenerateTemplatesOptions,
  ): Promise<{
    result: GenerateTemplatesResult;
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
    const { topic, context, category, templateType, preferredLayout } = options;
    const model = options.model || provider.model;

    const systemPrompt = await this.buildSystemPrompt(
      category,
      templateType,
      preferredLayout,
      options.userId,
      options.graphId,
    );

    const userPrompt = this.buildUserPrompt(topic, context);

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
            `[Template Generator] Retry attempt ${attempt}: ${error.message}`,
          );
        },
      },
    );

    const content = completion.choices[0].message.content;

    if (!content) {
      logger.error("[Template Generator] Empty response from AI");
      throw new AppError(ErrorCodes.AI_PROVIDER_ERROR, {
        message: "AI 返回了空响应",
      });
    }

    const parsed = parseAIResponse<{ templates: unknown[] }>(
      content,
      "Template Generation",
    );

    const validatedTemplates: GeneratedTemplateScheme[] = [];
    const templates = parsed.templates || [];

    for (let i = 0; i < templates.length; i++) {
      const validated = validateTemplate(templates[i], i);
      if (validated) {
        validatedTemplates.push(validated);
      }
    }

    if (validatedTemplates.length === 0) {
      logger.warn(
        "[Template Generator] No valid templates generated, using mock",
      );
      return {
        result: getMockTemplates(topic, templateType),
        usage: completion.usage,
      };
    }

    return {
      result: {
        templates: validatedTemplates.slice(0, 3),
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
    category?: TemplateCategory,
    templateType?: TemplateType,
    preferredLayout?: LayoutSuggestion,
    userId?: string,
    graphId?: string,
  ): Promise<string> {
    const categoryGuides: Record<TemplateCategory, string> = {
      knowledge:
        "Focus on educational structure with clear learning paths and prerequisites.",
      project:
        "Focus on project management structure with tasks, milestones, and dependencies.",
      analysis:
        "Focus on analytical structure with factors, comparisons, and conclusions.",
      architecture:
        "Focus on system architecture with modules, components, and their dependencies.",
    };

    let templateTypeGuidance = "";
    if (templateType && templateType !== "blank") {
      templateTypeGuidance =
        (await promptService.getRenderedPrompt(
          getSupabaseAdmin(),
          `template_type_${templateType}`,
          {},
          userId,
          graphId,
        )) || "";
    }

    const layoutGuides: Record<LayoutSuggestion, string> = {
      radial: "Center the main topic with related concepts radiating outward.",
      tree: "Use a hierarchical tree structure with clear parent-child relationships.",
      network:
        "Create an interconnected network showing relationships between concepts.",
      hierarchical: "Use a top-down hierarchical structure with clear levels.",
    };

    const categoryGuidance = category
      ? categoryGuides[category] || categoryGuides.knowledge
      : "";

    const layoutGuidance = preferredLayout
      ? layoutGuides[preferredLayout] || ""
      : "";

    const customPrompt = await promptService.getRenderedPrompt(
      getSupabaseAdmin(),
      "template_generation",
      {
        category: category || "knowledge",
        categoryGuidance,
        templateType: templateType || "",
        templateTypeGuidance,
        preferredLayout: preferredLayout || "radial",
        layoutGuidance,
      },
    );

    if (customPrompt && customPrompt.trim().length > 0) {
      return customPrompt;
    }

    let categorySection = "";
    if (categoryGuidance) {
      categorySection = `\n\n## Category Guidance\n${categoryGuidance}`;
    }

    let templateTypeSection = "";
    if (templateTypeGuidance) {
      templateTypeSection = `\n\n## Template Type Guidance\nYou are creating a "${templateType}" type graph. Follow this specific guidance:\n${templateTypeGuidance}`;
    }

    let layoutSection = "";
    if (layoutGuidance) {
      layoutSection = `\n\n## Preferred Layout\n${layoutGuidance}`;
    }

    return `${TEMPLATE_GENERATION_PROMPT}${categorySection}${templateTypeSection}${layoutSection}`;
  }

  private buildUserPrompt(topic: string, context?: string): string {
    let prompt = `主题：${topic}`;

    if (context && context.trim()) {
      prompt += `\n\n背景信息：\n${context}`;
    }

    prompt += `\n\n请为这个主题生成 3 个不同的知识图谱模板方案。`;

    return prompt;
  }
}

export const templateGeneratorService = new TemplateGeneratorService();

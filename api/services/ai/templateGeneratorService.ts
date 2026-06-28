import type { AIProviderType } from "@shared/types";
import type {
  TemplateNode,
  TemplateEdge,
  TemplateDifficulty,
  TemplateCategory,
  TemplateType,
  LayoutSuggestion,
  NodeLevel,
} from "@shared/types/graph";
import {
  BackboneModule,
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
} from "../../../shared/utils/retry";
import { AppError } from "../../middleware/errorHandler";
import { ErrorCodes } from "../../../shared/types/errorCodes";
import { getSupabaseAdmin } from "../../supabase";
import { backboneNetworkService } from "./backboneNetworkService";
import { backboneValidatorService } from "./backboneValidatorService";

export interface GeneratedTemplateNode extends TemplateNode {
  suggestedContent?: string;
  backboneModule?: BackboneModule;
  needsRefinement?: boolean;
}

export interface GeneratedTemplateEdge extends TemplateEdge {
  description?: string;
}

export interface GeneratedTemplateScheme {
  id: string;
  name: string;
  description: string;
  nodes: GeneratedTemplateNode[];
  edges: GeneratedTemplateEdge[];
  layoutSuggestion: LayoutSuggestion;
  estimatedNodes: number;
  difficulty: TemplateDifficulty;
  tags: string[];
  reasoning: string;
}

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

const TEMPLATE_VALIDATION_RULES = {
  minNodes: 3,
  maxNodes: 50,
  validLevels: ["root", "core", "sub", "normal", "leaf"] as NodeLevel[],
  validDifficulties: ["easy", "medium", "hard"] as TemplateDifficulty[],
  validLayouts: [
    "radial",
    "tree",
    "network",
    "hierarchical",
  ] as LayoutSuggestion[],
};

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

function validateNode(
  node: unknown,
  index: number,
): GeneratedTemplateNode | null {
  if (typeof node !== "object" || node === null) {
    logger.warn(
      `[Template Generator] Invalid node at index ${index}: not an object`,
    );
    return null;
  }

  const n = node as Record<string, unknown>;

  if (typeof n.id !== "string" || !n.id.trim()) {
    logger.warn(
      `[Template Generator] Invalid node at index ${index}: missing id`,
    );
    return null;
  }

  if (typeof n.title !== "string" || !n.title.trim()) {
    logger.warn(
      `[Template Generator] Invalid node at index ${index}: missing title`,
    );
    return null;
  }

  const level = n.level as NodeLevel;
  if (!TEMPLATE_VALIDATION_RULES.validLevels.includes(level)) {
    logger.warn(
      `[Template Generator] Invalid node at index ${index}: invalid level "${level}"`,
    );
    return null;
  }

  return {
    id: n.id as string,
    title: n.title as string,
    description: n.description as string | undefined,
    summary: n.summary as string | undefined,
    level,
    parentId: n.parentId as string | undefined,
    aiPrompt: n.aiPrompt as string | undefined,
    color: n.color as string | undefined,
    suggestedContent: n.suggestedContent as string | undefined,
    backboneModule: n.backboneModule as BackboneModule | undefined,
    needsRefinement: n.needsRefinement as boolean | undefined,
  };
}

function validateEdge(
  edge: unknown,
  validNodeIds: Set<string>,
  index: number,
): GeneratedTemplateEdge | null {
  if (typeof edge !== "object" || edge === null) {
    logger.warn(
      `[Template Generator] Invalid edge at index ${index}: not an object`,
    );
    return null;
  }

  const e = edge as Record<string, unknown>;

  if (typeof e.source !== "string" || !validNodeIds.has(e.source)) {
    logger.warn(
      `[Template Generator] Invalid edge at index ${index}: invalid source "${e.source}"`,
    );
    return null;
  }

  if (typeof e.target !== "string" || !validNodeIds.has(e.target)) {
    logger.warn(
      `[Template Generator] Invalid edge at index ${index}: invalid target "${e.target}"`,
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

function validateTemplate(
  template: unknown,
  index: number,
): GeneratedTemplateScheme | null {
  if (typeof template !== "object" || template === null) {
    logger.warn(
      `[Template Generator] Invalid template at index ${index}: not an object`,
    );
    return null;
  }

  const t = template as Record<string, unknown>;

  if (typeof t.name !== "string" || !t.name.trim()) {
    logger.warn(
      `[Template Generator] Invalid template at index ${index}: missing name`,
    );
    return null;
  }

  if (
    !Array.isArray(t.nodes) ||
    t.nodes.length < TEMPLATE_VALIDATION_RULES.minNodes
  ) {
    logger.warn(
      `[Template Generator] Invalid template at index ${index}: insufficient nodes`,
    );
    return null;
  }

  const validNodes: GeneratedTemplateNode[] = [];
  for (let i = 0; i < t.nodes.length; i++) {
    const validatedNode = validateNode(t.nodes[i], i);
    if (validatedNode) {
      validNodes.push(validatedNode);
    }
  }

  if (validNodes.length < TEMPLATE_VALIDATION_RULES.minNodes) {
    logger.warn(
      `[Template Generator] Template "${t.name}" has too few valid nodes`,
    );
    return null;
  }

  const validNodeIds = new Set(validNodes.map((n) => n.id));

  const validEdges: GeneratedTemplateEdge[] = [];
  if (Array.isArray(t.edges)) {
    for (let i = 0; i < t.edges.length; i++) {
      const validatedEdge = validateEdge(t.edges[i], validNodeIds, i);
      if (validatedEdge) {
        validEdges.push(validatedEdge);
      }
    }
  }

  const layoutSuggestion = t.layoutSuggestion as LayoutSuggestion;
  const validLayout = TEMPLATE_VALIDATION_RULES.validLayouts.includes(
    layoutSuggestion,
  )
    ? layoutSuggestion
    : "radial";

  const difficulty = t.difficulty as TemplateDifficulty;
  const validDifficulty = TEMPLATE_VALIDATION_RULES.validDifficulties.includes(
    difficulty,
  )
    ? difficulty
    : "medium";

  const tags = Array.isArray(t.tags)
    ? (t.tags as string[]).filter((tag) => typeof tag === "string").slice(0, 10)
    : [];

  return {
    id: (t.id as string) || `template-${index + 1}`,
    name: t.name as string,
    description: (t.description as string) || "",
    nodes: validNodes,
    edges: validEdges,
    layoutSuggestion: validLayout,
    estimatedNodes: Math.min(
      TEMPLATE_VALIDATION_RULES.maxNodes,
      Math.max(
        TEMPLATE_VALIDATION_RULES.minNodes,
        (t.estimatedNodes as number) || validNodes.length,
      ),
    ),
    difficulty: validDifficulty,
    tags,
    reasoning: (t.reasoning as string) || "",
  };
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

  if (templateType === "story_creation") {
    const storyCreationTemplate: GeneratedTemplateScheme = {
      id: "story-creation-backbone",
      name: `${topic} - 故事创作骨架`,
      description:
        "采用三幕式故事结构，包含铺垫、对抗、解决三大幕及关键情节节拍",
      nodes: [
        {
          id: "root",
          title: topic,
          description: `${topic}的故事结构`,
          level: "root",
          suggestedContent: `${topic}的故事整体概述`,
          needsRefinement: false,
        },
        {
          id: "act-1",
          title: "第一幕：铺垫",
          description: "介绍平凡世界、角色现状和核心问题",
          level: "core",
          parentId: "root",
          suggestedContent: "铺垫阶段（0-25%）",
          needsRefinement: true,
        },
        {
          id: "seq-1-1",
          title: "冒险召唤",
          description: "打破日常的事件发生",
          level: "sub",
          parentId: "act-1",
          suggestedContent: "第一幕序列",
        },
        {
          id: "seq-1-2",
          title: "跨越门槛",
          description: "主角决定踏上旅程",
          level: "sub",
          parentId: "act-1",
          suggestedContent: "第一幕序列",
        },
        {
          id: "act-2",
          title: "第二幕：对抗",
          description: "试炼、盟友、敌人，逐渐接近目标",
          level: "core",
          parentId: "root",
          suggestedContent: "对抗阶段（25-75%）",
          needsRefinement: true,
        },
        {
          id: "seq-2-1",
          title: "上升动作",
          description: "一系列挑战和考验",
          level: "sub",
          parentId: "act-2",
          suggestedContent: "第二幕序列",
        },
        {
          id: "seq-2-2",
          title: "中点转折",
          description: "重大转折点，信息揭露或方向改变",
          level: "sub",
          parentId: "act-2",
          suggestedContent: "第二幕序列",
        },
        {
          id: "seq-2-3",
          title: "危机时刻",
          description: "看似失败的低谷时刻",
          level: "sub",
          parentId: "act-2",
          suggestedContent: "第二幕序列",
        },
        {
          id: "act-3",
          title: "第三幕：解决",
          description: "最终对决、变革和新的平衡",
          level: "core",
          parentId: "root",
          suggestedContent: "解决阶段（75-100%）",
          needsRefinement: true,
        },
        {
          id: "seq-3-1",
          title: "高潮",
          description: "最大的冲突和转折",
          level: "sub",
          parentId: "act-3",
          suggestedContent: "第三幕序列",
        },
        {
          id: "seq-3-2",
          title: "尾声",
          description: "收尾和新常态",
          level: "sub",
          parentId: "act-3",
          suggestedContent: "第三幕序列",
        },
      ],
      edges: [
        { source: "root", target: "act-1", relationship_type: "contains" },
        { source: "root", target: "act-2", relationship_type: "contains" },
        { source: "root", target: "act-3", relationship_type: "contains" },
        { source: "act-1", target: "seq-1-1", relationship_type: "contains" },
        { source: "act-1", target: "seq-1-2", relationship_type: "contains" },
        { source: "act-2", target: "seq-2-1", relationship_type: "contains" },
        { source: "act-2", target: "seq-2-2", relationship_type: "contains" },
        { source: "act-2", target: "seq-2-3", relationship_type: "contains" },
        { source: "act-3", target: "seq-3-1", relationship_type: "contains" },
        { source: "act-3", target: "seq-3-2", relationship_type: "contains" },
        { source: "act-1", target: "act-2", relationship_type: "prerequisite" },
        { source: "act-2", target: "act-3", relationship_type: "prerequisite" },
      ],
      layoutSuggestion: "hierarchical",
      estimatedNodes: 11,
      difficulty: "medium",
      tags: ["故事创作", "三幕式", "叙事结构", topic],
      reasoning: "采用经典三幕式故事结构，帮助系统化组织故事情节和角色发展",
    };

    return {
      templates: [storyCreationTemplate],
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

          for (const correction of validationResult.corrections) {
            const node = nodes.find((n) => n.id === correction.nodeId);
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

    const startTime = Date.now();

    try {
      const { result, usage } = await this.callAI(provider, options);

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
        operation: "template_generation",
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
          templateType: options.templateType,
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
      logger.error("[Template Generator] AI Error:", error);

      performanceMonitor.recordLog({
        operation: "template_generation",
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
          templateType: options.templateType,
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
        "Focus on system architecture with modules, components, and their relationships.",
      creative:
        "Focus on narrative structure with story arcs, character development, and dramatic elements.",
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

  async generateStoryCreationStructure(
    topic: string,
    storyConfig?: {
      genre?: string;
      coreConflict?: string;
      characterHints?: string;
    },
    userId?: string,
    graphId?: string,
  ): Promise<{
    root: { title: string; content: string; summary?: string };
    coreNodes: Array<{ title: string; content?: string; summary?: string }>;
  }> {
    // Build story-specific prompt
    const genreText = storyConfig?.genre ? `题材: ${storyConfig.genre}` : "";
    const conflictText = storyConfig?.coreConflict
      ? `核心冲突: ${storyConfig.coreConflict}`
      : "";
    const characterText = storyConfig?.characterHints
      ? `角色提示: ${storyConfig.characterHints}`
      : "";

    const userPrompt = `请为以下故事创建结构骨架：

故事标题: ${topic}
${genreText}
${conflictText}
${characterText}

请生成三幕式故事结构，包含：
1. Story根节点（故事整体）
2. 3个Act节点（第一幕：铺垫、第二幕：对抗、第三幕：解决）
3. 每个Act下2-3个Sequence节点（关键情节节拍）
${characterText ? "4. 根据角色提示，在coreNodes末尾包含主要角色节点（每个角色一个节点，summary标注为'角色'）" : ""}

请以JSON格式返回，格式如下：
{
  "root": { "title": "故事标题", "content": "故事整体概述", "summary": "简短摘要" },
  "coreNodes": [
    { "title": "第一幕：铺垫", "content": "第一幕的描述", "summary": "铺垫阶段" },
    { "title": "冒险召唤", "content": "打破日常的事件", "summary": "第一幕序列1" },
    ...
  ]
}

注意：coreNodes中的节点按层级排列，Act节点在前，Sequence节点在后。`;

    // Try to use AI generation
    try {
      const provider = await getAIProviderForTask("text");

      if (!provider.hasKey) {
        logger.info(
          "[Template Generator] No API key configured, using story creation fallback",
        );
        return this.generateStoryCreationFallback(topic, storyConfig);
      }

      const systemPrompt = await this.buildSystemPrompt(
        undefined,
        "story_creation" as TemplateType,
        undefined,
        userId,
        graphId,
      );

      const model = provider.model;
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
              `[Template Generator] Story creation retry attempt ${attempt}: ${error.message}`,
            );
          },
        },
      );

      const content = completion.choices[0].message.content;

      if (!content) {
        logger.warn(
          "[Template Generator] Empty AI response for story creation, using fallback",
        );
        return this.generateStoryCreationFallback(topic, storyConfig);
      }

      // Parse AI response
      const parsed = this.parseStoryCreationResponse(content);
      return parsed;
    } catch (error) {
      logger.warn(
        "[Template Generator] Story creation AI error, using fallback:",
        error,
      );
      return this.generateStoryCreationFallback(topic, storyConfig);
    }
  }

  private parseStoryCreationResponse(aiResult: string): {
    root: { title: string; content: string; summary?: string };
    coreNodes: Array<{ title: string; content?: string; summary?: string }>;
  } {
    try {
      // Try to extract JSON from AI response
      const jsonMatch = aiResult.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.root && parsed.coreNodes) {
          return parsed;
        }
      }
    } catch {
      // Fall through to default
    }

    // Return a basic structure if parsing fails
    return {
      root: { title: "故事", content: "故事结构", summary: "故事结构骨架" },
      coreNodes: [
        {
          title: "第一幕：铺垫",
          content: "介绍平凡世界和角色",
          summary: "铺垫",
        },
        { title: "第二幕：对抗", content: "试炼与挑战", summary: "对抗" },
        {
          title: "第三幕：解决",
          content: "最终对决与新的平衡",
          summary: "解决",
        },
      ],
    };
  }

  private generateStoryCreationFallback(
    topic: string,
    storyConfig?: {
      genre?: string;
      coreConflict?: string;
      characterHints?: string;
    },
  ): {
    root: { title: string; content: string; summary?: string };
    coreNodes: Array<{ title: string; content?: string; summary?: string }>;
  } {
    const genreDesc = storyConfig?.genre ? `（${storyConfig.genre}题材）` : "";
    const conflictDesc = storyConfig?.coreConflict
      ? ` 核心冲突：${storyConfig.coreConflict}`
      : "";

    return {
      root: {
        title: topic,
        content: `${topic}${genreDesc}的故事结构。${conflictDesc}`,
        summary: `${topic} - 故事结构骨架`,
      },
      coreNodes: [
        {
          title: "第一幕：铺垫",
          content: "介绍平凡世界、角色现状和核心问题",
          summary: "铺垫阶段（0-25%）",
        },
        {
          title: "冒险召唤",
          content: "打破日常的事件发生",
          summary: "第一幕序列",
        },
        {
          title: "跨越门槛",
          content: "主角决定踏上旅程",
          summary: "第一幕序列",
        },
        {
          title: "第二幕：对抗",
          content: "试炼、盟友、敌人，逐渐接近目标",
          summary: "对抗阶段（25-75%）",
        },
        {
          title: "上升动作",
          content: "一系列挑战和考验",
          summary: "第二幕序列",
        },
        {
          title: "中点转折",
          content: "重大转折点，信息揭露或方向改变",
          summary: "第二幕序列",
        },
        {
          title: "危机时刻",
          content: "看似失败的低谷时刻",
          summary: "第二幕序列",
        },
        {
          title: "第三幕：解决",
          content: "最终对决、变革和新的平衡",
          summary: "解决阶段（75-100%）",
        },
        { title: "高潮", content: "最大的冲突和转折", summary: "第三幕序列" },
        { title: "尾声", content: "收尾和新常态", summary: "第三幕序列" },
      ],
    };
  }
}

export const templateGeneratorService = new TemplateGeneratorService();

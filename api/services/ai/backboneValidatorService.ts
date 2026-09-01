import {
  BACKBONE_MODULE_LABELS,
  BACKBONE_MODULE_TITLES,
  type BackboneModule,
} from "@shared/types/graph";
import { logger } from "../../utils/logger";
import { getAIProviderForTask } from "./factory";
import { withAIMonitoring } from "./aiMonitor";
import { parseAIResponse } from "./utils";
import { withTimeoutAndRetry, LONG_TIMEOUT } from "../../../shared/utils/retry";
import { AppError } from "../../middleware/errorHandler";
import { ErrorCodes } from "../../../shared/types/errorCodes";

export interface NodeToValidate {
  id: string;
  title: string;
  properties?: {
    backboneModule?: BackboneModule;
  };
}

export interface ValidationResult {
  valid: boolean;
  corrections: Array<{
    nodeId: string;
    originalTitle: string;
    correctedTitle: string;
    backboneModule: BackboneModule;
  }>;
  errors: Array<{
    nodeId: string;
    error: string;
  }>;
}

export interface NodeValidationResult {
  nodeId: string;
  isValid: boolean;
  suggestedModule?: BackboneModule;
  correctedTitle?: string;
  confidence: number;
  reason: string;
}

const MODULE_KEYWORDS: Record<BackboneModule, string[]> = {
  research_background: [
    "背景",
    "历史",
    "发展",
    "现状",
    "起源",
    "演变",
    "概况",
    "介绍",
    "概述",
    "综述",
  ],
  literature_review: [
    "文献",
    "理论",
    "研究",
    "综述",
    "评述",
    "理论基础",
    "相关工作",
    "研究现状",
    "文献综述",
  ],
  research_methods: [
    "方法",
    "技术",
    "实验",
    "设计",
    "工具",
    "流程",
    "步骤",
    "方法论",
    "研究方法",
    "实验方法",
  ],
  core_concepts: [
    "概念",
    "定义",
    "原理",
    "机制",
    "核心",
    "基础",
    "关键",
    "本质",
    "理论",
    "模型",
  ],
  application_domains: [
    "应用",
    "实践",
    "案例",
    "场景",
    "领域",
    "实例",
    "用途",
    "应用场景",
    "实际应用",
  ],
  future_directions: [
    "未来",
    "趋势",
    "展望",
    "发展",
    "方向",
    "挑战",
    "机遇",
    "前景",
    "研究方向",
    "发展趋势",
  ],
};

// 模块级预计算小写关键词表，避免在按节点高频调用的热路径里对静态关键词重复 toLowerCase
const MODULE_KEYWORDS_LOWER: Record<BackboneModule, string[]> = (() => {
  const lower = {} as Record<BackboneModule, string[]>;
  for (const [module, keywords] of Object.entries(MODULE_KEYWORDS)) {
    lower[module as BackboneModule] = keywords.map((k) => k.toLowerCase());
  }
  return lower;
})();

// 模块级预计算：小写标准标题 → 模块 的 Map，精确匹配由线性扫描降为 O(1)
const BACKBONE_MODULE_TITLES_LOWER = new Map<string, BackboneModule>(
  Object.entries(BACKBONE_MODULE_TITLES).map(([module, title]) => [
    title.toLowerCase(),
    module as BackboneModule,
  ]),
);

// 模块级 Set，isValidModule 用 has O(1) 替代原先每次构建对象后 includes 线性扫描
const VALID_BACKBONE_MODULES = new Set<string>(Object.keys(MODULE_KEYWORDS));

function inferModuleFromTitle(title: string): {
  module: BackboneModule;
  confidence: number;
} {
  const titleLower = title.toLowerCase();
  const scores: Array<{ module: BackboneModule; score: number }> = [];

  // 遍历预计算小写关键词表，避免每次调用对静态关键词重复 toLowerCase
  for (const [module, keywords] of Object.entries(MODULE_KEYWORDS_LOWER)) {
    let score = 0;
    for (const keyword of keywords) {
      if (titleLower.includes(keyword)) {
        score += 1;
      }
    }
    if (score > 0) {
      scores.push({ module: module as BackboneModule, score });
    }
  }

  if (scores.length === 0) {
    return {
      module: "core_concepts" as BackboneModule,
      confidence: 0.3,
    };
  }

  scores.sort((a, b) => b.score - a.score);
  const topScore = scores[0].score;
  const totalScore = scores.reduce((sum, s) => sum + s.score, 0);
  const confidence = topScore / totalScore;

  return {
    module: scores[0].module,
    confidence: Math.min(confidence, 0.95),
  };
}

function isValidModule(module: unknown): module is BackboneModule {
  // Set.has O(1) 判定，替代原先每次构建对象后 includes 线性扫描
  return typeof module === "string" && VALID_BACKBONE_MODULES.has(module);
}

export class BackboneValidatorService {
  validateBackboneNodeTitle(title: string): {
    isValid: boolean;
    module?: BackboneModule;
  } {
    const normalizedTitle = title.trim().toLowerCase();

    for (const [module, standardTitle] of Object.entries(
      BACKBONE_MODULE_TITLES,
    )) {
      if (normalizedTitle === standardTitle.toLowerCase()) {
        return {
          isValid: true,
          module: module as BackboneModule,
        };
      }
    }

    return { isValid: false };
  }

  correctBackboneNodeTitle(title: string): {
    correctedTitle: string;
    module: BackboneModule;
  } {
    const normalizedTitle = title.trim().toLowerCase();

    // 精确匹配改用预计算 Map，O(1) 定位（原先第一趟 Object.entries 线性扫描）
    const exactModule = BACKBONE_MODULE_TITLES_LOWER.get(normalizedTitle);
    if (exactModule) {
      return {
        correctedTitle: BACKBONE_MODULE_TITLES[exactModule],
        module: exactModule,
      };
    }

    // 标题包含标准标题（遍历预计算小写 Map，避免每次 toLowerCase）
    for (const [lowerTitle, module] of BACKBONE_MODULE_TITLES_LOWER) {
      if (normalizedTitle.includes(lowerTitle)) {
        return {
          correctedTitle: BACKBONE_MODULE_TITLES[module],
          module,
        };
      }
    }

    // 标准标题包含标题
    for (const [lowerTitle, module] of BACKBONE_MODULE_TITLES_LOWER) {
      if (lowerTitle.includes(normalizedTitle)) {
        return {
          correctedTitle: BACKBONE_MODULE_TITLES[module],
          module,
        };
      }
    }

    // 关键词匹配（遍历预计算小写关键词表，避免每次 toLowerCase）
    for (const [module, moduleKeywords] of Object.entries(MODULE_KEYWORDS_LOWER)) {
      for (const keyword of moduleKeywords) {
        if (normalizedTitle.includes(keyword)) {
          return {
            correctedTitle: BACKBONE_MODULE_TITLES[module as BackboneModule],
            module: module as BackboneModule,
          };
        }
      }
    }

    throw new AppError(ErrorCodes.VALIDATION_ERROR, {
      context: { title, message: "无法自动修正骨干节点标题" },
    });
  }

  validateBackboneModule(module: string): boolean {
    return isValidModule(module);
  }

  isBackboneNode(node: { properties?: { backboneModule?: string } }): boolean {
    if (!node?.properties?.backboneModule) {
      return false;
    }

    return this.validateBackboneModule(node.properties.backboneModule);
  }

  async validateNodes(
    nodes: NodeToValidate[],
    options?: {
      graphId?: string;
      userId?: string;
      provider?: string;
      model?: string;
    },
  ): Promise<ValidationResult> {
    const corrections: ValidationResult["corrections"] = [];
    const errors: ValidationResult["errors"] = [];

    logger.info("Starting backbone node validation", {
      nodeCount: nodes.length,
      graphId: options?.graphId,
      userId: options?.userId,
    });

    for (const node of nodes) {
      try {
        const result = await this.validateNode(node, options);
        
        if (!result.isValid) {
          if (result.correctedTitle && result.suggestedModule) {
            corrections.push({
              nodeId: node.id,
              originalTitle: node.title,
              correctedTitle: result.correctedTitle,
              backboneModule: result.suggestedModule,
            });
          } else {
            errors.push({
              nodeId: node.id,
              error: result.reason,
            });
          }
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        errors.push({
          nodeId: node.id,
          error: errorMessage,
        });
        logger.error("Node validation failed", {
          nodeId: node.id,
          error: errorMessage,
        });
      }
    }

    const valid = corrections.length === 0 && errors.length === 0;

    logger.info("Backbone node validation completed", {
      valid,
      correctionCount: corrections.length,
      errorCount: errors.length,
    });

    return {
      valid,
      corrections,
      errors,
    };
  }

  private async validateNode(
    node: NodeToValidate,
    _options?: {
      graphId?: string;
      userId?: string;
      provider?: string;
      model?: string;
    },
  ): Promise<NodeValidationResult> {
    const currentModule = node.properties?.backboneModule;

    if (!currentModule) {
      const { module, confidence } = inferModuleFromTitle(node.title);
      
      return {
        nodeId: node.id,
        isValid: false,
        suggestedModule: module,
        correctedTitle: node.title,
        confidence,
        reason: `节点未指定骨干模块，建议归类到「${BACKBONE_MODULE_LABELS[module]}」`,
      };
    }

    if (!isValidModule(currentModule)) {
      const { module, confidence } = inferModuleFromTitle(node.title);
      
      return {
        nodeId: node.id,
        isValid: false,
        suggestedModule: module,
        correctedTitle: node.title,
        confidence,
        reason: `无效的骨干模块「${currentModule}」，建议归类到「${BACKBONE_MODULE_LABELS[module]}」`,
      };
    }

    const titleValidation = this.validateTitleForModule(
      node.title,
      currentModule,
    );

    if (!titleValidation.isValid) {
      return {
        nodeId: node.id,
        isValid: false,
        suggestedModule: currentModule,
        correctedTitle: titleValidation.suggestedTitle || node.title,
        confidence: titleValidation.confidence,
        reason: titleValidation.reason,
      };
    }

    return {
      nodeId: node.id,
      isValid: true,
      confidence: 1.0,
      reason: "节点验证通过",
    };
  }

  private validateTitleForModule(
    title: string,
    module: BackboneModule,
  ): {
    isValid: boolean;
    suggestedTitle?: string;
    confidence: number;
    reason: string;
  } {
    const keywords = MODULE_KEYWORDS_LOWER[module];
    const titleLower = title.toLowerCase();

    const hasKeyword = keywords.some((keyword) =>
      titleLower.includes(keyword),
    );

    if (hasKeyword) {
      return {
        isValid: true,
        confidence: 0.9,
        reason: "标题与模块关键词匹配",
      };
    }

    const suggestedTitle = this.generateSuggestedTitle(title, module);

    return {
      isValid: false,
      suggestedTitle,
      confidence: 0.7,
      reason: `标题与模块「${BACKBONE_MODULE_LABELS[module]}」的关键词不匹配，建议修改`,
    };
  }

  private generateSuggestedTitle(
    originalTitle: string,
    module: BackboneModule,
  ): string {
    const moduleLabel = BACKBONE_MODULE_TITLES[module];
    
    if (originalTitle.includes(moduleLabel)) {
      return originalTitle;
    }

    const keywords = MODULE_KEYWORDS_LOWER[module];
    const titleLower = originalTitle.toLowerCase();

    for (const keyword of keywords.slice(0, 3)) {
      if (titleLower.includes(keyword)) {
        return originalTitle;
      }
    }

    return `${moduleLabel}：${originalTitle}`;
  }

  async validateNodesWithAI(
    nodes: NodeToValidate[],
    context: string,
    options?: {
      graphId?: string;
      userId?: string;
      provider?: string;
      model?: string;
    },
  ): Promise<ValidationResult> {
    try {
      const provider = await getAIProviderForTask("text");

      if (!provider.hasKey) {
        logger.info(
          "No AI provider available, using rule-based validation",
        );
        return this.validateNodes(nodes, options);
      }

      const systemPrompt = await this.buildSystemPrompt();
      const userPrompt = this.buildUserPrompt(nodes, context);

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
                prompt_tokens_details?: { cached_tokens?: number };
                completion_tokens_details?: { reasoning_tokens?: number };
              };
            }>;
          };
        };
      };

      // withAIMonitoring 统一记录 token/成本/耗时/成功率（内层 withTimeoutAndRetry 负责重试）
      const completion = await withAIMonitoring<{
        choices: Array<{ message: { content: string | null } }>;
        usage?: {
          prompt_tokens?: number;
          completion_tokens?: number;
          prompt_tokens_details?: { cached_tokens?: number };
          completion_tokens_details?: { reasoning_tokens?: number };
        };
      }>(
        {
          operation: "backbone_validation",
          provider: provider.providerType,
          model: options?.model || provider.model,
          metadata: {
            userId: options?.userId,
            graphId: options?.graphId,
          },
        },
        async () => {
          const completion = await withTimeoutAndRetry(
            () =>
              client.chat.completions.create({
                messages: [
                  { role: "system", content: systemPrompt },
                  { role: "user", content: userPrompt },
                ],
                model: options?.model || provider.model,
                response_format: { type: "json_object" },
                max_tokens: 2000,
              }),
            {
              timeout: LONG_TIMEOUT,
              maxRetries: 2,
            },
          );
          return { result: completion, usage: completion.usage };
        },
      );

      const content = completion.choices[0].message.content;

      if (!content) {
        throw new AppError(ErrorCodes.AI_PROVIDER_ERROR, {
          message: "AI 返回了空响应",
        });
      }

      const parsed = parseAIResponse<{ results: NodeValidationResult[] }>(
        content,
        "Backbone Validation",
      );

      const corrections: ValidationResult["corrections"] = [];
      const errors: ValidationResult["errors"] = [];

      // 预构建节点 id 索引，避免循环内 find 线性扫描（O(results×nodes)→O(results)）
      const nodeById = new Map(nodes.map((n) => [n.id, n]));

      for (const result of parsed.results || []) {
        if (!result.isValid) {
          const originalNode = nodeById.get(result.nodeId);
          if (originalNode && result.correctedTitle && result.suggestedModule) {
            corrections.push({
              nodeId: result.nodeId,
              originalTitle: originalNode.title,
              correctedTitle: result.correctedTitle,
              backboneModule: result.suggestedModule,
            });
          } else {
            errors.push({
              nodeId: result.nodeId,
              error: result.reason,
            });
          }
        }
      }

      return {
        valid: corrections.length === 0 && errors.length === 0,
        corrections,
        errors,
      };
    } catch (error) {
      logger.error("AI-based backbone validation failed", error);

      logger.info("Falling back to rule-based validation");
      return this.validateNodes(nodes, options);
    }
  }

  private async buildSystemPrompt(): Promise<string> {
    return `你是知识图谱骨干节点验证专家。你的任务是验证节点是否符合骨干模块的规范。

## 骨干模块说明

1. **研究背景 (research_background)**: 研究主题的背景信息、发展历程和现状
2. **文献综述 (literature_review)**: 相关文献的综述和分析
3. **研究方法 (research_methods)**: 研究采用的方法论和技术手段
4. **核心概念 (core_concepts)**: 领域的核心概念和理论框架
5. **应用领域 (application_domains)**: 理论和方法的应用场景
6. **未来方向 (future_directions)**: 未来发展趋势和研究方向

## 验证规则

1. 节点标题应准确反映其所属模块的内容
2. 节点应归类到最合适的骨干模块
3. 标题应简洁明了，避免过于宽泛或模糊
4. 同一模块内的节点应保持语义一致性

## 返回格式

返回 JSON 格式：
{
  "results": [
    {
      "nodeId": "节点ID",
      "isValid": true/false,
      "suggestedModule": "建议的模块（如果无效）",
      "correctedTitle": "修正后的标题（如果需要）",
      "confidence": 0.0-1.0,
      "reason": "验证结果说明"
    }
  ]
}`;
  }

  private buildUserPrompt(
    nodes: NodeToValidate[],
    context: string,
  ): string {
    const nodesInfo = nodes
      .map(
        (n) =>
          `- ID: ${n.id}
  标题: ${n.title}
  当前模块: ${n.properties?.backboneModule || "未指定"}`,
      )
      .join("\n");

    return `请验证以下节点是否符合骨干模块规范：

${nodesInfo}

上下文：${context}

请逐一验证每个节点，并提供修正建议。`;
  }
}

export const backboneValidatorService = new BackboneValidatorService();

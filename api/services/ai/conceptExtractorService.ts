import { getAIProviderForTask } from "./factory";
import type { AIProviderType } from "@shared/types";
import { promptService } from "./promptService";
import { getSupabaseAdmin } from "../../supabase";
import { logger } from "../../utils/logger";
import { parseAIResponse } from "./utils";
import { performanceMonitor } from "./performanceMonitor";
import { pricingService } from "./pricingService";
import {
  withTimeoutAndRetry,
  TimeoutError,
  RetryError,
  LONG_TIMEOUT,
} from "../../utils/retry";
import { AppError } from "../../middleware/errorHandler";
import { ErrorCodes } from "../../../shared/types/errorCodes";
import type {
  ConceptType,
  BackboneModule,
  ExtractedConcept,
  LiteratureInfo,
  ExtractedRelation,
} from "@shared/types/graph";

export interface ExtractConceptsOptions {
  provider?: AIProviderType;
  model?: string;
  maxConcepts?: number;
  extractTypes?: ConceptType[];
  similarityThreshold?: number;
  userId?: string;
  graphId?: string;
  language?: string;
}

export interface ExtractConceptsResult {
  concepts: ExtractedConcept[];
  relations: ExtractedRelation[];
}

export interface ParsedContent {
  title: string;
  abstract?: string;
  sections: Array<{
    heading: string;
    content: string;
  }>;
  keywords?: string[];
  references?: Array<{
    title: string;
    authors?: string[];
    year?: number;
  }>;
}

interface ConceptExtractionResponse {
  concepts: Array<{
    title: string;
    description: string;
    type: ConceptType;
    targetModule?: BackboneModule;
    importance: number;
    context: string;
  }>;
  relations: Array<{
    source: string;
    target: string;
    type: string;
    confidence: number;
    description: string;
  }>;
}

const CONCEPT_TYPE_DEFINITIONS: Record<ConceptType, string> = {
  method:
    "方法 (method): 用于解决问题或达成目标的系统性步骤、流程或策略。例如：实验方法、分析方法、设计方法。",
  mechanism:
    "机制 (mechanism): 系统或现象运作的内在原理、规律或过程。例如：作用机制、调节机制、反馈机制。",
  operation:
    "操作 (operation): 具体的执行动作、操作步骤或技术手段。例如：计算操作、操作流程、操作规范。",
  concept:
    "概念 (concept): 抽象的思维对象、理论概念或定义。例如：核心概念、理论概念、基本概念。",
  technology:
    "技术 (technology): 具体的技术工具、技术方案或技术体系。例如：核心技术、新兴技术、技术框架。",
  tool: "工具 (tool): 用于辅助研究、分析或实施的软件、硬件或平台。例如：分析工具、开发工具、研究工具。",
};

const BACKBONE_MODULE_DESCRIPTIONS: Record<BackboneModule, string> = {
  research_background: "研究背景: 研究的背景信息、问题起源、研究动机等",
  literature_review: "文献综述: 相关研究的回顾、对比分析、研究现状",
  research_methods: "研究方法: 采用的研究方法、实验设计、技术路线",
  core_concepts: "核心概念: 核心理论概念、关键定义、基础原理",
  application_domains: "应用领域: 实际应用场景、应用案例、领域扩展",
  future_directions: "未来方向: 研究展望、发展趋势、待解决问题",
};

function extractTokenUsage(
  usage:
    | {
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
      }
    | undefined,
): {
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
  uncachedInputTokens: number;
  reasoningTokens: number;
} {
  const inputTokens = usage?.prompt_tokens || 0;
  const outputTokens = usage?.completion_tokens || 0;
  const cachedInputTokens = usage?.prompt_tokens_details?.cached_tokens || 0;

  return {
    inputTokens,
    outputTokens,
    cachedInputTokens,
    uncachedInputTokens: Math.max(0, inputTokens - cachedInputTokens),
    reasoningTokens: usage?.completion_tokens_details?.reasoning_tokens || 0,
  };
}

async function withPerformanceTracking<T>(
  options: {
    operation: string;
    provider: AIProviderType;
    model: string;
    metadata?: Record<string, unknown>;
  },
  fn: () => Promise<{
    result: T;
    usage?: {
      prompt_tokens?: number;
      completion_tokens?: number;
    };
  }>,
): Promise<T> {
  const startTime = Date.now();
  let success = true;
  let errorMessage: string | undefined;
  let inputTokens = 0;
  let outputTokens = 0;

  try {
    const { result, usage } = await fn();
    const tokenUsage = extractTokenUsage(usage);
    inputTokens = tokenUsage.inputTokens;
    outputTokens = tokenUsage.outputTokens;
    return result;
  } catch (error: unknown) {
    success = false;
    const err = error as Error;
    errorMessage = err.message;
    throw error;
  } finally {
    const duration = Date.now() - startTime;
    const totalTokens = inputTokens + outputTokens;
    const estimatedCost = pricingService.calculateCost(
      options.provider,
      options.model,
      inputTokens,
      outputTokens,
    );

    performanceMonitor.recordLog({
      operation: options.operation,
      provider: options.provider,
      model: options.model,
      inputTokens,
      outputTokens,
      totalTokens,
      estimatedCost,
      duration,
      success,
      errorMessage,
      metadata: options.metadata,
    });
  }
}

function parseTextContent(content: string): ParsedContent {
  const lines = content.split("\n").filter((line) => line.trim());
  const result: ParsedContent = {
    title: "",
    sections: [],
  };

  let currentSection: { heading: string; content: string } | null = null;

  for (const line of lines) {
    const trimmedLine = line.trim();

    if (trimmedLine.startsWith("# ") && !result.title) {
      result.title = trimmedLine.slice(2).trim();
    } else if (
      trimmedLine.startsWith("## ") ||
      trimmedLine.startsWith("### ")
    ) {
      if (currentSection) {
        result.sections.push(currentSection);
      }
      currentSection = {
        heading: trimmedLine.replace(/^#+\s*/, ""),
        content: "",
      };
    } else if (currentSection) {
      currentSection.content +=
        (currentSection.content ? "\n" : "") + trimmedLine;
    } else if (!result.title && trimmedLine.length > 0) {
      result.title = trimmedLine;
    }
  }

  if (currentSection) {
    result.sections.push(currentSection);
  }

  const abstractSection = result.sections.find(
    (s) =>
      s.heading.toLowerCase().includes("abstract") ||
      s.heading.includes("摘要") ||
      s.heading.includes("概述"),
  );
  if (abstractSection) {
    result.abstract = abstractSection.content;
  }

  const keywordSection = result.sections.find(
    (s) =>
      s.heading.toLowerCase().includes("keyword") ||
      s.heading.includes("关键词"),
  );
  if (keywordSection) {
    result.keywords = keywordSection.content
      .split(/[,，;；、\n]/)
      .map((k) => k.trim())
      .filter((k) => k.length > 0 && k.length < 30);
  }

  return result;
}

function mapConceptToModule(conceptType: ConceptType): BackboneModule {
  const mapping: Record<ConceptType, BackboneModule> = {
    method: "research_methods",
    mechanism: "core_concepts",
    operation: "research_methods",
    concept: "core_concepts",
    technology: "application_domains",
    tool: "research_methods",
  };
  return mapping[conceptType];
}

function buildExtractionPrompt(
  content: string,
  parsedContent: ParsedContent,
  options: ExtractConceptsOptions,
): string {
  const maxConcepts = options.maxConcepts || 10;
  const extractTypes = options.extractTypes || [
    "method",
    "mechanism",
    "operation",
    "concept",
    "technology",
    "tool",
  ];

  const typeDescriptions = extractTypes
    .map((t) => CONCEPT_TYPE_DEFINITIONS[t])
    .join("\n");

  const moduleDescriptions = Object.entries(BACKBONE_MODULE_DESCRIPTIONS)
    .map(([_key, desc]) => `- ${desc}`)
    .join("\n");

  let contextInfo = "";
  if (parsedContent.title) {
    contextInfo += `文档标题: ${parsedContent.title}\n`;
  }
  if (parsedContent.abstract) {
    contextInfo += `摘要: ${parsedContent.abstract.slice(0, 500)}...\n`;
  }
  if (parsedContent.keywords && parsedContent.keywords.length > 0) {
    contextInfo += `关键词: ${parsedContent.keywords.join(", ")}\n`;
  }

  return `你是一个专业的学术文献分析专家，擅长从文献中提取关键概念并分类。

## 任务说明
请从以下文献内容中提取 ${maxConcepts} 个最重要的概念，并进行分类和定位。

## 概念类型定义
${typeDescriptions}

## 骨干模块说明
${moduleDescriptions}

## 文献信息
${contextInfo}

## 文献内容
${content.slice(0, 8000)}

## 提取要求
1. 每个概念必须包含：标题、描述、类型、目标模块、重要性评分(1-5)
2. 概念标题要简洁准确（不超过20字）
3. 描述要说明概念的核心内容和作用（50-100字）
4. 类型必须从给定的概念类型中选择
5. 目标模块根据概念性质智能定位
6. 重要性评分反映概念在文献中的核心程度
7. 同时提取概念之间的关系（如依赖、关联、对比等）

请严格按照 JSON 格式返回结果。`;
}

function buildExtractionSchema(): string {
  return `
返回一个 JSON 对象，包含以下结构：
{
  "concepts": [
    {
      "title": "概念标题（简洁准确，不超过20字）",
      "description": "概念描述（50-100字，说明核心内容和作用）",
      "type": "method|mechanism|operation|concept|technology|tool",
      "targetModule": "research_background|literature_review|research_methods|core_concepts|application_domains|future_directions",
      "importance": 1-5的数字,
      "context": "概念在原文中的上下文引用（原文片段）"
    }
  ],
  "relations": [
    {
      "source": "源概念标题",
      "target": "目标概念标题",
      "type": "depends_on|related_to|prerequisite|contrasts_with|similar_to",
      "confidence": 0.0-1.0的置信度,
      "description": "关系描述"
    }
  ]
}

关系类型说明：
- depends_on: A 依赖于 B
- related_to: A 与 B 相关
- prerequisite: B 是 A 的前置知识
- contrasts_with: A 与 B 对比
- similar_to: A 与 B 相似

重要：
- concepts 数组包含 5-${10} 个概念
- relations 数组包含概念之间的关系
- 概念标题必须在 concepts 中存在
- 置信度反映关系的确定性程度`;
}

export class ConceptExtractorService {
  async extractConcepts(
    content: string,
    literature: LiteratureInfo,
    options: ExtractConceptsOptions = {},
  ): Promise<ExtractConceptsResult> {
    const provider = options.provider
      ? await getAIProviderForTask("text")
      : await getAIProviderForTask("text");

    if (!provider.hasKey) {
      return this.getMockExtraction(literature);
    }

    const parsedContent = parseTextContent(content);

    try {
      const model = options.model || provider.model;

      return withPerformanceTracking(
        {
          operation: "extractConcepts",
          provider: provider.providerType,
          model,
          metadata: {
            literatureTitle: literature.title,
            maxConcepts: options.maxConcepts || 10,
          },
        },
        async () => {
          const systemPrompt = await promptService.getRenderedPrompt(
            getSupabaseAdmin(),
            "concept_extraction",
            {
              maxConcepts: options.maxConcepts || 10,
              extractTypes: (
                options.extractTypes || [
                  "method",
                  "mechanism",
                  "operation",
                  "concept",
                  "technology",
                  "tool",
                ]
              ).join(", "),
            },
            options.userId,
            options.graphId,
            options.language,
          );

          const userPrompt = buildExtractionPrompt(
            content,
            parsedContent,
            options,
          );
          const schema = buildExtractionSchema();

          const finalSystemPrompt =
            systemPrompt || `${userPrompt}\n\n${schema}`;

          const completion = await withTimeoutAndRetry(
            () =>
              provider.client.chat.completions.create({
                messages: [
                  { role: "system", content: finalSystemPrompt },
                  {
                    role: "user",
                    content: `请从上述文献中提取概念和关系。`,
                  },
                ],
                model,
                response_format: { type: "json_object" },
              }),
            {
              timeout: LONG_TIMEOUT,
              maxRetries: 3,
              onRetry: (attempt, error) => {
                logger.warn(
                  `Extract Concepts retry attempt ${attempt}: ${error.message}`,
                );
              },
            },
          );

          const rawContent = completion.choices[0].message.content || "";
          const parsed = parseAIResponse<ConceptExtractionResponse>(
            rawContent,
            "Extract Concepts",
          );

          const concepts: ExtractedConcept[] = (parsed.concepts || []).map(
            (c) => ({
              title: c.title,
              description: c.description,
              type: c.type,
              source: literature,
              targetModule: c.targetModule || mapConceptToModule(c.type),
            }),
          );

          const relations: ExtractedRelation[] = (parsed.relations || []).map(
            (r) => ({
              source: r.source,
              target: r.target,
              type: r.type,
              confidence: r.confidence,
            }),
          );

          return {
            result: { concepts, relations },
            usage: completion.usage,
          };
        },
      );
    } catch (error: unknown) {
      const err = error as Error;
      logger.error("Concept Extraction Error:", error);

      if (err instanceof TimeoutError) {
        throw new AppError(ErrorCodes.AI_TIMEOUT);
      }
      if (err instanceof RetryError) {
        throw new AppError(ErrorCodes.AI_PROVIDER_ERROR, {
          message: `AI 请求失败，已重试 ${err.attempts} 次: ${err.lastError.message}`,
        });
      }
      throw new AppError(ErrorCodes.AI_PROVIDER_ERROR, {
        message: err.message || "概念提取失败",
      });
    }
  }

  async classifyConcept(
    conceptTitle: string,
    conceptDescription: string,
    options: {
      provider?: AIProviderType;
      model?: string;
      language?: string;
    } = {},
  ): Promise<{
    type: ConceptType;
    targetModule: BackboneModule;
    confidence: number;
  }> {
    const provider = await getAIProviderForTask("text");

    if (!provider.hasKey) {
      return {
        type: "concept",
        targetModule: "core_concepts",
        confidence: 0.5,
      };
    }

    try {
      const model = options.model || provider.model;

      return withPerformanceTracking(
        {
          operation: "classifyConcept",
          provider: provider.providerType,
          model,
          metadata: {
            conceptTitle,
          },
        },
        async () => {
          const typeDescriptions = Object.entries(CONCEPT_TYPE_DEFINITIONS)
            .map(([_key, desc]) => `- ${desc}`)
            .join("\n");

          const completion = await provider.client.chat.completions.create({
            messages: [
              {
                role: "system",
                content: `你是一个概念分类专家。请根据概念标题和描述，判断其最合适的类型。

概念类型定义：
${typeDescriptions}

返回 JSON 格式：
{
  "type": "method|mechanism|operation|concept|technology|tool",
  "confidence": 0.0-1.0
}`,
              },
              {
                role: "user",
                content: `概念标题: ${conceptTitle}\n概念描述: ${conceptDescription}`,
              },
            ],
            model,
            response_format: { type: "json_object" },
          });

          const rawContent = completion.choices[0].message.content || "";
          const parsed = parseAIResponse<{
            type: ConceptType;
            confidence: number;
          }>(rawContent, "Classify Concept");

          const type = parsed.type || "concept";
          const targetModule = mapConceptToModule(type);

          return {
            result: {
              type,
              targetModule,
              confidence: parsed.confidence || 0.7,
            },
            usage: completion.usage,
          };
        },
      );
    } catch (error: unknown) {
      logger.error("Classify Concept Error:", error);
      return {
        type: "concept",
        targetModule: "core_concepts",
        confidence: 0.5,
      };
    }
  }

  async locateBackboneModule(
    conceptTitle: string,
    conceptDescription: string,
    conceptType: ConceptType,
    graphContext?: {
      title?: string;
      description?: string;
      existingModules?: BackboneModule[];
    },
    options: {
      provider?: AIProviderType;
      model?: string;
      language?: string;
    } = {},
  ): Promise<{
    module: BackboneModule;
    confidence: number;
    reason: string;
  }> {
    const defaultModule = mapConceptToModule(conceptType);

    if (!graphContext) {
      return {
        module: defaultModule,
        confidence: 0.8,
        reason: `根据概念类型 "${conceptType}" 自动映射`,
      };
    }

    const provider = await getAIProviderForTask("text");

    if (!provider.hasKey) {
      return {
        module: defaultModule,
        confidence: 0.7,
        reason: "默认映射",
      };
    }

    try {
      const model = options.model || provider.model;

      return withPerformanceTracking(
        {
          operation: "locateBackboneModule",
          provider: provider.providerType,
          model,
        },
        async () => {
          const moduleDescriptions = Object.entries(
            BACKBONE_MODULE_DESCRIPTIONS,
          )
            .map(([_key, desc]) => `- ${desc}`)
            .join("\n");

          const contextInfo = graphContext.title
            ? `\n图谱信息:\n标题: ${graphContext.title}\n描述: ${graphContext.description || "无"}`
            : "";

          const completion = await provider.client.chat.completions.create({
            messages: [
              {
                role: "system",
                content: `你是一个知识图谱构建专家。请根据概念信息，判断其最适合的骨干模块位置。

骨干模块说明：
${moduleDescriptions}
${contextInfo}

返回 JSON 格式：
{
  "module": "research_background|literature_review|research_methods|core_concepts|application_domains|future_directions",
  "confidence": 0.0-1.0,
  "reason": "定位理由（简短说明）"
}`,
              },
              {
                role: "user",
                content: `概念标题: ${conceptTitle}\n概念描述: ${conceptDescription}\n概念类型: ${conceptType}`,
              },
            ],
            model,
            response_format: { type: "json_object" },
          });

          const rawContent = completion.choices[0].message.content || "";
          const parsed = parseAIResponse<{
            module: BackboneModule;
            confidence: number;
            reason: string;
          }>(rawContent, "Locate Backbone Module");

          return {
            result: {
              module: parsed.module || defaultModule,
              confidence: parsed.confidence || 0.7,
              reason: parsed.reason || "智能定位",
            },
            usage: completion.usage,
          };
        },
      );
    } catch (error: unknown) {
      logger.error("Locate Backbone Module Error:", error);
      return {
        module: defaultModule,
        confidence: 0.6,
        reason: "默认映射（定位失败）",
      };
    }
  }

  async findSimilarConcepts(
    concept: ExtractedConcept,
    existingConcepts: ExtractedConcept[],
    threshold: number = 0.7,
  ): Promise<
    Array<{
      concept: ExtractedConcept;
      similarity: number;
    }>
  > {
    if (existingConcepts.length === 0) {
      return [];
    }

    const provider = await getAIProviderForTask("text");

    if (!provider.hasKey) {
      const titleWords = concept.title.toLowerCase().split(/\s+/);
      return existingConcepts
        .filter((c) => {
          const existingWords = c.title.toLowerCase().split(/\s+/);
          const commonWords = titleWords.filter((w) =>
            existingWords.includes(w),
          );
          return commonWords.length > 0;
        })
        .slice(0, 3)
        .map((c) => ({
          concept: c,
          similarity: 0.6,
        }));
    }

    try {
      const model = provider.model;

      const existingConceptsText = existingConcepts
        .slice(0, 20)
        .map((c, i) => `${i + 1}. ${c.title}: ${c.description.slice(0, 100)}`)
        .join("\n");

      const completion = await provider.client.chat.completions.create({
        messages: [
          {
            role: "system",
            content: `你是一个概念相似度分析专家。请判断新概念与现有概念的相似程度。

返回 JSON 格式：
{
  "similarities": [
    {
      "index": 概念序号（从1开始）,
      "similarity": 0.0-1.0的相似度,
      "reason": "相似原因"
    }
  ]
}

只返回相似度 >= ${threshold} 的概念。`,
          },
          {
            role: "user",
            content: `新概念: ${concept.title}\n描述: ${concept.description}\n\n现有概念:\n${existingConceptsText}`,
          },
        ],
        model,
        response_format: { type: "json_object" },
      });

      const rawContent = completion.choices[0].message.content || "";
      const parsed = parseAIResponse<{
        similarities: Array<{
          index: number;
          similarity: number;
          reason: string;
        }>;
      }>(rawContent, "Find Similar Concepts");

      return (parsed.similarities || [])
        .filter(
          (s) =>
            s.similarity >= threshold && s.index <= existingConcepts.length,
        )
        .map((s) => ({
          concept: existingConcepts[s.index - 1],
          similarity: s.similarity,
        }));
    } catch (error: unknown) {
      logger.error("Find Similar Concepts Error:", error);
      return [];
    }
  }

  private getMockExtraction(literature: LiteratureInfo): ExtractConceptsResult {
    return {
      concepts: [
        {
          title: "核心概念",
          description: "从文献中提取的核心概念描述，这是模拟数据。",
          type: "concept",
          source: literature,
          targetModule: "core_concepts",
        },
        {
          title: "研究方法",
          description: "文献中采用的主要研究方法，这是模拟数据。",
          type: "method",
          source: literature,
          targetModule: "research_methods",
        },
        {
          title: "应用技术",
          description: "文献中涉及的关键技术，这是模拟数据。",
          type: "technology",
          source: literature,
          targetModule: "application_domains",
        },
      ],
      relations: [
        {
          source: "研究方法",
          target: "核心概念",
          type: "related_to",
          confidence: 0.8,
        },
        {
          source: "应用技术",
          target: "核心概念",
          type: "depends_on",
          confidence: 0.7,
        },
      ],
    };
  }
}

export const conceptExtractorService = new ConceptExtractorService();

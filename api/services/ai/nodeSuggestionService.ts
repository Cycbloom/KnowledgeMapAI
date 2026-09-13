import { SupabaseClient } from "@supabase/supabase-js";
import { getAIProvider, getAIProviderForTask } from "./factory";
import type { AIProvider, AIProviderType, NodeSpecificity } from "@shared/types";
import { promptService } from "./promptService";
import { withAIMonitoring } from "./aiMonitor";
import { getMockResponse } from "./mock";
import {
  withTimeoutAndRetry,
  TimeoutError,
  RetryError,
  LONG_TIMEOUT,
} from "../../../shared/utils/retry";
import { AppError } from "../../middleware/errorHandler";
import { ErrorCodes } from "../../../shared/types/errorCodes";
import { logger } from "../../utils/logger";
import {
  formatGraphContextBlock,
  type GraphDisambiguationContext,
} from "../graph/graphDisambiguationContext";

export interface GeneratedChildNode {
  title: string;
  content?: string;
  summary?: string;
  level?: string;
  /** 特异性标注：specific=精确专名，generic=泛化名称（不参与知识点复用判定） */
  specificity?: NodeSpecificity;
}

export interface GeneratedSkeletonNode {
  title: string;
  content?: string;
  summary?: string;
  /** 特异性标注：specific=精确专名，generic=泛化名称（不参与知识点复用判定） */
  specificity?: NodeSpecificity;
}

export interface GenerateChildSuggestionsParams {
  nodeTitle: string;
  nodeContent?: string;
  nodeLevel?: string;
  existingChildren?: string[];
  existingNodes?: string[];
  customPrompt?: string;
  style?: "academic" | "practical" | "beginner" | "custom";
  minCount?: number;
  maxCount?: number;
  useLevelStrategy?: boolean;
  provider?: AIProvider;
  providerType?: AIProviderType;
  model?: string;
  language?: string;
  userId?: string;
  graphId?: string;
  sessionId?: string;
  allowMock?: boolean;
  /**
   * 消歧上下文（图谱元数据 + 祖先链 + 直接子节点），由调用方
   * 通过 buildGraphDisambiguationContext / buildGraphMetaContext 提供。
   * 有值时以代码级方式无条件追加到 system prompt，兼容任意模板。
   */
  disambiguation?: GraphDisambiguationContext;
}

export interface GenerateGraphSkeletonParams {
  topic: string;
  description?: string;
  style?: "academic" | "practical" | "beginner" | "custom";
  customPrompt?: string;
  sources?: string[];
  existingNodes?: string[];
  provider?: AIProvider;
  providerType?: AIProviderType;
  model?: string;
  language?: string;
  userId?: string;
  graphId?: string;
  sessionId?: string;
  /**
   * 消歧上下文（图谱元数据 + 祖先链 + 直接子节点），由调用方
   * 通过 buildGraphDisambiguationContext / buildGraphMetaContext 提供。
   * 有值时以代码级方式无条件追加到 system prompt，兼容任意模板。
   */
  disambiguation?: GraphDisambiguationContext;
}

const MAX_PARSE_RETRIES = 2;

async function resolveProvider(params: {
  provider?: AIProvider;
  providerType?: AIProviderType;
}): Promise<AIProvider> {
  if (params.provider) return params.provider;
  if (params.providerType) return getAIProvider(params.providerType);
  return getAIProviderForTask("text");
}

function mapAIError(error: unknown): never {
  if (error instanceof TimeoutError) {
    throw new AppError(ErrorCodes.AI_TIMEOUT);
  }
  if (error instanceof RetryError) {
    throw new AppError(ErrorCodes.AI_PROVIDER_ERROR, {
      message: `AI 请求失败，已重试 ${error.attempts} 次: ${error.lastError.message}`,
    });
  }
  throw error;
}

export async function generateChildSuggestions(
  supabase: SupabaseClient,
  params: GenerateChildSuggestionsParams,
): Promise<{ children: GeneratedChildNode[] }> {
  const {
    nodeTitle,
    nodeContent,
    nodeLevel,
    existingChildren,
    existingNodes,
    customPrompt,
    style = "academic",
    minCount = 3,
    maxCount = 5,
    useLevelStrategy = true,
    provider,
    providerType,
    model,
    language,
    userId,
    graphId,
    sessionId,
    allowMock = false,
    disambiguation,
  } = params;

  const resolvedProvider = await resolveProvider({ provider, providerType });

  if (!resolvedProvider.hasKey) {
    if (allowMock) {
      const mock = getMockResponse("expand", nodeTitle) as {
        suggestions: GeneratedChildNode[];
      };
      return { children: mock.suggestions || [] };
    }
    throw new AppError(ErrorCodes.AI_PROVIDER_NOT_CONFIGURED, {
      message: "AI provider not configured",
    });
  }

  const effectiveModel = model || resolvedProvider.model;
  const effectiveLevel = nodeLevel || "normal";
  const levelStrategyOn = Boolean(useLevelStrategy);
  const existingChildrenList = existingChildren ?? [];
  const existingNodesList = existingNodes ?? [];

  const templateContext: Record<string, unknown> = {
    nodeTitle,
    nodeContent: nodeContent || "",
    nodeLevel: effectiveLevel,
    minCount,
    maxCount,
    useLevelStrategy: levelStrategyOn,
    isRootOrCore: levelStrategyOn && ["root", "core"].includes(effectiveLevel),
    isLeaf: levelStrategyOn && effectiveLevel === "leaf",
    isCustom: style === "custom",
    customPrompt: style === "custom" ? customPrompt : undefined,
    isAcademic: style === "academic",
    isPractical: style === "practical",
    isBeginner: style === "beginner",
    hasExistingChildren: existingChildrenList.length > 0,
    existingChildren: existingChildrenList.join("、"),
    existingNodesInGraph:
      existingNodesList.length > 0
        ? existingNodesList.slice(0, 300).join(", ")
        : "",
  };

  const systemPrompt =
    (await promptService.getRenderedPrompt(
      supabase,
      "auto_graph_expand",
      templateContext,
      userId,
      graphId,
      language,
    )) + disambiguationBlock(disambiguation);

  let parsed: { children?: GeneratedChildNode[] | null } | null | undefined;

  const run = () =>
    withAIMonitoring(
      {
        operation: "auto_graph_expand",
        provider: resolvedProvider.providerType,
        model: effectiveModel,
        metadata: {
          graphId,
          userId,
          nodeTitle,
          nodeLevel: effectiveLevel,
        },
        sessionId,
      },
      async () => {
        const messages: Array<{
          role: "system" | "user" | "assistant";
          content: string;
        }> = [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `请为「${nodeTitle}」生成子节点。${
              existingChildrenList.length > 0
                ? `\n\n已有的子节点：${existingChildrenList.join(
                    "、",
                  )}\n请生成新的、不同的子节点。`
                : ""
            }

为每个子节点额外输出 "specificity" 字段，取值 "specific" 或 "generic"：
- "specific"：标题是精确专名/术语，在所有上下文都指向同一含义（如「TCP 三次握手」「React 虚拟 DOM」）；
- "generic"：标题是通用或结构性名称，在不同上下文含义可能不同（如「项目现状」「未来展望」「概述」「应用场景」「发展历程」）。
判断规则：仅当标题本身无歧义时标 "specific"；不确定时保守标 "generic"。`,
          },
        ];

        const callWithRetry = () =>
          withTimeoutAndRetry(
            () =>
              resolvedProvider.client.chat.completions.create({
                messages,
                model: effectiveModel,
                response_format: { type: "json_object" },
                max_tokens: 32000,
              }),
            {
              timeout: LONG_TIMEOUT,
              maxRetries: 3,
              onRetry: (attempt, error) => {
                logger.warn(
                  `auto_graph_expand retry attempt ${attempt}: ${error.message}`,
                );
              },
            },
          );

        let result = await callWithRetry();

        for (let attempt = 0; attempt < MAX_PARSE_RETRIES; attempt++) {
          const content = result.choices[0]?.message?.content || "";
          try {
            parsed = JSON.parse(content);
            break;
          } catch (_e) {
            logger.warn(
              `auto_graph_expand JSON 解析失败（第 ${attempt + 1} 次），尝试修复`,
              {
                finishReason: result.choices[0]?.finish_reason,
                contentSnippet: content.slice(-200),
              },
            );
            messages.push({ role: "assistant", content });
            messages.push({
              role: "user",
              content:
                "上一条模型输出的 JSON 被截断或语法错误无法解析。请仅输出一份完整、合法的 JSON，结构必须为 {\"children\":[{\"title\":\"...\",\"content\":\"...\",\"summary\":\"...\",\"specificity\":\"specific\"}]}，不要包含代码块标记或任何解释文字。",
            });
            result = await callWithRetry();
          }
        }

        return { result, usage: result.usage };
      },
    );

  let completion: Awaited<ReturnType<typeof run>>;
  try {
    completion = await run();
  } catch (error) {
    mapAIError(error);
  }

  if (!parsed) {
    const partial = completion.choices[0]?.message?.content;
    logger.error("JSON Parse Error in node expansion:", {
      finishReason: completion.choices[0]?.finish_reason,
      contentSnippet: partial?.slice(-200),
    });
    const error = new AppError(
      "AI 生成内容解析失败",
      422,
      ErrorCodes.SYSTEM_INTERNAL_ERROR,
    );
    error.addContext("contentSnippet", partial?.slice(-200) ?? "");
    throw error;
  }

  return { children: parsed.children || [] };
}

export async function generateGraphSkeleton(
  supabase: SupabaseClient,
  params: GenerateGraphSkeletonParams,
): Promise<{
  root: GeneratedSkeletonNode;
  coreNodes: GeneratedSkeletonNode[];
  description?: string;
}> {
  const {
    topic,
    description,
    style = "academic",
    customPrompt,
    sources,
    existingNodes,
    provider,
    providerType,
    model,
    language,
    userId,
    graphId,
    sessionId,
    disambiguation,
  } = params;

  const resolvedProvider = await resolveProvider({ provider, providerType });

  if (!resolvedProvider.hasKey) {
    throw new AppError(ErrorCodes.AI_PROVIDER_NOT_CONFIGURED, {
      message: "AI provider not configured",
    });
  }

  const effectiveModel = model || resolvedProvider.model;
  const sourcesText =
    sources && sources.length > 0 ? sources.join("\n\n---\n\n") : "";
  const existingNodesList = existingNodes ?? [];
  const hasExistingNodes = existingNodesList.length > 0;
  const existingNodesInGraph = hasExistingNodes
    ? existingNodesList.slice(0, 100).join("、")
    : "";

  const templateContext: Record<string, unknown> =
    style === "custom" && customPrompt
      ? {
          topic,
          isCustom: true,
          customPrompt,
          hasSources: Boolean(sourcesText),
          sources: sourcesText,
          isInit: true,
          hasExistingNodes,
          existingNodesInGraph,
        }
      : {
          topic,
          isAcademic: style === "academic",
          isPractical: style === "practical",
          hasSources: Boolean(sourcesText),
          sources: sourcesText,
          isInit: true,
          hasExistingNodes,
          existingNodesInGraph,
        };

  const systemPrompt =
    (await promptService.getRenderedPrompt(
      supabase,
      "auto_graph_init",
      templateContext,
      userId,
      graphId,
      language,
    )) + disambiguationBlock(disambiguation);

  const run = () =>
    withAIMonitoring(
      {
        operation: "auto_graph_init",
        provider: resolvedProvider.providerType,
        model: effectiveModel,
        metadata: {
          graphId,
          userId,
          topic,
          style,
        },
        sessionId,
      },
      async () => {
        const result = await withTimeoutAndRetry(
          () =>
            resolvedProvider.client.chat.completions.create({
              messages: [
                { role: "system", content: systemPrompt },
                {
                  role: "user",
                  content: `主题：${topic}${
                    description
                      ? `\n\n领域描述：${description}`
                      : ""
                  }${
                    sourcesText
                      ? `\n\n参考来源：\n${sourcesText}`
                      : ""
                  }

为 root 与每个 coreNodes 节点额外输出 "specificity" 字段，取值 "specific" 或 "generic"：
- "specific"：标题是精确专名/术语，无歧义（如「TCP 三次握手」）；
- "generic"：标题是通用或结构性名称，在不同上下文含义可能不同（如「项目现状」「未来展望」）。
判断规则：仅当标题本身无歧义时标 "specific"；不确定时保守标 "generic"。`,
                },
              ],
              model: effectiveModel,
              response_format: { type: "json_object" },
              max_tokens: 32000,
            }),
          {
            timeout: LONG_TIMEOUT,
            maxRetries: 3,
            onRetry: (attempt, error) => {
              logger.warn(
                `auto_graph_init retry attempt ${attempt}: ${error.message}`,
              );
            },
          },
        );
        return { result, usage: result.usage };
      },
    );

  let completion: Awaited<ReturnType<typeof run>>;
  try {
    completion = await run();
  } catch (error) {
    mapAIError(error);
  }

  const content = completion.choices[0].message.content;
  let parsed: {
    description?: string | null;
    root?: GeneratedSkeletonNode | null;
    coreNodes?: GeneratedSkeletonNode[] | null;
  };
  try {
    parsed = JSON.parse(content || '{"description": "", "root": null, "coreNodes": []}');
  } catch (_e) {
    logger.error("JSON Parse Error in graph skeleton generation:", {
      contentSnippet: content?.slice(-100),
    });
    throw new AppError(
      "AI 生成内容解析失败",
      422,
      ErrorCodes.SYSTEM_INTERNAL_ERROR,
    );
  }

  return {
    root:
      parsed.root || {
        title: topic,
        content: `${topic}的核心概念和知识体系`,
      },
    coreNodes: parsed.coreNodes || [],
    description:
      typeof parsed.description === "string" &&
      parsed.description.trim()
        ? parsed.description.trim()
        : undefined,
  };
}

/**
 * 将消歧上下文格式化为 system prompt 追加块。
 * 无上下文或全空时返回空串（零输出、无回归），保证代码级追加兼容任意模板。
 */
function disambiguationBlock(
  ctx: GraphDisambiguationContext | undefined,
): string {
  if (!ctx || !ctx.hasContext) return "";
  const block = formatGraphContextBlock(ctx);
  return block ? `\n\n${block}` : "";
}

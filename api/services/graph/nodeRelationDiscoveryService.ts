import { SupabaseClient } from "@supabase/supabase-js";
import { getAIProviderForTask } from "../ai/factory";
import { promptService } from "../ai/promptService";
import { withAIMonitoring } from "../ai/aiMonitor";
import {
  withTimeoutAndRetry,
  TimeoutError,
  RetryError,
  LONG_TIMEOUT,
} from "../../../shared/utils/retry";
import { getSupabaseAdmin } from "../../supabase";
import { logger } from "../../utils/logger";
import { AppError } from "../../middleware/errorHandler";
import { ErrorCodes } from "../../../shared/types/errorCodes";
import { edgeService } from "./edgeService";
import { graphQueryService } from "./graphQueryService";
import { notDeleted } from "../common/softDeleteHelper";
import {
  NON_HIERARCHICAL_RELATIONSHIP_TYPES,
  isNonHierarchicalRelationshipType,
  type NodeRelationSuggestion,
} from "../../../shared/types/graph-edge";

/**
 * 节点数超过该值时，不再把全部节点直接交给 AI，
 * 而是先用向量余弦相似度预筛候选节点对，控制 token 成本。
 */
const MAX_DIRECT_NODES = 40;

/** 大图预筛时最多提取的候选节点对数量 */
const MAX_CANDIDATE_PAIRS = 60;

/** AI 建议的可接受最低置信度 */
const MIN_CONFIDENCE = 0.6;

/** 单次发现最多返回的建议数 */
const DEFAULT_MAX_SUGGESTIONS = 10;

/** AI 返回内容为空或 JSON 无效时的最大解析重试次数 */
const MAX_PARSE_RETRIES = 2;

interface DiscoverNodeRelationsOptions {
  max_suggestions?: number;
  language?: string;
}

interface AIRelationSuggestion {
  source_id?: string;
  target_id?: string;
  relationship_type?: string;
  confidence?: number;
  reason?: string;
}

interface DiscoveredNode {
  id: string;
  title: string;
  content?: string;
  embedding?: number[];
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    return 0;
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * AI 关系发现服务：分析单个知识图谱内部节点之间的非层级关系。
 *
 * 核心约束：禁止生成层级（父子）关系（contains / parent_child / part_of /
 * derived_from），只允许 NON_HIERARCHICAL_RELATIONSHIP_TYPES 白名单内的
 * 依赖 / 语义 / 时序 / 交互 / 因果关系，避免破坏图谱树状结构。
 */
export class NodeRelationDiscoveryService {
  /**
   * 发现节点间的潜在非层级关系。
   * 返回建议列表，由前端展示供用户确认后调用 applyNodeRelations 批量建边。
   */
  async discoverNodeRelations(
    supabase: SupabaseClient,
    userId: string,
    graphId: string,
    options: DiscoverNodeRelationsOptions = {},
  ): Promise<NodeRelationSuggestion[]> {
    const maxSuggestions = options.max_suggestions || DEFAULT_MAX_SUGGESTIONS;

    // 校验图谱归属，防止越权访问
    const { data: graph, error: graphError } = await notDeleted(
      supabase
        .from("knowledge_graphs")
        .select("id, title, description")
        .eq("id", graphId)
        .eq("user_id", userId),
    ).maybeSingle();

    if (graphError || !graph) {
      throw new AppError(ErrorCodes.RESOURCE_GRAPH_NOT_FOUND);
    }

    const { nodes, edges } = await graphQueryService.getGraphNodes(
      supabase,
      userId,
      graphId,
      { includeEmbedding: true },
    );

    const discovered = (nodes || []) as DiscoveredNode[];
    if (discovered.length < 2) {
      return [];
    }

    // 已存在连线的节点对（双向），发现结果不得与其重复
    const connectedPairs = new Set<string>();
    for (const edge of edges || []) {
      const source = edge.source_knowledge_point_id;
      const target = edge.target_knowledge_point_id;
      connectedPairs.add(`${source}-${target}`);
      connectedPairs.add(`${target}-${source}`);
    }

    // 预筛候选节点对：小图直接全量交 AI；大图用向量相似度抽取最相关的候选对
    const candidatePairs = this.selectCandidatePairs(
      discovered,
      connectedPairs,
    );
    if (candidatePairs.length === 0) {
      return [];
    }

    const provider = await getAIProviderForTask("text");
    if (!provider.hasKey) {
      throw new AppError(ErrorCodes.AI_PROVIDER_NOT_CONFIGURED);
    }

    const nodesText = this.formatCandidateNodes(candidatePairs, discovered);

    const systemPrompt = await promptService.getRenderedPrompt(
      getSupabaseAdmin(),
      "node_relation_discovery",
      {
        graphTitle: graph.title || graphId,
        graphDescription: graph.description || "",
        nodes: nodesText,
        allowedTypes: NON_HIERARCHICAL_RELATIONSHIP_TYPES.join("、"),
        maxSuggestions,
      },
      userId,
      graphId,
      options.language,
    );

    const model = provider.model;

    // 多轮纠正式解析：模型偶发返回空内容或截断 JSON 时，
    // 把失败输出回填为 assistant 消息并追加纠正指令重试（与 auto_graph_expand 同模式）。
    const messages: Array<{
      role: "system" | "user" | "assistant";
      content: string;
    }> = [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: `请分析这些节点之间的关系，输出 JSON。`,
      },
    ];

    const callWithRetry = () =>
      withTimeoutAndRetry(
        () =>
          provider.client.chat.completions.create({
            messages,
            model,
            response_format: { type: "json_object" },
            max_tokens: 32000,
          }),
        {
          timeout: LONG_TIMEOUT,
          maxRetries: 2,
          onRetry: (attempt, error) => {
            logger.warn(
              `[node_relation_discovery] retry attempt ${attempt}: ${error.message}`,
            );
          },
        },
      );

    let parsed: { suggestions?: AIRelationSuggestion[] } | undefined;

    try {
      await withAIMonitoring(
        {
          operation: "node_relation_discovery",
          provider: provider.providerType,
          model,
          metadata: {
            graphId,
            nodeCount: discovered.length,
            userId,
          },
        },
        async () => {
          let completion = await callWithRetry();

          for (let attempt = 0; attempt < MAX_PARSE_RETRIES; attempt++) {
            const content = completion.choices[0]?.message?.content || "";
            try {
              parsed = JSON.parse(content) as {
                suggestions?: AIRelationSuggestion[];
              };
              break;
            } catch (_e) {
              logger.warn(
                `[node_relation_discovery] JSON 解析失败（第 ${attempt + 1} 次），尝试修复`,
                {
                  finishReason: completion.choices[0]?.finish_reason,
                  contentLength: content.length,
                },
              );
              messages.push({ role: "assistant", content });
              messages.push({
                role: "user",
                content:
                  "上一条模型输出为空或 JSON 无效。请仅输出一份完整、合法的 JSON，结构必须为 {\"suggestions\":[{\"source_id\":\"...\",\"target_id\":\"...\",\"relationship_type\":\"...\",\"confidence\":0.85,\"reason\":\"...\"}]}，不要包含代码块标记或任何解释文字。",
              });
              completion = await callWithRetry();
            }
          }

          return { result: parsed?.suggestions ?? [], usage: completion.usage };
        },
      );
    } catch (error: unknown) {
      const err = error as Error;
      logger.error("Node Relation Discovery Error:", error);
      if (err instanceof TimeoutError) {
        throw new AppError(ErrorCodes.AI_TIMEOUT);
      }
      if (err instanceof RetryError) {
        throw new AppError(ErrorCodes.AI_PROVIDER_ERROR, {
          message: `AI 请求失败，已重试 ${err.attempts} 次: ${err.lastError.message}`,
        });
      }
      throw new AppError(ErrorCodes.AI_PROVIDER_ERROR, {
        message: err.message || "节点关系发现失败",
      });
    }

    if (!parsed) {
      throw new AppError(ErrorCodes.AI_INVALID_RESPONSE, {
        message: "Empty AI response for Node Relation Discovery",
      });
    }

    return this.buildSuggestions(parsed.suggestions || [], discovered, connectedPairs, maxSuggestions);
  }

  /**
   * 批量应用 AI 关系发现建议，创建连线。
   * 逐条校验（节点归属 / 类型白名单 / 重复），跳过非法项并返回统计。
   */
  async applyNodeRelations(
    supabase: SupabaseClient,
    userId: string,
    graphId: string,
    suggestions: NodeRelationSuggestion[],
  ): Promise<{
    applied: number;
    skipped: Array<{ source_id: string; target_id: string; reason: string }>;
  }> {
    if (suggestions.length === 0) {
      return { applied: 0, skipped: [] };
    }

    const { data: graph, error: graphError } = await notDeleted(
      supabase
        .from("knowledge_graphs")
        .select("id")
        .eq("id", graphId)
        .eq("user_id", userId),
    ).maybeSingle();

    if (graphError || !graph) {
      throw new AppError(ErrorCodes.RESOURCE_GRAPH_NOT_FOUND);
    }

    const { nodes, edges } = await graphQueryService.getGraphNodes(
      supabase,
      userId,
      graphId,
    );

    // 已存在连线的节点对（双向），跳过
    const connectedPairs = new Set<string>();
    for (const edge of edges || []) {
      const source = edge.source_knowledge_point_id;
      const target = edge.target_knowledge_point_id;
      connectedPairs.add(`${source}-${target}`);
      connectedPairs.add(`${target}-${source}`);
    }

    const nodeIdSet = new Set<string>();
    for (const node of nodes || []) {
      if (node?.id) nodeIdSet.add(node.id);
    }
    const skipped: Array<{ source_id: string; target_id: string; reason: string }> = [];
    let applied = 0;

    for (const suggestion of suggestions) {
      const { source_id, target_id, relationship_type, confidence } =
        suggestion;

      if (
        !source_id ||
        !target_id ||
        source_id === target_id ||
        !nodeIdSet.has(source_id) ||
        !nodeIdSet.has(target_id)
      ) {
        skipped.push({
          source_id: source_id || "",
          target_id: target_id || "",
          reason: "节点不存在于当前图谱",
        });
        continue;
      }

      if (!isNonHierarchicalRelationshipType(relationship_type || "")) {
        skipped.push({
          source_id,
          target_id,
          reason: `关系类型 ${relationship_type || "未知"} 属于层级关系，已禁止`,
        });
        continue;
      }

      if (connectedPairs.has(`${source_id}-${target_id}`)) {
        skipped.push({
          source_id,
          target_id,
          reason: "节点对之间已存在连线",
        });
        continue;
      }

      try {
        await edgeService.create(supabase, {
          graph_id: graphId,
          source_knowledge_point_id: source_id,
          target_knowledge_point_id: target_id,
          relationship_type,
          weight: confidence,
        });
        applied += 1;
      } catch (err) {
        logger.warn(
          `[node_relation_discovery] create edge failed (${source_id} -> ${target_id}):`,
          err,
        );
        skipped.push({
          source_id,
          target_id,
          reason: err instanceof Error ? err.message : "创建连线失败",
        });
      }
    }

    return { applied, skipped };
  }

  /**
   * 预筛候选节点对：
   * - 节点数 <= MAX_DIRECT_NODES 时，直接使用全部节点（两两之间都可能建立关系）
   * - 否则按 embedding 余弦相似度抽取最相关的候选对，减少 AI token 消耗
   */
  private selectCandidatePairs(
    nodes: DiscoveredNode[],
    connectedPairs: Set<string>,
  ): Array<[string, string]> {
    if (nodes.length <= MAX_DIRECT_NODES) {
      return this.cartesianPairs(nodes, connectedPairs);
    }

    const scored: Array<{ pair: [string, string]; score: number }> = [];

    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i];
        const b = nodes[j];
        if (!a.embedding || !b.embedding) continue;
        if (connectedPairs.has(`${a.id}-${b.id}`)) continue;
        scored.push({
          pair: [a.id, b.id],
          score: cosineSimilarity(a.embedding, b.embedding),
        });
      }
    }

    scored.sort((x, y) => y.score - x.score);
    return scored.slice(0, MAX_CANDIDATE_PAIRS).map((item) => item.pair);
  }

  private cartesianPairs(
    nodes: DiscoveredNode[],
    connectedPairs: Set<string>,
  ): Array<[string, string]> {
    const pairs: Array<[string, string]> = [];
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i];
        const b = nodes[j];
        if (connectedPairs.has(`${a.id}-${b.id}`)) continue;
        pairs.push([a.id, b.id]);
      }
    }
    return pairs;
  }

  /**
   * 将候选节点对渲染为传给 AI 的节点列表文本。
   * 只包含候选对涉及的节点，避免大图全量输入。
   */
  private formatCandidateNodes(
    candidatePairs: Array<[string, string]>,
    allNodes: DiscoveredNode[],
  ): string {
    const nodeById = new Map(allNodes.map((n) => [n.id, n] as const));
    const selectedIds = new Set<string>();
    for (const [a, b] of candidatePairs) {
      selectedIds.add(a);
      selectedIds.add(b);
    }

    const lines: string[] = [];
    for (const id of selectedIds) {
      const node = nodeById.get(id);
      if (!node) continue;
      const originalContent = node.content || "";
      const content = originalContent.slice(0, 200);
      lines.push(
        `- ID: ${node.id}, Title: ${node.title}${
          content ? `, Content: ${content}${originalContent.length > 200 ? "..." : ""}` : ""
        }`,
      );
    }
    return lines.join("\n");
  }

  /**
   * 清洗 AI 返回的建议：
   * - 节点必须真实存在于图谱中
   * - 关系类型必须位于非层级白名单
   * - 节点对不能已有连线
   * - 置信度需达到阈值
   */
  private buildSuggestions(
    rawSuggestions: AIRelationSuggestion[],
    nodes: DiscoveredNode[],
    connectedPairs: Set<string>,
    maxSuggestions: number,
  ): NodeRelationSuggestion[] {
    const nodeById = new Map(nodes.map((n) => [n.id, n] as const));
    const seenPairs = new Set<string>();
    const result: NodeRelationSuggestion[] = [];

    for (const raw of rawSuggestions) {
      const sourceId = raw.source_id || "";
      const targetId = raw.target_id || "";
      const source = nodeById.get(sourceId);
      const target = nodeById.get(targetId);

      if (!source || !target || sourceId === targetId) continue;
      if (connectedPairs.has(`${sourceId}-${targetId}`)) continue;

      const relationshipType = raw.relationship_type || "";
      if (!isNonHierarchicalRelationshipType(relationshipType)) continue;

      const confidence = Math.min(1, Math.max(0, raw.confidence ?? 0));
      if (confidence < MIN_CONFIDENCE) continue;

      const pairKey = `${sourceId}-${targetId}`;
      if (seenPairs.has(pairKey)) continue;
      seenPairs.add(pairKey);

      result.push({
        source_id: sourceId,
        source_title: source.title,
        target_id: targetId,
        target_title: target.title,
        relationship_type: relationshipType,
        confidence,
        reason: raw.reason || "",
      });

      if (result.length >= maxSuggestions) break;
    }

    // 按置信度从高到低排序
    result.sort((a, b) => b.confidence - a.confidence);
    return result;
  }
}

export const nodeRelationDiscoveryService = new NodeRelationDiscoveryService();

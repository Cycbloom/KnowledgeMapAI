import { SupabaseClient } from "@supabase/supabase-js";
import { aiService } from "../ai/aiService";
import { logger } from "../../utils/logger";
import { cacheService, CacheKeys } from "../common/cacheService";
import { notDeleted } from '../common/softDeleteHelper';
import { conceptSimilarityService } from "./conceptSimilarityService";
import type {
  SimilarityResult,
  ConceptWithEmbedding,
} from "./conceptSimilarityService";
import { conceptEmbeddingService } from "./conceptEmbeddingService";
import type {
  NodeLevel,
  ConceptSource,
  KnowledgePoint,
} from "../../../shared/types/graph";

const SIMILARITY_THRESHOLD = parseFloat(
  process.env.CONCEPT_MERGE_THRESHOLD || "0.85",
);
const CORE_LEVEL_THRESHOLD = 2;
const ROOT_LEVEL_THRESHOLD = 5;

const HALF_WIDTH_MAP: Record<string, string> = {
  "！": "!",
  "＂": '"',
  "＃": "#",
  "＄": "$",
  "％": "%",
  "＆": "&",
  "＇": "'",
  "（": "(",
  "）": ")",
  "＊": "*",
  "＋": "+",
  "，": ",",
  "－": "-",
  "．": ".",
  "／": "/",
  "０": "0",
  "１": "1",
  "２": "2",
  "３": "3",
  "４": "4",
  "５": "5",
  "６": "6",
  "７": "7",
  "８": "8",
  "９": "9",
  "：": ":",
  "；": ";",
  "＜": "<",
  "＝": "=",
  "＞": ">",
  "？": "?",
  "＠": "@",
  "Ａ": "A",
  "Ｂ": "B",
  "Ｃ": "C",
  "Ｄ": "D",
  "Ｅ": "E",
  "Ｆ": "F",
  "Ｇ": "G",
  "Ｈ": "H",
  "Ｉ": "I",
  "Ｊ": "J",
  "Ｋ": "K",
  "Ｌ": "L",
  "Ｍ": "M",
  "Ｎ": "N",
  "Ｏ": "O",
  "Ｐ": "P",
  "Ｑ": "Q",
  "Ｒ": "R",
  "Ｓ": "S",
  "Ｔ": "T",
  "Ｕ": "U",
  "Ｖ": "V",
  "Ｗ": "W",
  "Ｘ": "X",
  "Ｙ": "Y",
  "Ｚ": "Z",
  "ａ": "a",
  "ｂ": "b",
  "ｃ": "c",
  "ｄ": "d",
  "ｅ": "e",
  "ｆ": "f",
  "ｇ": "g",
  "ｈ": "h",
  "ｉ": "i",
  "ｊ": "j",
  "ｋ": "k",
  "ｌ": "l",
  "ｍ": "m",
  "ｎ": "n",
  "ｏ": "o",
  "ｐ": "p",
  "ｑ": "q",
  "ｒ": "r",
  "ｓ": "s",
  "ｔ": "t",
  "ｕ": "u",
  "ｖ": "v",
  "ｗ": "w",
  "ｘ": "x",
  "ｙ": "y",
  "ｚ": "z",
  "［": "[",
  "］": "]",
  "｛": "{",
  "｝": "}",
  "＾": "^",
  "＿": "_",
  "｀": "`",
  "～": "~",
};

function fullWidthToHalfWidth(str: string): string {
  let result = "";
  for (const ch of str) {
    result += HALF_WIDTH_MAP[ch] || ch;
  }
  return result;
}

const PUNCTUATION_RE = /[\s.,;:!?。，、；：！？…—\-–·""''「」『』【】《》（）()\-_]+$/g;

export function normalizeTitle(title: string): string {
  let normalized = title.trim();
  normalized = normalized.normalize("NFC");
  normalized = fullWidthToHalfWidth(normalized);
  normalized = normalized.toLowerCase();
  normalized = normalized.replace(/\s+/g, " ");
  normalized = normalized.replace(PUNCTUATION_RE, "").trim();
  return normalized;
}

// Re-export types from sub-services for backward compatibility
export type { SimilarityResult, ConceptWithEmbedding };

export interface AggregationResult {
  mergedCount: number;
  upgradedNodes: Array<{
    knowledgePointId: string;
    title: string;
    oldLevel: NodeLevel;
    newLevel: NodeLevel;
    sourceCount: number;
  }>;
  mergedSources: Array<{
    targetId: string;
    sourceIds: string[];
    mergedSourceCount: number;
  }>;
}

export interface HierarchySuggestion {
  parentId: string;
  parentTitle: string;
  childId: string;
  childTitle: string;
  confidence: number;
}

export interface BatchMergeResult {
  mergedGroups: number;
  totalMergedCount: number;
  aliasesAdded: number;
  edgesUpdated: number;
  errors: Array<{
    targetId: string;
    sourceIds: string[];
    error: string;
  }>;
}

function determineNewLevel(
  currentLevel: NodeLevel | undefined,
  sourceCount: number,
): NodeLevel {
  const levelPriority: NodeLevel[] = ["root", "core", "sub", "normal", "leaf"];
  const currentIndex = currentLevel ? levelPriority.indexOf(currentLevel) : 3;

  let newLevelIndex = currentIndex;

  if (sourceCount >= ROOT_LEVEL_THRESHOLD) {
    newLevelIndex = 0;
  } else if (sourceCount >= CORE_LEVEL_THRESHOLD) {
    newLevelIndex = Math.min(currentIndex, 1);
  }

  return levelPriority[newLevelIndex];
}

function mergeSources(
  existingSources: ConceptSource[] | undefined,
  newSources: ConceptSource[],
): ConceptSource[] {
  const sourceMap = new Map<string, ConceptSource>();

  if (existingSources) {
    for (const source of existingSources) {
      const key = source.url || source.fileName || source.title;
      if (key) {
        sourceMap.set(key, source);
      }
    }
  }

  for (const source of newSources) {
    const key = source.url || source.fileName || source.title;
    if (key && !sourceMap.has(key)) {
      sourceMap.set(key, source);
    }
  }

  return Array.from(sourceMap.values());
}

export class ConceptAggregationService {
  // ── Delegated to conceptSimilarityService ──

  async calculateSimilarity(
    embedding1: number[],
    embedding2: number[],
  ): Promise<number> {
    return conceptSimilarityService.calculateSimilarity(embedding1, embedding2);
  }

  async findSimilarConcepts(
    supabase: SupabaseClient,
    knowledgePointId: string,
    options: {
      threshold?: number;
      limit?: number;
      excludeSameGraph?: boolean;
      graphId?: string;
    } = {},
  ): Promise<SimilarityResult[]> {
    return conceptSimilarityService.findSimilarConcepts(supabase, knowledgePointId, options);
  }

  async findSimilarConceptsByTitle(
    supabase: SupabaseClient,
    title: string,
    options: {
      threshold?: number;
      limit?: number;
    } = {},
  ): Promise<SimilarityResult[]> {
    return conceptSimilarityService.findSimilarConceptsByTitle(supabase, title, options);
  }

  async findSimilarByVector(
    supabase: SupabaseClient,
    knowledgePointId: string,
    options: {
      threshold?: number;
      limit?: number;
      graphId?: string;
    } = {},
    userId?: string,
  ): Promise<SimilarityResult[]> {
    return conceptSimilarityService.findSimilarByVector(supabase, knowledgePointId, options, userId);
  }

  async findCrossGraphSimilar(
    supabase: SupabaseClient,
    userId: string,
    graphId: string,
    conceptEmbeddings: Array<{ title: string; embedding: number[] }>,
    options: {
      threshold?: number;
      limit?: number;
    } = {},
  ): Promise<
    Record<
      string,
      Array<{
        kpId: string;
        kpTitle: string;
        graphTitle: string;
        graphId: string;
        similarity: number;
      }>
    >
  > {
    return conceptSimilarityService.findCrossGraphSimilar(supabase, userId, graphId, conceptEmbeddings, options);
  }

  async batchCalculateSimilarity(
    supabase: SupabaseClient,
    knowledgePointIds: string[],
  ): Promise<Map<string, SimilarityResult[]>> {
    return conceptSimilarityService.batchCalculateSimilarity(supabase, knowledgePointIds);
  }

  // ── Delegated to conceptEmbeddingService ──

  async generateEmbeddingForConcept(
    supabase: SupabaseClient,
    knowledgePointId: string,
  ): Promise<boolean> {
    return conceptEmbeddingService.generateEmbeddingForConcept(supabase, knowledgePointId);
  }

  async generateEmbeddingsBatch(
    supabase: SupabaseClient,
    knowledgePointIds: string[],
  ): Promise<{ processed: number; failed: number }> {
    return conceptEmbeddingService.generateEmbeddingsBatch(supabase, knowledgePointIds);
  }

  // ── Retained in conceptAggregationService ──

  async aggregateConcepts(
    supabase: SupabaseClient,
    graphId: string,
    options: {
      threshold?: number;
      dryRun?: boolean;
    } = {},
  ): Promise<AggregationResult> {
    const threshold = options.threshold ?? SIMILARITY_THRESHOLD;
    const dryRun = options.dryRun ?? false;

    const result: AggregationResult = {
      mergedCount: 0,
      upgradedNodes: [],
      mergedSources: [],
    };

    const { data: graphNodes, error: gnError } = await notDeleted(supabase
      .from("graph_nodes")
      .select(
        `
        id,
        knowledge_point_id,
        level,
        knowledge_points (
          id,
          title,
          content,
          embedding,
          properties
        )
      `,
      )
      .eq("graph_id", graphId)
      );

    if (gnError || !graphNodes) {
      logger.error("Failed to fetch graph nodes:", gnError);
      return result;
    }

    const nodesWithEmbedding: ConceptWithEmbedding[] = [];

    for (const gn of graphNodes) {
      const kp = gn.knowledge_points as unknown as KnowledgePoint & {
        embedding?: number[];
      };
      if (kp && kp.embedding) {
        const properties = kp.properties as
          | { sources?: ConceptSource[] }
          | undefined;
        nodesWithEmbedding.push({
          id: kp.id,
          title: kp.title,
          content: kp.content,
          embedding: kp.embedding,
          sources: properties?.sources,
          level: gn.level as NodeLevel,
        });
      }
    }

    logger.info(
      `Found ${nodesWithEmbedding.length} nodes with embeddings for aggregation`,
    );

    const processedIds = new Set<string>();
    const mergeGroups: Array<{
      primary: ConceptWithEmbedding;
      duplicates: ConceptWithEmbedding[];
    }> = [];

    for (let i = 0; i < nodesWithEmbedding.length; i++) {
      const node1 = nodesWithEmbedding[i];

      if (processedIds.has(node1.id)) {
        continue;
      }

      const duplicates: ConceptWithEmbedding[] = [];

      for (let j = i + 1; j < nodesWithEmbedding.length; j++) {
        const node2 = nodesWithEmbedding[j];

        if (processedIds.has(node2.id)) {
          continue;
        }

        const similarity = await conceptSimilarityService.calculateSimilarity(node1.embedding, node2.embedding);

        if (similarity >= threshold) {
          duplicates.push(node2);
          processedIds.add(node2.id);
        }
      }

      if (duplicates.length > 0) {
        processedIds.add(node1.id);
        mergeGroups.push({
          primary: node1,
          duplicates,
        });
      }
    }

    logger.info(`Found ${mergeGroups.length} merge groups`);

    for (const group of mergeGroups) {
      const allSources = mergeSources(
        group.primary.sources,
        group.duplicates.flatMap((d) => d.sources || []),
      );

      const totalSourceCount = allSources.length;
      const newLevel = determineNewLevel(group.primary.level, totalSourceCount);

      if (!dryRun) {
        const { error: updateError } = await supabase
          .from("knowledge_points")
          .update({
            properties: {
              sources: allSources,
              sourceCount: totalSourceCount,
            },
            level: newLevel,
          })
          .eq("id", group.primary.id);

        if (updateError) {
          logger.error(
            `Failed to update primary node ${group.primary.id}:`,
            updateError,
          );
          continue;
        }

        for (const duplicate of group.duplicates) {
          const { data: duplicateGraphNodes } = await notDeleted(supabase
            .from("graph_nodes")
            .select("id")
            .eq("knowledge_point_id", duplicate.id)
            .eq("graph_id", graphId)
            );

          if (duplicateGraphNodes && duplicateGraphNodes.length > 0) {
            const { error: edgeUpdateError } = await supabase
              .from("edges")
              .update({ target_knowledge_point_id: group.primary.id })
              .eq("target_knowledge_point_id", duplicate.id)
              .eq("graph_id", graphId);

            if (edgeUpdateError) {
              logger.error(
                `Failed to update edges for duplicate ${duplicate.id}:`,
                edgeUpdateError,
              );
            }

            const { error: sourceEdgeUpdateError } = await supabase
              .from("edges")
              .update({ source_knowledge_point_id: group.primary.id })
              .eq("source_knowledge_point_id", duplicate.id)
              .eq("graph_id", graphId);

            if (sourceEdgeUpdateError) {
              logger.error(
                `Failed to update source edges for duplicate ${duplicate.id}:`,
                sourceEdgeUpdateError,
              );
            }

            const { error: deleteNodeError } = await supabase
              .from("graph_nodes")
              .update({ deleted_at: new Date().toISOString() })
              .eq("id", duplicateGraphNodes[0].id);

            if (deleteNodeError) {
              logger.error(
                `Failed to soft delete duplicate graph node ${duplicateGraphNodes[0].id}:`,
                deleteNodeError,
              );
            }
          }
        }
      }

      result.mergedCount += group.duplicates.length;

      if (newLevel !== group.primary.level) {
        result.upgradedNodes.push({
          knowledgePointId: group.primary.id,
          title: group.primary.title,
          oldLevel: group.primary.level || "normal",
          newLevel,
          sourceCount: totalSourceCount,
        });
      }

      result.mergedSources.push({
        targetId: group.primary.id,
        sourceIds: group.duplicates.map((d) => d.id),
        mergedSourceCount: totalSourceCount,
      });
    }

    logger.info(
      `Aggregation complete: ${result.mergedCount} merged, ${result.upgradedNodes.length} upgraded`,
    );

    return result;
  }

  async upgradeNodeLevel(
    supabase: SupabaseClient,
    knowledgePointId: string,
    newSources: ConceptSource[],
  ): Promise<{
    success: boolean;
    oldLevel?: NodeLevel;
    newLevel?: NodeLevel;
    totalSourceCount?: number;
  }> {
    const { data: kp, error: kpError } = await supabase
      .from("knowledge_points")
      .select("id, properties, level")
      .eq("id", knowledgePointId)
      .single();

    if (kpError || !kp) {
      logger.error(`Knowledge point not found: ${knowledgePointId}`);
      return { success: false };
    }

    const properties =
      (kp.properties as { sources?: ConceptSource[]; sourceCount?: number }) ||
      {};
    const existingSources = properties.sources || [];

    const mergedSourcesList = mergeSources(existingSources, newSources);
    const totalSourceCount = mergedSourcesList.length;

    const oldLevel = (kp.level as NodeLevel) || "normal";
    const newLevel = determineNewLevel(oldLevel, totalSourceCount);

    const { error: updateError } = await supabase
      .from("knowledge_points")
      .update({
        properties: {
          ...properties,
          sources: mergedSourcesList,
          sourceCount: totalSourceCount,
        },
        level: newLevel,
      })
      .eq("id", knowledgePointId);

    if (updateError) {
      logger.error(
        `Failed to update knowledge point ${knowledgePointId}:`,
        updateError,
      );
      return { success: false };
    }

    logger.info(
      `Upgraded node ${knowledgePointId} from ${oldLevel} to ${newLevel} (${totalSourceCount} sources)`,
    );

    return {
      success: true,
      oldLevel,
      newLevel,
      totalSourceCount,
    };
  }

  async detectNewModuleNeeds(
    supabase: SupabaseClient,
    graphId: string,
    options: {
      threshold?: number;
    } = {},
  ): Promise<{
    unclassifiedCount: number;
    needsNewModule: boolean;
    suggestedModules?: Array<{
      title: string;
      description: string;
      reasoning: string;
    }>;
  }> {
    const threshold = options.threshold ?? 10;

    const { data: graphNodes, error: gnError } = await notDeleted(supabase
      .from("graph_nodes")
      .select(
        `
        knowledge_point_id,
        knowledge_points (
          id,
          title,
          properties
        )
      `,
      )
      .eq("graph_id", graphId)
      );

    if (gnError || !graphNodes) {
      logger.error(
        "Failed to fetch graph nodes for module detection:",
        gnError,
      );
      return { unclassifiedCount: 0, needsNewModule: false };
    }

    const unclassified: Array<{ id: string; title: string }> = [];

    for (const gn of graphNodes) {
      const kp = gn.knowledge_points as unknown as {
        id: string;
        title: string;
        properties?: { backboneModule?: string };
      };
      if (kp && !kp.properties?.backboneModule) {
        unclassified.push({ id: kp.id, title: kp.title });
      }
    }

    if (unclassified.length < threshold) {
      return {
        unclassifiedCount: unclassified.length,
        needsNewModule: false,
      };
    }

    const suggestedModules: Array<{
      title: string;
      description: string;
      reasoning: string;
    }> = [];

    if (unclassified.length >= threshold) {
      suggestedModules.push({
        title: "其他重要概念",
        description: `包含 ${unclassified.length} 个尚未分类的知识点，建议根据内容主题创建新的分类模块`,
        reasoning: `图谱中存在 ${unclassified.length} 个未归类到现有骨干模块的知识点，可能代表被忽略的研究领域`,
      });
    }

    return {
      unclassifiedCount: unclassified.length,
      needsNewModule: unclassified.length >= threshold,
      suggestedModules:
        suggestedModules.length > 0 ? suggestedModules : undefined,
    };
  }

  async detectModuleOverlap(
    supabase: SupabaseClient,
    graphId: string,
    options: {
      similarityThreshold?: number;
    } = {},
  ): Promise<{
    overlaps: Array<{
      module1: string;
      module2: string;
      similarity: number;
      suggestion: string;
    }>;
  }> {
    const threshold = options.similarityThreshold ?? 0.7;

    const { data: graphNodes, error: gnError } = await notDeleted(supabase
      .from("graph_nodes")
      .select(
        `
        knowledge_point_id,
        knowledge_points (
          id,
          title,
          content,
          properties,
          embedding
        )
      `,
      )
      .eq("graph_id", graphId)
      );

    if (gnError || !graphNodes) {
      logger.error("Failed to fetch nodes for overlap detection:", gnError);
      return { overlaps: [] };
    }

    const moduleNodes = new Map<
      string,
      Array<{ id: string; title: string; embedding: number[] }>
    >();

    for (const gn of graphNodes) {
      const kp = gn.knowledge_points as unknown as {
        id: string;
        title: string;
        content?: string;
        properties?: { backboneModule?: string };
        embedding?: number[];
      };
      if (!kp) continue;

      const module = kp.properties?.backboneModule;
      if (!module) continue;

      if (!moduleNodes.has(module)) {
        moduleNodes.set(module, []);
      }
      if (kp.embedding) {
        moduleNodes.get(module)!.push({
          id: kp.id,
          title: kp.title,
          embedding: kp.embedding,
        });
      }
    }

    const modules = Array.from(moduleNodes.entries());
    const overlaps: Array<{
      module1: string;
      module2: string;
      similarity: number;
      suggestion: string;
    }> = [];

    for (let i = 0; i < modules.length; i++) {
      for (let j = i + 1; j < modules.length; j++) {
        const [mod1, nodes1] = modules[i];
        const [mod2, nodes2] = modules[j];

        if (nodes1.length === 0 || nodes2.length === 0) continue;

        let totalSimilarity = 0;
        let pairCount = 0;

        for (const node1 of nodes1) {
          for (const node2 of nodes2) {
            const similarity = await conceptSimilarityService.calculateSimilarity(
              node1.embedding,
              node2.embedding,
            );
            totalSimilarity += similarity;
            pairCount++;
          }
        }

        const avgSimilarity = pairCount > 0 ? totalSimilarity / pairCount : 0;

        if (avgSimilarity >= threshold) {
          overlaps.push({
            module1: mod1,
            module2: mod2,
            similarity: Math.round(avgSimilarity * 100) / 100,
            suggestion: `模块 "${mod1}" 和 "${mod2}" 的内容高度重叠（相似度 ${Math.round(avgSimilarity * 100)}%），建议考虑合并或重新划分`,
          });
        }
      }
    }

    return { overlaps };
  }

  async identifyHierarchy(
    _supabase: SupabaseClient,
    graphId: string,
    concepts: Array<{ id: string; title: string }>,
  ): Promise<HierarchySuggestion[]> {
    if (concepts.length < 2) {
      logger.info("Insufficient concepts for hierarchy identification");
      return [];
    }

    logger.info(
      `Starting hierarchy identification for graph ${graphId} with ${concepts.length} concepts`,
    );

    try {
      const conceptList = concepts
        .map((c) => `- ${c.id}: ${c.title}`)
        .join("\n");

      const prompt = `分析以下概念之间的 is-a（属于/包含）层级关系。

概念列表：
${conceptList}

请识别哪些概念可能是其他概念的父级（更抽象的概念）或子级（更具体的概念）。
只返回明确的层级关系，置信度低于 0.5 的不要返回。

请以 JSON 数组格式返回，每个元素包含：
- parentId: 父概念ID
- parentTitle: 父概念标题
- childId: 子概念ID
- childTitle: 子概念标题
- confidence: 置信度 (0-1)

只返回 JSON 数组，不要其他内容。`;

      const response = await aiService.chat(
        [
          {
            role: "user",
            content: prompt,
          },
        ],
        { operation: "identify_hierarchy" },
      );

      if (!response) {
        logger.warn("AI service returned empty response for hierarchy identification");
        return [];
      }

      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        logger.warn("Failed to parse hierarchy suggestions from AI response");
        return [];
      }

      const suggestions: HierarchySuggestion[] = JSON.parse(jsonMatch[0]);

      const validSuggestions = suggestions.filter(
        (s) =>
          s.parentId &&
          s.childId &&
          s.confidence >= 0.5 &&
          s.parentId !== s.childId,
      );

      logger.info(
        `Identified ${validSuggestions.length} hierarchy suggestions`,
      );

      return validSuggestions;
    } catch (error) {
      logger.error("Error in hierarchy identification:", error);
      return [];
    }
  }

  async batchMerge(
    supabase: SupabaseClient,
    graphId: string,
    mergeGroups: Array<{
      targetId: string;
      sourceIds: string[];
    }>,
    userId?: string,
  ): Promise<BatchMergeResult> {
    const result: BatchMergeResult = {
      mergedGroups: 0,
      totalMergedCount: 0,
      aliasesAdded: 0,
      edgesUpdated: 0,
      errors: [],
    };

    if (mergeGroups.length === 0) {
      logger.info("No merge groups provided");
      return result;
    }

    logger.info(
      `Starting batch merge for graph ${graphId} with ${mergeGroups.length} groups`,
    );

    for (const group of mergeGroups) {
      try {
        const { data: targetKp, error: targetError } = await supabase
          .from("knowledge_points")
          .select("id, title, properties")
          .eq("id", group.targetId)
          .single();

        if (targetError || !targetKp) {
          result.errors.push({
            targetId: group.targetId,
            sourceIds: group.sourceIds,
            error: `Target knowledge point not found: ${group.targetId}`,
          });
          continue;
        }

        const targetProperties =
          (targetKp.properties as { aliases?: string[] }) || {};
        const existingAliases: string[] = targetProperties.aliases || [];

        const newAliases: string[] = [];

        const { data: sourceKps, error: sourcesError } = await supabase
          .from("knowledge_points")
          .select("id, title")
          .in("id", group.sourceIds);

        if (sourcesError || !sourceKps) {
          result.errors.push({
            targetId: group.targetId,
            sourceIds: group.sourceIds,
            error: `Failed to fetch source knowledge points`,
          });
          continue;
        }

        for (const sourceKp of sourceKps) {
          const normalizedTitle = normalizeTitle(sourceKp.title);
          const aliasExists = existingAliases.some(
            (a) => normalizeTitle(a) === normalizedTitle,
          );

          if (!aliasExists && normalizedTitle !== normalizeTitle(targetKp.title)) {
            newAliases.push(sourceKp.title);
          }
        }

        if (newAliases.length > 0) {
          const updatedAliases = [...existingAliases, ...newAliases];
          const { error: aliasUpdateError } = await supabase
            .from("knowledge_points")
            .update({
              properties: {
                ...targetProperties,
                aliases: updatedAliases,
              },
            })
            .eq("id", group.targetId);

          if (aliasUpdateError) {
            logger.error(
              `Failed to update aliases for ${group.targetId}:`,
              aliasUpdateError,
            );
            result.errors.push({
              targetId: group.targetId,
              sourceIds: group.sourceIds,
              error: `Failed to update aliases: ${aliasUpdateError.message}`,
            });
            continue;
          }

          result.aliasesAdded += newAliases.length;
        }

        let edgesUpdatedInGroup = 0;

        for (const sourceId of group.sourceIds) {
          const { error: targetEdgeError } = await supabase
            .from("edges")
            .update({ target_knowledge_point_id: group.targetId })
            .eq("target_knowledge_point_id", sourceId)
            .eq("graph_id", graphId);

          if (targetEdgeError) {
            logger.error(
              `Failed to update target edges for ${sourceId}:`,
              targetEdgeError,
            );
          } else {
            edgesUpdatedInGroup++;
          }

          const { error: sourceEdgeError } = await supabase
            .from("edges")
            .update({ source_knowledge_point_id: group.targetId })
            .eq("source_knowledge_point_id", sourceId)
            .eq("graph_id", graphId);

          if (sourceEdgeError) {
            logger.error(
              `Failed to update source edges for ${sourceId}:`,
              sourceEdgeError,
            );
          } else {
            edgesUpdatedInGroup++;
          }

          const { data: sourceGraphNodes } = await notDeleted(supabase
            .from("graph_nodes")
            .select("id")
            .eq("knowledge_point_id", sourceId)
            .eq("graph_id", graphId)
            );

          if (sourceGraphNodes && sourceGraphNodes.length > 0) {
            const { error: deleteNodeError } = await supabase
              .from("graph_nodes")
              .update({ deleted_at: new Date().toISOString() })
              .eq("id", sourceGraphNodes[0].id);

            if (deleteNodeError) {
              logger.error(
                `Failed to soft delete graph node ${sourceGraphNodes[0].id}:`,
                deleteNodeError,
              );
            }
          }
        }

        result.edgesUpdated += edgesUpdatedInGroup;
        result.totalMergedCount += group.sourceIds.length;
        result.mergedGroups++;

        logger.info(
          `Merged group: target=${group.targetId}, sources=[${group.sourceIds.join(", ")}], aliases=${newAliases.length}, edges=${edgesUpdatedInGroup}`,
        );
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error(`Error merging group for target ${group.targetId}:`, error);
        result.errors.push({
          targetId: group.targetId,
          sourceIds: group.sourceIds,
          error: errorMessage,
        });
      }
    }

    logger.info(
      `Batch merge complete: ${result.mergedGroups} groups, ${result.totalMergedCount} merged, ${result.aliasesAdded} aliases, ${result.edgesUpdated} edges, ${result.errors.length} errors`,
    );

    if (userId) {
      await cacheService.del(CacheKeys.GRAPH_NODES(userId, graphId));
      await cacheService.del(CacheKeys.GRAPH_NODES("public", graphId));
    }

    return result;
  }

  async addAliases(
    supabase: SupabaseClient,
    knowledgePointId: string,
    aliases: string[],
  ): Promise<void> {
    if (aliases.length === 0) {
      logger.info("No aliases to add");
      return;
    }

    const { data: kp, error: fetchError } = await supabase
      .from("knowledge_points")
      .select("id, title, properties")
      .eq("id", knowledgePointId)
      .single();

    if (fetchError || !kp) {
      logger.error(`Knowledge point not found: ${knowledgePointId}`);
      throw new Error(`Knowledge point not found: ${knowledgePointId}`);
    }

    const properties =
      (kp.properties as { aliases?: string[] }) || {};
    const existingAliases: string[] = properties.aliases || [];
    const normalizedTitle = normalizeTitle(kp.title);

    const uniqueNewAliases = aliases.filter((alias) => {
      const normalizedAlias = normalizeTitle(alias);
      const isDuplicate = existingAliases.some(
        (a) => normalizeTitle(a) === normalizedAlias,
      );
      const isSameAsTitle = normalizedAlias === normalizedTitle;
      return !isDuplicate && !isSameAsTitle && alias.trim().length > 0;
    });

    if (uniqueNewAliases.length === 0) {
      logger.info(`No new unique aliases to add for ${knowledgePointId}`);
      return;
    }

    const updatedAliases = [...existingAliases, ...uniqueNewAliases];

    const { error: updateError } = await supabase
      .from("knowledge_points")
      .update({
        properties: {
          ...properties,
          aliases: updatedAliases,
        },
      })
      .eq("id", knowledgePointId);

    if (updateError) {
      logger.error(
        `Failed to add aliases for ${knowledgePointId}:`,
        updateError,
      );
      throw new Error(`Failed to add aliases: ${updateError.message}`);
    }

    logger.info(
      `Added ${uniqueNewAliases.length} aliases to ${knowledgePointId}: [${uniqueNewAliases.join(", ")}]`,
    );
  }

  async updateNodeParent(
    supabase: SupabaseClient,
    graphId: string,
    childKnowledgePointId: string,
    parentKnowledgePointId: string,
  ): Promise<{ success: boolean; error?: string }> {
    const { error } = await notDeleted(supabase
      .from("graph_nodes")
      .update({ parent_id: parentKnowledgePointId })
      .eq("knowledge_point_id", childKnowledgePointId)
      .eq("graph_id", graphId)
      );

    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true };
  }

  async removeAlias(
    supabase: SupabaseClient,
    knowledgePointId: string,
    alias: string,
  ): Promise<void> {
    const { data: kp, error: fetchError } = await supabase
      .from("knowledge_points")
      .select("id, properties")
      .eq("id", knowledgePointId)
      .single();

    if (fetchError || !kp) {
      logger.error(`Knowledge point not found: ${knowledgePointId}`);
      throw new Error(`Knowledge point not found: ${knowledgePointId}`);
    }

    const properties =
      (kp.properties as { aliases?: string[] }) || {};
    const existingAliases: string[] = properties.aliases || [];

    const normalizedTarget = normalizeTitle(alias);
    const filteredAliases = existingAliases.filter(
      (a) => normalizeTitle(a) !== normalizedTarget,
    );

    if (filteredAliases.length === existingAliases.length) {
      logger.info(`Alias "${alias}" not found in ${knowledgePointId}`);
      return;
    }

    const { error: updateError } = await supabase
      .from("knowledge_points")
      .update({
        properties: {
          ...properties,
          aliases: filteredAliases,
        },
      })
      .eq("id", knowledgePointId);

    if (updateError) {
      logger.error(
        `Failed to remove alias from ${knowledgePointId}:`,
        updateError,
      );
      throw new Error(`Failed to remove alias: ${updateError.message}`);
    }

    logger.info(`Removed alias "${alias}" from ${knowledgePointId}`);
  }

  async batchUpdateHierarchy(
    supabase: SupabaseClient,
    graphId: string,
    userId: string,
    relations: Array<{ parentId: string; childId: string }>,
  ): Promise<{
    appliedCount: number;
    failedCount: number;
    errors?: Array<{ parentId: string; childId: string; error: string }>;
  }> {
    let appliedCount = 0;
    const errors: Array<{
      parentId: string;
      childId: string;
      error: string;
    }> = [];

    for (const relation of relations) {
      try {
        const result = await this.updateNodeParent(
          supabase,
          graphId,
          relation.childId,
          relation.parentId,
        );

        if (!result.success) {
          errors.push({
            parentId: relation.parentId,
            childId: relation.childId,
            error: result.error || "Unknown error",
          });
          logger.warn("Failed to apply hierarchy relation", {
            parentId: relation.parentId,
            childId: relation.childId,
            error: result.error,
          });
        } else {
          appliedCount++;
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        errors.push({
          parentId: relation.parentId,
          childId: relation.childId,
          error: errorMessage,
        });
      }
    }

    await cacheService.del(CacheKeys.GRAPH_NODES(userId, graphId));
    await cacheService.del(CacheKeys.GRAPH_NODES("public", graphId));

    logger.info("Hierarchy relations applied", {
      graphId,
      appliedCount,
      failedCount: errors.length,
      userId,
    });

    if (errors.length > 0) {
      logger.warn("Some hierarchy relations failed to apply", {
        errors,
      });
    }

    return {
      appliedCount,
      failedCount: errors.length,
      errors: errors.length > 0 ? errors : undefined,
    };
  }
}

export const conceptAggregationService = new ConceptAggregationService();

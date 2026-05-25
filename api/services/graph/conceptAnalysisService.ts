import { SupabaseClient } from "@supabase/supabase-js";
import {
  conceptAggregationService,
  type ConceptWithEmbedding,
} from "./conceptAggregationService";
import { hierarchyRecognitionService } from "../ai/hierarchyRecognitionService";
import { cacheService, CacheKeys } from "../common/cacheService";
import { logger } from "../../utils/logger";
import type {
  NodeLevel,
  ConceptSource,
} from "../../../shared/types/graph";

const DEFAULT_SIMILARITY_THRESHOLD = 0.85;
const DEFAULT_HIERARCHY_THRESHOLD = 0.7;
const DEFAULT_BATCH_SIZE = 50;
const CACHE_TTL = 3600;

export interface SimilarConceptGroup {
  id: string;
  members: Array<{
    knowledgePointId: string;
    title: string;
    similarity?: number;
    sources: ConceptSource[];
    level: NodeLevel;
  }>;
  suggestedTargetId: string;
  suggestedAliases: string[];
  autoMergeConfidence: number;
}

export interface AliasSuggestion {
  knowledgePointId: string;
  title: string;
  suggestedAlias: string;
  confidence: number;
  sourceGroupId: string;
}

export interface HierarchyAnalysisSuggestion {
  parentId: string;
  parentTitle: string;
  childId: string;
  childTitle: string;
  confidence: number;
}

export interface AnalysisOptions {
  graphId: string;
  similarityThreshold?: number;
  hierarchyThreshold?: number;
  batchSize?: number;
  onProgress?: (progress: AnalysisProgress) => void;
}

export interface AnalysisProgress {
  stage: "fetching" | "similarity" | "hierarchy" | "complete";
  current: number;
  total: number;
  message: string;
}

export interface AnalysisResult {
  jobId: string;
  graphId: string;
  status: "pending" | "running" | "completed" | "failed";
  similarGroups: SimilarConceptGroup[];
  hierarchySuggestions: HierarchyAnalysisSuggestion[];
  aliasSuggestions: AliasSuggestion[];
  summary: {
    totalConcepts: number;
    groupsFound: number;
    potentialMerges: number;
    hierarchySuggestionsCount: number;
  };
  startedAt: string;
  completedAt?: string;
  error?: string;
}

interface AnalysisCacheData {
  result: AnalysisResult;
  timestamp: number;
}

export class ConceptAnalysisService {
  async analyzeConcepts(
    supabase: SupabaseClient,
    options: AnalysisOptions,
  ): Promise<AnalysisResult> {
    const jobId = crypto.randomUUID();
    const startedAt = new Date().toISOString();

    const similarityThreshold =
      options.similarityThreshold ?? DEFAULT_SIMILARITY_THRESHOLD;
    const hierarchyThreshold =
      options.hierarchyThreshold ?? DEFAULT_HIERARCHY_THRESHOLD;
    const batchSize = options.batchSize ?? DEFAULT_BATCH_SIZE;

    const reportProgress = (
      stage: AnalysisProgress["stage"],
      current: number,
      total: number,
      message: string,
    ) => {
      if (options.onProgress) {
        options.onProgress({ stage, current, total, message });
      }
    };

    const baseResult: Omit<AnalysisResult, "status" | "completedAt"> = {
      jobId,
      graphId: options.graphId,
      similarGroups: [],
      hierarchySuggestions: [],
      aliasSuggestions: [],
      summary: {
        totalConcepts: 0,
        groupsFound: 0,
        potentialMerges: 0,
        hierarchySuggestionsCount: 0,
      },
      startedAt,
    };

    try {
      reportProgress("fetching", 0, 1, "正在获取图谱概念数据...");

      const concepts = await this.fetchGraphConcepts(supabase, options.graphId);

      if (concepts.length === 0) {
        logger.warn(`No concepts found for graph ${options.graphId}`);
        return {
          ...baseResult,
          status: "completed",
          completedAt: new Date().toISOString(),
          summary: {
            ...baseResult.summary,
            totalConcepts: 0,
          },
        };
      }

      reportProgress("fetching", 1, 1, `获取到 ${concepts.length} 个概念`);

      let similarGroups: SimilarConceptGroup[] = [];
      let hierarchySuggestions: HierarchyAnalysisSuggestion[] = [];
      let aliasSuggestions: AliasSuggestion[] = [];

      try {
        reportProgress(
          "similarity",
          0,
          concepts.length,
          "正在计算概念相似度...",
        );

        similarGroups = await this.calculateSimilarityGroups(
          supabase,
          concepts,
          similarityThreshold,
          batchSize,
          (current, total, message) => {
            reportProgress("similarity", current, total, message);
          },
        );

        logger.info(`Found ${similarGroups.length} similar concept groups`);
      } catch (error) {
        logger.error("Similarity calculation failed:", error);
      }

      try {
        reportProgress(
          "hierarchy",
          0,
          1,
          "正在识别层级关系...",
        );

        hierarchySuggestions = await this.analyzeHierarchyRelations(
          supabase,
          concepts,
          hierarchyThreshold,
        );

        logger.info(
          `Found ${hierarchySuggestions.length} hierarchy suggestions`,
        );
      } catch (error) {
        logger.error("Hierarchy analysis failed:", error);
      }

      try {
        aliasSuggestions = this.generateAliasSuggestions(similarGroups);
        logger.info(`Generated ${aliasSuggestions.length} alias suggestions`);
      } catch (error) {
        logger.error("Alias suggestion generation failed:", error);
      }

      const potentialMerges = similarGroups.reduce(
        (sum, group) => sum + group.members.length - 1,
        0,
      );

      const result: AnalysisResult = {
        ...baseResult,
        status: "completed",
        completedAt: new Date().toISOString(),
        similarGroups,
        hierarchySuggestions,
        aliasSuggestions,
        summary: {
          totalConcepts: concepts.length,
          groupsFound: similarGroups.length,
          potentialMerges,
          hierarchySuggestionsCount: hierarchySuggestions.length,
        },
      };

      await this.cacheAnalysisResult(result);

      reportProgress("complete", 1, 1, "分析完成");

      return result;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error("Concept analysis failed:", error);

      const failedResult: AnalysisResult = {
        ...baseResult,
        status: "failed",
        completedAt: new Date().toISOString(),
        error: errorMessage,
      };

      return failedResult;
    }
  }

  private async fetchGraphConcepts(
    supabase: SupabaseClient,
    graphId: string,
  ): Promise<ConceptWithEmbedding[]> {
    const { data: graphNodes, error: gnError } = await supabase
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
      .is("deleted_at", null);

    if (gnError || !graphNodes) {
      logger.error("Failed to fetch graph nodes:", gnError);
      return [];
    }

    const concepts: ConceptWithEmbedding[] = [];

    for (const gn of graphNodes) {
      const kp = gn.knowledge_points as unknown as {
        id: string;
        title: string;
        content?: string;
        embedding?: number[];
        properties?: { sources?: ConceptSource[] };
      };

      if (kp && kp.embedding) {
        concepts.push({
          id: kp.id,
          title: kp.title,
          content: kp.content,
          embedding: kp.embedding,
          sources: kp.properties?.sources,
          level: gn.level as NodeLevel,
        });
      }
    }

    logger.info(`Fetched ${concepts.length} concepts with embeddings for graph ${graphId}`);
    return concepts;
  }

  private async calculateSimilarityGroups(
    _supabase: SupabaseClient,
    concepts: ConceptWithEmbedding[],
    threshold: number,
    batchSize: number,
    onBatchProgress?: (current: number, total: number, message: string) => void,
  ): Promise<SimilarConceptGroup[]> {
    if (concepts.length < 2) {
      return [];
    }

    const processedPairs = new Set<string>();
    const adjacencyList = new Map<string, Array<{
      id: string;
      title: string;
      similarity: number;
      sources: ConceptSource[];
      level: NodeLevel;
    }>>();

    const totalPairs = (concepts.length * (concepts.length - 1)) / 2;
    let processedCount = 0;

    if (concepts.length > batchSize) {
      for (let i = 0; i < concepts.length; i += batchSize) {
        const batchEnd = Math.min(i + batchSize, concepts.length);
        const batch1 = concepts.slice(i, batchEnd);

        for (let j = i; j < concepts.length; j += batchSize) {
          const batch2Start = j === i ? batchEnd : j;
          const batch2End = Math.min(batch2Start + batchSize, concepts.length);
          const batch2 = concepts.slice(batch2Start, batch2End);

          await this.processBatchPairwise(
            batch1,
            batch2,
            threshold,
            processedPairs,
            adjacencyList,
          );

          processedCount += batch1.length * batch2.length;

          if (onBatchProgress) {
            onBatchProgress(
              processedCount,
              totalPairs,
              `已处理 ${processedCount}/${totalPairs} 对概念...`,
            );
          }
        }
      }
    } else {
      await this.processAllPairs(concepts, threshold, processedPairs, adjacencyList);
      processedCount = totalPairs;

      if (onBatchProgress) {
        onBatchProgress(processedCount, totalPairs, "相似度计算完成");
      }
    }

    return this.buildSimilarGroups(adjacencyList, concepts);
  }

  private async processBatchPairwise(
    batch1: ConceptWithEmbedding[],
    batch2: ConceptWithEmbedding[],
    threshold: number,
    processedPairs: Set<string>,
    adjacencyList: Map<string, Array<{
      id: string;
      title: string;
      similarity: number;
      sources: ConceptSource[];
      level: NodeLevel;
    }>>,
  ): Promise<void> {
    for (const node1 of batch1) {
      for (const node2 of batch2) {
        if (node1.id === node2.id) continue;

        const pairKey = [node1.id, node2.id].sort().join("-");
        if (processedPairs.has(pairKey)) continue;
        processedPairs.add(pairKey);

        const similarity = await conceptAggregationService.calculateSimilarity(
          node1.embedding,
          node2.embedding,
        );

        if (similarity >= threshold) {
          if (!adjacencyList.has(node1.id)) {
            adjacencyList.set(node1.id, []);
          }
          if (!adjacencyList.has(node2.id)) {
            adjacencyList.set(node2.id, []);
          }

          adjacencyList.get(node1.id)!.push({
            id: node2.id,
            title: node2.title,
            similarity,
            sources: node2.sources || [],
            level: node2.level || "normal",
          });

          adjacencyList.get(node2.id)!.push({
            id: node1.id,
            title: node1.title,
            similarity,
            sources: node1.sources || [],
            level: node1.level || "normal",
          });
        }
      }
    }
  }

  private async processAllPairs(
    concepts: ConceptWithEmbedding[],
    threshold: number,
    processedPairs: Set<string>,
    adjacencyList: Map<string, Array<{
      id: string;
      title: string;
      similarity: number;
      sources: ConceptSource[];
      level: NodeLevel;
    }>>,
  ): Promise<void> {
    for (let i = 0; i < concepts.length; i++) {
      for (let j = i + 1; j < concepts.length; j++) {
        const node1 = concepts[i];
        const node2 = concepts[j];

        const pairKey = [node1.id, node2.id].sort().join("-");
        processedPairs.add(pairKey);

        const similarity = await conceptAggregationService.calculateSimilarity(
          node1.embedding,
          node2.embedding,
        );

        if (similarity >= threshold) {
          if (!adjacencyList.has(node1.id)) {
            adjacencyList.set(node1.id, []);
          }
          if (!adjacencyList.has(node2.id)) {
            adjacencyList.set(node2.id, []);
          }

          adjacencyList.get(node1.id)!.push({
            id: node2.id,
            title: node2.title,
            similarity,
            sources: node2.sources || [],
            level: node2.level || "normal",
          });

          adjacencyList.get(node2.id)!.push({
            id: node1.id,
            title: node1.title,
            similarity,
            sources: node1.sources || [],
            level: node1.level || "normal",
          });
        }
      }
    }
  }

  private buildSimilarGroups(
    adjacencyList: Map<string, Array<{
      id: string;
      title: string;
      similarity: number;
      sources: ConceptSource[];
      level: NodeLevel;
    }>>,
    allConcepts: ConceptWithEmbedding[],
  ): SimilarConceptGroup[] {
    const visited = new Set<string>();
    const groups: SimilarConceptGroup[] = [];

    for (const [nodeId, neighbors] of adjacencyList) {
      if (visited.has(nodeId)) continue;

      const groupMembers = new Set<string>([nodeId]);
      const queue = [...neighbors.map((n) => n.id)];

      while (queue.length > 0) {
        const currentId = queue.shift()!;
        if (groupMembers.has(currentId)) continue;

        groupMembers.add(currentId);
        visited.add(currentId);

        const currentNeighbors = adjacencyList.get(currentId);
        if (currentNeighbors) {
          for (const neighbor of currentNeighbors) {
            if (!groupMembers.has(neighbor.id)) {
              queue.push(neighbor.id);
            }
          }
        }
      }

      if (groupMembers.size < 2) continue;

      const memberDetails = Array.from(groupMembers).map((id) => {
        const concept = allConcepts.find((c) => c.id === id);
        const neighbors = adjacencyList.get(id) || [];
        const maxSimilarity = neighbors.length > 0
          ? Math.max(...neighbors.map((n) => n.similarity))
          : undefined;

        return {
          knowledgePointId: id,
          title: concept?.title || "",
          similarity: maxSimilarity,
          sources: concept?.sources || [],
          level: concept?.level || "normal",
        };
      });

      const targetNode = this.selectBestTarget(memberDetails);
      const aliases = this.generateGroupAliases(memberDetails, targetNode);
      const confidence = this.calculateAutoMergeConfidence(memberDetails);

      groups.push({
        id: crypto.randomUUID(),
        members: memberDetails,
        suggestedTargetId: targetNode.knowledgePointId,
        suggestedAliases: aliases,
        autoMergeConfidence: confidence,
      });

      for (const id of groupMembers) {
        visited.add(id);
      }
    }

    return groups.sort((a, b) => b.autoMergeConfidence - a.autoMergeConfidence);
  }

  private selectBestTarget(
    members: Array<{
      knowledgePointId: string;
      title: string;
      similarity?: number;
      sources: ConceptSource[];
      level: NodeLevel;
    }>,
  ): typeof members[0] {
    const levelPriority: Record<NodeLevel, number> = {
      root: 5,
      core: 4,
      sub: 3,
      normal: 2,
      leaf: 1,
    };

    return members.reduce((best, current) => {
      const bestScore =
        levelPriority[best.level] || 0 +
        (best.sources?.length || 0) * 0.1;
      const currentScore =
        levelPriority[current.level] || 0 +
        (current.sources?.length || 0) * 0.1;

      return currentScore > bestScore ? current : best;
    }, members[0]);
  }

  private generateGroupAliases(
    members: Array<{
      knowledgePointId: string;
      title: string;
      similarity?: number;
      sources: ConceptSource[];
      level: NodeLevel;
    }>,
    target: typeof members[0],
  ): string[] {
    const aliases: string[] = [];
    const normalizedTargetTitle = target.title.toLowerCase().trim();

    for (const member of members) {
      if (member.knowledgePointId === target.knowledgePointId) continue;

      const normalizedMemberTitle = member.title.toLowerCase().trim();
      if (
        normalizedMemberTitle !== normalizedTargetTitle &&
        !aliases.some((a) => a.toLowerCase() === normalizedMemberTitle)
      ) {
        aliases.push(member.title);
      }
    }

    return aliases;
  }

  private calculateAutoMergeConfidence(
    members: Array<{
      knowledgePointId: string;
      title: string;
      similarity?: number;
      sources: ConceptSource[];
      level: NodeLevel;
    }>,
  ): number {
    if (members.length < 2) return 0;

    const similarities = members
      .filter((m) => m.similarity !== undefined)
      .map((m) => m.similarity!);

    const avgSimilarity =
      similarities.length > 0
        ? similarities.reduce((sum, s) => sum + s, 0) / similarities.length
        : 0;

    const sizeScore = Math.min(members.length / 5, 1) * 0.2;
    const similarityScore = avgSimilarity * 0.8;

    return Math.min(Math.round((sizeScore + similarityScore) * 100) / 100, 1);
  }

  private async analyzeHierarchyRelations(
    _supabase: SupabaseClient,
    concepts: ConceptWithEmbedding[],
    threshold: number,
  ): Promise<HierarchyAnalysisSuggestion[]> {
    if (concepts.length < 2) {
      return [];
    }

    const conceptList = concepts.map((c) => ({
      id: c.id,
      title: c.title,
    }));

    const suggestions = await hierarchyRecognitionService.analyzeHierarchy(
      conceptList,
      {
        maxSuggestions: 50,
      },
    );

    const titleToIdMap = new Map(concepts.map((c) => [c.title, c.id]));

    return suggestions
      .filter((s) => s.confidence >= threshold)
      .map((s) => ({
        parentId: titleToIdMap.get(s.parentTitle) || "",
        parentTitle: s.parentTitle,
        childId: titleToIdMap.get(s.childTitle) || "",
        childTitle: s.childTitle,
        confidence: s.confidence,
      }))
      .filter((s) => s.parentId && s.childId && s.parentId !== s.childId);
  }

  private generateAliasSuggestions(
    groups: SimilarConceptGroup[],
  ): AliasSuggestion[] {
    const suggestions: AliasSuggestion[] = [];

    for (const group of groups) {
      for (const alias of group.suggestedAliases) {
        suggestions.push({
          knowledgePointId: group.suggestedTargetId,
          title: group.members.find(
            (m) => m.knowledgePointId === group.suggestedTargetId,
          )?.title || "",
          suggestedAlias: alias,
          confidence: group.autoMergeConfidence,
          sourceGroupId: group.id,
        });
      }
    }

    return suggestions;
  }

  private async cacheAnalysisResult(result: AnalysisResult): Promise<void> {
    try {
      const cacheKey = CacheKeys.CONCEPT_ANALYSIS(result.graphId, result.jobId);
      const cacheData: AnalysisCacheData = {
        result,
        timestamp: Date.now(),
      };

      await cacheService.set(cacheKey, cacheData, CACHE_TTL, [
        "concept-analysis",
        `graph-${result.graphId}`,
      ]);

      logger.info(
        `Cached analysis result for job ${result.jobId}`,
        { graphId: result.graphId },
      );
    } catch (error) {
      logger.warn("Failed to cache analysis result:", error);
    }
  }

  async getCachedAnalysisResult(
    graphId: string,
    jobId?: string,
  ): Promise<AnalysisResult | null> {
    try {
      let cacheKey: string;

      if (jobId) {
        cacheKey = CacheKeys.CONCEPT_ANALYSIS(graphId, jobId);
      } else {
        logger.info("No jobId provided, attempting to fetch latest cached result");
        return null;
      }

      const cached = await cacheService.get<AnalysisCacheData>(cacheKey);

      if (!cached) {
        return null;
      }

      const ageMinutes = (Date.now() - cached.timestamp) / (1000 * 60);
      if (ageMinutes > CACHE_TTL / 60) {
        logger.info("Cached analysis result has expired");
        return null;
      }

      return cached.result;
    } catch (error) {
      logger.error("Failed to retrieve cached analysis result:", error);
      return null;
    }
  }

  async invalidateAnalysisCache(graphId: string): Promise<void> {
    try {
      await cacheService.delByTags(["concept-analysis", `graph-${graphId}`]);
      logger.info(`Invalidated analysis cache for graph ${graphId}`);
    } catch (error) {
      logger.error("Failed to invalidate analysis cache:", error);
    }
  }

  getAnalysisSummary(result: AnalysisResult): string {
    const lines = [
      `概念聚合分析报告`,
      `================`,
      ``,
      `任务 ID: ${result.jobId}`,
      `图谱 ID: ${result.graphId}`,
      `状态: ${result.status}`,
      `开始时间: ${result.startedAt}`,
      result.completedAt ? `完成时间: ${result.completedAt}` : "",
      ``,
      `统计信息`,
      `--------`,
      `- 总概念数: ${result.summary.totalConcepts}`,
      `- 发现组数: ${result.summary.groupsFound}`,
      `- 潜在合并数: ${result.summary.potentialMerges}`,
      `- 层级建议数: ${result.summary.hierarchySuggestionsCount}`,
    ];

    if (result.similarGroups.length > 0) {
      lines.push("", "相似概念组（前 5 组）");
      lines.push("-------------------");

      for (let i = 0; i < Math.min(5, result.similarGroups.length); i++) {
        const group = result.similarGroups[i];
        lines.push(
          `\n${i + 1}. 组 ${group.id.slice(0, 8)}... (置信度: ${group.autoMergeConfidence})`,
        );
        lines.push(`   目标节点: ${group.suggestedTargetId}`);
        lines.push(`   成员数量: ${group.members.length}`);
        lines.push(`   建议别名: [${group.suggestedAliases.join(", ")}]`);
      }

      if (result.similarGroups.length > 5) {
        lines.push(`\n... 还有 ${result.similarGroups.length - 5} 组`);
      }
    }

    if (result.hierarchySuggestions.length > 0) {
      lines.push("", "层级建议（前 5 条）");
      lines.push("---------------");

      for (let i = 0; i < Math.min(5, result.hierarchySuggestions.length); i++) {
        const suggestion = result.hierarchySuggestions[i];
        lines.push(
          `${i + 1}. "${suggestion.parentTitle}" → "${suggestion.childTitle}" (${Math.round(suggestion.confidence * 100)}%)`,
        );
      }

      if (result.hierarchySuggestions.length > 5) {
        lines.push(`\n... 还有 ${result.hierarchySuggestions.length - 5} 条建议`);
      }
    }

    if (result.error) {
      lines.push("", "错误信息");
      lines.push("--------");
      lines.push(result.error);
    }

    return lines.join("\n");
  }
}

export const conceptAnalysisService = new ConceptAnalysisService();

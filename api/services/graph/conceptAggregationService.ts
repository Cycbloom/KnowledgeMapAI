import { SupabaseClient } from "@supabase/supabase-js";
import {
  conceptSimilarityService,
  type SimilarityResult,
} from "./conceptSimilarityService";
import { conceptEmbeddingService } from "./conceptEmbeddingService";
import { ConceptMergeService } from "./conceptMergeService";
import { ConceptModuleService } from "./conceptModuleService";
import { ConceptHierarchyService } from "./conceptHierarchyService";
import type {
  ConceptSource,
  NodeLevel,
} from "../../../shared/types/graph";

// 工具与类型 re-export：保持既有调用方从本文件导入 normalizeTitle 与类型
export { normalizeTitle } from "./conceptAggregationShared";
export type {
  AggregationResult,
  HierarchySuggestion,
  BatchMergeResult,
} from "./conceptAggregationShared";

/**
 * 概念聚合服务：对外聚合入口。
 * 实现按职责拆分为 ConceptMergeService / ConceptModuleService / ConceptHierarchyService，
 * 相似度与嵌入继续委托 conceptSimilarityService / conceptEmbeddingService。
 */
export class ConceptAggregationService {
  private mergeService: ConceptMergeService;
  private moduleService: ConceptModuleService;
  private hierarchyService: ConceptHierarchyService;

  constructor() {
    this.mergeService = new ConceptMergeService();
    this.moduleService = new ConceptModuleService();
    this.hierarchyService = new ConceptHierarchyService();
  }

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

  // ── Delegated to ConceptMergeService ──

  async aggregateConcepts(
    supabase: SupabaseClient,
    graphId: string,
    options: {
      threshold?: number;
      dryRun?: boolean;
    } = {},
  ): Promise<import("./conceptAggregationShared").AggregationResult> {
    return this.mergeService.aggregateConcepts(supabase, graphId, options);
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
    return this.mergeService.upgradeNodeLevel(supabase, knowledgePointId, newSources);
  }

  async batchMerge(
    supabase: SupabaseClient,
    graphId: string,
    mergeGroups: Array<{
      targetId: string;
      sourceIds: string[];
    }>,
    userId?: string,
  ): Promise<import("./conceptAggregationShared").BatchMergeResult> {
    return this.mergeService.batchMerge(supabase, graphId, mergeGroups, userId);
  }

  // ── Delegated to ConceptModuleService ──

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
    return this.moduleService.detectNewModuleNeeds(supabase, graphId, options);
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
    return this.moduleService.detectModuleOverlap(supabase, graphId, options);
  }

  // ── Delegated to ConceptHierarchyService ──

  async identifyHierarchy(
    supabase: SupabaseClient,
    graphId: string,
    concepts: Array<{ id: string; title: string }>,
  ): Promise<import("./conceptAggregationShared").HierarchySuggestion[]> {
    return this.hierarchyService.identifyHierarchy(supabase, graphId, concepts);
  }

  async updateNodeParent(
    supabase: SupabaseClient,
    graphId: string,
    childKnowledgePointId: string,
    parentKnowledgePointId: string,
  ): Promise<{ success: boolean; error?: string }> {
    return this.hierarchyService.updateNodeParent(supabase, graphId, childKnowledgePointId, parentKnowledgePointId);
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
    return this.hierarchyService.batchUpdateHierarchy(supabase, graphId, userId, relations);
  }

  async addAliases(
    supabase: SupabaseClient,
    knowledgePointId: string,
    aliases: string[],
  ): Promise<void> {
    return this.hierarchyService.addAliases(supabase, knowledgePointId, aliases);
  }

  async removeAlias(
    supabase: SupabaseClient,
    knowledgePointId: string,
    alias: string,
  ): Promise<void> {
    return this.hierarchyService.removeAlias(supabase, knowledgePointId, alias);
  }
}

export const conceptAggregationService = new ConceptAggregationService();

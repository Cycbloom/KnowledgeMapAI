import { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "../../utils/logger";
import { cacheService, CacheKeys } from "../common/cacheService";
import { notDeleted } from '../common/softDeleteHelper';
import {
  conceptSimilarityService,
  type ConceptWithEmbedding,
} from "./conceptSimilarityService";
import type {
  NodeLevel,
  ConceptSource,
  KnowledgePoint,
} from "../../../shared/types/graph";
import {
  resolveLocalizedText,
  type LocalizedText,
} from "../../../shared/utils/localization";
import {
  SIMILARITY_THRESHOLD,
  normalizeTitle,
  determineNewLevel,
  mergeSources,
  type AggregationResult,
  type BatchMergeResult,
} from "./conceptAggregationShared";

/**
 * 概念合并服务：图内聚合、节点等级升级、批量合并（含别名与边重定向）。
 */
export class ConceptMergeService {
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

        const duplicateIds = group.duplicates.map((d) => d.id);

        // 批量重定向入边（替代逐 duplicate 查询 + 更新，O(D) 次 → 1 次）
        const { error: edgeUpdateError } = await supabase
          .from("edges")
          .update({ target_knowledge_point_id: group.primary.id })
          .in("target_knowledge_point_id", duplicateIds)
          .eq("graph_id", graphId);

        if (edgeUpdateError) {
          logger.error(
            `Failed to update edges for duplicates ${duplicateIds.join(",")}:`,
            edgeUpdateError,
          );
        }

        // 批量重定向出边
        const { error: sourceEdgeUpdateError } = await supabase
          .from("edges")
          .update({ source_knowledge_point_id: group.primary.id })
          .in("source_knowledge_point_id", duplicateIds)
          .eq("graph_id", graphId);

        if (sourceEdgeUpdateError) {
          logger.error(
            `Failed to update source edges for duplicates ${duplicateIds.join(",")}:`,
            sourceEdgeUpdateError,
          );
        }

        // 批量软删除本图中的重复节点（原逻辑只删首个匹配，这里删除该知识点在本图的所有重复节点）
        const { error: deleteNodeError } = await supabase
          .from("graph_nodes")
          .update({ deleted_at: new Date().toISOString() })
          .eq("graph_id", graphId)
          .in("knowledge_point_id", duplicateIds);

        if (deleteNodeError) {
          logger.error(
            `Failed to soft delete duplicate graph nodes ${duplicateIds.join(",")}:`,
            deleteNodeError,
          );
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

    // 单次批量预取全部目标与源知识点（替代逐组 2 次读取的 2N 次往返）
    const allTargetIds = mergeGroups.map((g) => g.targetId);
    const allSourceIds = [
      ...new Set(mergeGroups.flatMap((g) => g.sourceIds)),
    ];

    const [
      { data: targetRows, error: targetsError },
      { data: sourceRows, error: sourcesError },
    ] = await Promise.all([
      supabase
        .from("knowledge_points")
        .select("id, title, properties")
        .in("id", allTargetIds),
      supabase.from("knowledge_points").select("id, title").in("id", allSourceIds),
    ]);

    if (sourcesError) {
      // 批量源查询整体失败：与原逐组 abort 语义对齐，所有组记错误后返回
      for (const group of mergeGroups) {
        result.errors.push({
          targetId: group.targetId,
          sourceIds: group.sourceIds,
          error: `Failed to fetch source knowledge points: ${sourcesError.message}`,
        });
      }
      return result;
    }

    const targetKpMap = new Map(
      (targetRows ?? []).map((row) => [row.id, row]),
    );
    const sourceKpMap = new Map((sourceRows ?? []).map((row) => [row.id, row]));

    for (const group of mergeGroups) {
      try {
        const targetKp = targetKpMap.get(group.targetId);

        if (targetsError || !targetKp) {
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

        const sourceKps = group.sourceIds
          .map((id) => sourceKpMap.get(id))
          .filter((kp): kp is { id: string; title: string } => Boolean(kp));

        // 复杂度降低：预构建规范化别名 Set，避免循环内重复 O(n) 的 some() 线性扫描
        const normalizedAliasSet = new Set(
          existingAliases.map((a) => normalizeTitle(a)),
        );
        const normalizedTargetTitle = normalizeTitle(
          resolveLocalizedText(targetKp.title as LocalizedText),
        );

        for (const sourceKp of sourceKps) {
          const sourceTitle = resolveLocalizedText(
            sourceKp.title as LocalizedText,
          );
          const normalizedTitle = normalizeTitle(sourceTitle);
          if (
            !normalizedAliasSet.has(normalizedTitle) &&
            normalizedTitle !== normalizedTargetTitle
          ) {
            newAliases.push(sourceTitle);
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

        // 组级 .in() 批量重定向边（替代逐 source 4 次往返：2 次边更新 + 1 次节点查询 + 1 次软删）
        if (group.sourceIds.length > 0) {
          const { error: targetEdgeError } = await supabase
            .from("edges")
            .update({ target_knowledge_point_id: group.targetId })
            .in("target_knowledge_point_id", group.sourceIds)
            .eq("graph_id", graphId);

          if (targetEdgeError) {
            logger.error(
              `Failed to update target edges for sources of ${group.targetId}:`,
              targetEdgeError,
            );
          } else {
            edgesUpdatedInGroup += group.sourceIds.length;
          }

          const { error: sourceEdgeError } = await supabase
            .from("edges")
            .update({ source_knowledge_point_id: group.targetId })
            .in("source_knowledge_point_id", group.sourceIds)
            .eq("graph_id", graphId);

          if (sourceEdgeError) {
            logger.error(
              `Failed to update source edges for sources of ${group.targetId}:`,
              sourceEdgeError,
            );
          } else {
            edgesUpdatedInGroup += group.sourceIds.length;
          }

          const { data: sourceGraphNodes } = await notDeleted(
            supabase
              .from("graph_nodes")
              .select("id")
              .in("knowledge_point_id", group.sourceIds)
              .eq("graph_id", graphId),
          );

          if (sourceGraphNodes && sourceGraphNodes.length > 0) {
            const { error: deleteNodeError } = await supabase
              .from("graph_nodes")
              .update({ deleted_at: new Date().toISOString() })
              .in("id", sourceGraphNodes.map((n) => n.id));

            if (deleteNodeError) {
              logger.error(
                `Failed to soft delete graph nodes for sources of ${group.targetId}:`,
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
}

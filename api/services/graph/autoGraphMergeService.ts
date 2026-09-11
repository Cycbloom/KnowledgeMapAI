import { SupabaseClient } from "@supabase/supabase-js";
import { conceptAggregationService, normalizeTitle } from "./conceptAggregationService";
import { logger } from "../../utils/logger";
import { notDeleted } from "../common/softDeleteHelper";
import {
  resolveLocalizedText,
  type LocalizedText,
} from "../../../shared/utils/localization";
import { canReuseNode } from "../../../shared/utils/nodeSpecificity";
import type { AINodeData } from "./autoGraphService";

const MERGE_THRESHOLD = parseFloat(
  process.env.CONCEPT_MERGE_THRESHOLD || "0.85",
);

/** 从节点 properties 中读取特异性标注 */
const specificityOf = (properties?: Record<string, unknown>): string | undefined =>
  typeof properties?.specificity === "string"
    ? properties.specificity
    : undefined;

export class AutoGraphMergeService {
  async deduplicateNodes(
    supabase: SupabaseClient,
    graphId: string,
    nodes: AINodeData[],
    userId: string,
  ): Promise<{
    nodesToCreate: AINodeData[];
    reusedKpIds: Map<string, string>;
    mergedCount: number;
  }> {
    const reusedKpIds = new Map<string, string>();
    const mergedIndices = new Set<number>();

    const { data: existingGraphNodes } = await notDeleted(
      supabase
        .from("graph_nodes")
        .select(
          `
        knowledge_point_id,
        knowledge_points (
          id,
          title,
          embedding,
          properties
        )
      `,
        )
        .eq("graph_id", graphId),
    );

    const normalizedTitleToKpId = new Map<
      string,
      { kpId: string; specificity?: string }
    >();
    const embeddingMap = new Map<
      string,
      { kpId: string; embedding: number[]; specificity?: string }
    >();

    if (existingGraphNodes) {
      for (const gn of existingGraphNodes) {
        const kp = gn.knowledge_points as unknown as {
          id: string;
          title: string;
          embedding?: number[];
          properties?: Record<string, unknown>;
        } | null;
        if (kp) {
          normalizedTitleToKpId.set(
            normalizeTitle(resolveLocalizedText(kp.title as LocalizedText)),
            { kpId: kp.id, specificity: specificityOf(kp.properties) },
          );
          if (kp.embedding) {
            embeddingMap.set(kp.id, {
              kpId: kp.id,
              embedding: kp.embedding as number[],
              specificity: specificityOf(kp.properties),
            });
          }
        }
      }
    }

    for (let i = 0; i < nodes.length; i++) {
      if (mergedIndices.has(i)) continue;
      const node = nodes[i];
      const normTitle = normalizeTitle(node.title);
      const newSpecificity = specificityOf(node.properties);

      const existingEntry = normalizedTitleToKpId.get(normTitle);
      // 泛化名称（generic）不参与任何层级的合并判定：
      // 同名或向量相似的 generic 节点在不同上下文语义可能不同，合并会造成知识点串味。
      if (
        existingEntry &&
        canReuseNode(newSpecificity, existingEntry.specificity)
      ) {
        reusedKpIds.set(node.tempId, existingEntry.kpId);
        mergedIndices.add(i);
        logger.info(
          `Dedup (title): "${node.title}" merged with existing kp ${existingEntry.kpId}`,
        );
        continue;
      }

      if (
        node.embedding &&
        embeddingMap.size > 0 &&
        newSpecificity !== "generic"
      ) {
        try {
          const { data: similarResults, error: rpcError } = await supabase.rpc(
            "match_knowledge_points",
            {
              query_embedding: node.embedding,
              match_threshold: MERGE_THRESHOLD,
              match_count: 3,
              p_user_id: userId,
            },
          );

          if (!rpcError && similarResults && Array.isArray(similarResults)) {
            for (const similar of similarResults) {
              const existingEmbed = embeddingMap.get(similar.id);
              if (
                existingEmbed &&
                similar.similarity >= MERGE_THRESHOLD &&
                canReuseNode(newSpecificity, existingEmbed.specificity)
              ) {
                reusedKpIds.set(node.tempId, similar.id);
                mergedIndices.add(i);
                logger.info(
                  `Dedup (vector): "${node.title}" merged with existing "${similar.title}" (sim: ${similar.similarity.toFixed(3)})`,
                );
                break;
              }
            }
          } else {
            for (const [, { kpId, embedding, specificity }] of embeddingMap) {
              const similarity =
                await conceptAggregationService.calculateSimilarity(
                  node.embedding,
                  embedding,
                );
              if (
                similarity >= MERGE_THRESHOLD &&
                canReuseNode(newSpecificity, specificity)
              ) {
                reusedKpIds.set(node.tempId, kpId);
                mergedIndices.add(i);
                logger.info(
                  `Dedup (vector fallback): "${node.title}" merged with existing kp ${kpId} (sim: ${similarity.toFixed(3)})`,
                );
                break;
              }
            }
          }
        } catch {
          for (const [, { kpId, embedding, specificity }] of embeddingMap) {
            const similarity =
              await conceptAggregationService.calculateSimilarity(
                node.embedding,
                embedding,
              );
            if (
              similarity >= MERGE_THRESHOLD &&
              canReuseNode(newSpecificity, specificity)
            ) {
              reusedKpIds.set(node.tempId, kpId);
              mergedIndices.add(i);
              logger.info(
                `Dedup (vector fallback): "${node.title}" merged with existing kp ${kpId} (sim: ${similarity.toFixed(3)})`,
              );
              break;
            }
          }
        }
      }
    }

    // 复杂度降低：用归一化标题索引把嵌套 O(n²) 去重改为单趟 O(n) 遍历
    // 泛化名称（generic）不参与批次内 title 合并：同一批次内两个 generic 同名
    // 可能隶属不同父节点/语义，各自保留为独立节点。
    const titleIndex = new Map<string, number>();
    for (let i = 0; i < nodes.length; i++) {
      if (mergedIndices.has(i)) continue;
      const normI = normalizeTitle(nodes[i].title);
      const firstIndex = titleIndex.get(normI);
      if (firstIndex === undefined) {
        titleIndex.set(normI, i);
      } else if (
        canReuseNode(
          specificityOf(nodes[i].properties),
          specificityOf(nodes[firstIndex].properties),
        )
      ) {
        mergedIndices.add(i);
        logger.info(
          `Dedup (batch title): "${nodes[i].title}" merged into "${nodes[firstIndex].title}"`,
        );
      }
    }

    for (let i = 0; i < nodes.length; i++) {
      if (mergedIndices.has(i)) continue;
      const embI = nodes[i].embedding;
      if (!embI) continue;
      const specI = specificityOf(nodes[i].properties);
      for (let j = i + 1; j < nodes.length; j++) {
        if (mergedIndices.has(j)) continue;
        const embJ = nodes[j].embedding;
        if (!embJ) continue;
        const similarity =
          await conceptAggregationService.calculateSimilarity(embI, embJ);
        if (
          similarity >= MERGE_THRESHOLD &&
          canReuseNode(specificityOf(nodes[j].properties), specI)
        ) {
          mergedIndices.add(j);
          logger.info(
            `Dedup (batch vector): "${nodes[j].title}" merged into "${nodes[i].title}" (sim: ${similarity.toFixed(3)})`,
          );
        }
      }
    }

    const nodesToCreate = nodes.filter((_, i) => !mergedIndices.has(i));
    const mergedCount = mergedIndices.size;

    return { nodesToCreate, reusedKpIds, mergedCount };
  }
}

export const autoGraphMergeService = new AutoGraphMergeService();

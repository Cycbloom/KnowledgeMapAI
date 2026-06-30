import { SupabaseClient } from "@supabase/supabase-js";
import { conceptAggregationService, normalizeTitle } from "./conceptAggregationService";
import { logger } from "../../utils/logger";
import { notDeleted } from "../common/softDeleteHelper";
import type { AINodeData } from "./autoGraphService";

const MERGE_THRESHOLD = parseFloat(
  process.env.CONCEPT_MERGE_THRESHOLD || "0.85",
);

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
          embedding
        )
      `,
        )
        .eq("graph_id", graphId),
    );

    const normalizedTitleToKpId = new Map<string, string>();
    const embeddingMap = new Map<
      string,
      { kpId: string; embedding: number[] }
    >();

    if (existingGraphNodes) {
      for (const gn of existingGraphNodes) {
        const kp = gn.knowledge_points as unknown as {
          id: string;
          title: string;
          embedding?: number[];
        } | null;
        if (kp) {
          normalizedTitleToKpId.set(normalizeTitle(kp.title), kp.id);
          if (kp.embedding) {
            embeddingMap.set(kp.id, {
              kpId: kp.id,
              embedding: kp.embedding as number[],
            });
          }
        }
      }
    }

    for (let i = 0; i < nodes.length; i++) {
      if (mergedIndices.has(i)) continue;
      const node = nodes[i];
      const normTitle = normalizeTitle(node.title);

      const existingKpId = normalizedTitleToKpId.get(normTitle);
      if (existingKpId) {
        reusedKpIds.set(node.tempId, existingKpId);
        mergedIndices.add(i);
        logger.info(
          `Dedup (title): "${node.title}" merged with existing kp ${existingKpId}`,
        );
        continue;
      }

      if (node.embedding && embeddingMap.size > 0) {
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
              if (existingEmbed && similar.similarity >= MERGE_THRESHOLD) {
                reusedKpIds.set(node.tempId, similar.id);
                mergedIndices.add(i);
                logger.info(
                  `Dedup (vector): "${node.title}" merged with existing "${similar.title}" (sim: ${similar.similarity.toFixed(3)})`,
                );
                break;
              }
            }
          } else {
            for (const [, { kpId, embedding }] of embeddingMap) {
              const similarity =
                await conceptAggregationService.calculateSimilarity(
                  node.embedding,
                  embedding,
                );
              if (similarity >= MERGE_THRESHOLD) {
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
          for (const [, { kpId, embedding }] of embeddingMap) {
            const similarity =
              await conceptAggregationService.calculateSimilarity(
                node.embedding,
                embedding,
              );
            if (similarity >= MERGE_THRESHOLD) {
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

    for (let i = 0; i < nodes.length; i++) {
      if (mergedIndices.has(i)) continue;
      const normI = normalizeTitle(nodes[i].title);
      for (let j = i + 1; j < nodes.length; j++) {
        if (mergedIndices.has(j)) continue;
        const normJ = normalizeTitle(nodes[j].title);
        if (normI === normJ) {
          mergedIndices.add(j);
          logger.info(
            `Dedup (batch title): "${nodes[j].title}" merged into "${nodes[i].title}"`,
          );
        }
      }
    }

    for (let i = 0; i < nodes.length; i++) {
      if (mergedIndices.has(i)) continue;
      const embI = nodes[i].embedding;
      if (!embI) continue;
      for (let j = i + 1; j < nodes.length; j++) {
        if (mergedIndices.has(j)) continue;
        const embJ = nodes[j].embedding;
        if (!embJ) continue;
        const similarity =
          await conceptAggregationService.calculateSimilarity(embI, embJ);
        if (similarity >= MERGE_THRESHOLD) {
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

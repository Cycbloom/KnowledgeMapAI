import { SupabaseClient } from "@supabase/supabase-js";
import { graphNodeService } from "./graphNodeService";
import { edgeService } from "./edgeService";
import { asyncTaskService } from "../asyncTaskService";
import { logger } from "../../utils/logger";
import { aiService } from "../ai/aiService";
import {
  conceptAggregationService,
  normalizeTitle,
} from "./conceptAggregationService";

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 200;
const BATCH_SIZE = 50;

const MERGE_THRESHOLD = parseFloat(
  process.env.CONCEPT_MERGE_THRESHOLD || "0.85",
);

export interface AINodeData {
  tempId: string;
  parentId: string | null;
  title: string;
  content: string;
  summary?: string | null;
  level: string;
  x_position: number;
  y_position: number;
  relationshipType?: string;
  properties?: Record<string, unknown>;
  embedding?: number[];
}

export interface CreateEdgeData {
  graph_id: string;
  source_knowledge_point_id: string;
  target_knowledge_point_id: string;
  relationship_type?: string;
}

export interface ProcessAINodesResult {
  nodeCount: number;
  edgeCount: number;
  graphNodeIds: string[];
  nodeMapping: Record<
    string,
    { graphNodeId: string; knowledgePointId: string }
  >;
  mergedCount: number;
}

export class AutoGraphService {
  private async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async retry<T>(
    fn: () => Promise<T>,
    retries: number = MAX_RETRIES,
    delayMs: number = RETRY_DELAY_MS,
  ): Promise<T> {
    let lastError: Error | null = null;
    for (let i = 0; i < retries; i++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;
        if (i < retries - 1) {
          logger.warn(
            `Retry ${i + 1}/${retries} after error: ${lastError.message}`,
          );
          await this.sleep(delayMs * (i + 1));
        }
      }
    }
    throw lastError;
  }

  async processAINodes(
    supabase: SupabaseClient,
    userId: string,
    graphId: string,
    nodes: AINodeData[],
  ): Promise<ProcessAINodesResult> {
    const validNodes = nodes.filter(
      (node) => node.title && node.title.trim() !== "",
    );

    if (validNodes.length === 0) {
      return {
        nodeCount: 0,
        edgeCount: 0,
        graphNodeIds: [],
        nodeMapping: {},
        mergedCount: 0,
      };
    }

    logger.info(`Processing ${validNodes.length} nodes for graph ${graphId}`);

    const nodeMap = new Map<
      string,
      { graphNodeId: string; knowledgePointId: string }
    >();
    const graphNodeIds: string[] = [];
    const failedNodes: string[] = [];

    const { nodesToCreate, reusedKpIds, mergedCount } =
      await this.deduplicateNodes(supabase, graphId, validNodes);

    if (mergedCount > 0) {
      logger.info(`Dedup: ${mergedCount} nodes merged with existing concepts`);
    }

    for (const [tempId, kpId] of reusedKpIds) {
      const { data: existingGN } = await supabase
        .from("graph_nodes")
        .select("id")
        .eq("knowledge_point_id", kpId)
        .eq("graph_id", graphId)
        .is("deleted_at", null)
        .maybeSingle();

      if (existingGN) {
        nodeMap.set(tempId, {
          graphNodeId: existingGN.id,
          knowledgePointId: kpId,
        });
        graphNodeIds.push(existingGN.id);
      }
    }

    logger.info("Creating knowledge points in batches (without embedding)...");
    const { knowledgePoints, embeddingsGenerated } =
      await this.createKnowledgePointsBatch(supabase, userId, nodesToCreate);

    logger.info("Creating graph nodes...");
    for (let i = 0; i < nodesToCreate.length; i++) {
      const nodeData = nodesToCreate[i];
      const kp = knowledgePoints[i];

      if (!kp) {
        failedNodes.push(nodeData.title);
        continue;
      }

      try {
        const graphNode = await this.retry(() =>
          graphNodeService.addToGraph(supabase, {
            graph_id: graphId,
            knowledge_point_id: kp.id,
            x_position: nodeData.x_position,
            y_position: nodeData.y_position,
            level: (nodeData.level as any) || "normal",
            is_accepted: true,
          }),
        );

        nodeMap.set(nodeData.tempId, {
          graphNodeId: graphNode.id,
          knowledgePointId: kp.id,
        });
        graphNodeIds.push(graphNode.id);
      } catch (error) {
        logger.error(
          `Failed to create graph node for: ${nodeData.title}`,
          error,
        );
        failedNodes.push(nodeData.title);
      }
    }

    if (failedNodes.length > 0) {
      logger.warn(
        `Failed to create ${failedNodes.length} nodes: ${failedNodes.slice(0, 5).join(", ")}${failedNodes.length > 5 ? "..." : ""}`,
      );
    }

    const edgesToCreate: CreateEdgeData[] = [];
    for (const nodeData of validNodes) {
      if (nodeData.parentId) {
        let parentInfo = nodeMap.get(nodeData.parentId);
        const childInfo = nodeMap.get(nodeData.tempId);

        if (!parentInfo && childInfo) {
          try {
            const { data: existingNode, error } = await supabase
              .from("graph_nodes")
              .select("knowledge_point_id")
              .eq("id", nodeData.parentId)
              .eq("graph_id", graphId)
              .single();

            if (!error && existingNode) {
              parentInfo = {
                graphNodeId: nodeData.parentId,
                knowledgePointId: existingNode.knowledge_point_id,
              };
              logger.info(`Found parent node in database`, {
                parentId: nodeData.parentId,
                knowledgePointId: existingNode.knowledge_point_id,
                childTempId: nodeData.tempId,
              });
            } else {
              logger.warn(`Parent node not found in database`, {
                parentId: nodeData.parentId,
                error: error?.message,
                childTempId: nodeData.tempId,
              });
            }
          } catch (e) {
            logger.warn(
              `Could not find parent node ${nodeData.parentId} in database`,
              {
                error: (e as Error).message,
                childTempId: nodeData.tempId,
              },
            );
          }
        } else if (parentInfo) {
          logger.info(`Parent found in nodeMap`, {
            parentId: nodeData.parentId,
            childTempId: nodeData.tempId,
          });
        }

        if (parentInfo && childInfo) {
          edgesToCreate.push({
            graph_id: graphId,
            source_knowledge_point_id: parentInfo.knowledgePointId,
            target_knowledge_point_id: childInfo.knowledgePointId,
            relationship_type: nodeData.relationshipType || "contains",
          });
        } else {
          logger.warn(`Could not create edge for node`, {
            tempId: nodeData.tempId,
            parentId: nodeData.parentId,
            hasParentInfo: !!parentInfo,
            hasChildInfo: !!childInfo,
          });
        }
      }
    }

    logger.info("Edges to create", {
      count: edgesToCreate.length,
      edges: edgesToCreate.map((e) => ({
        source: e.source_knowledge_point_id,
        target: e.target_knowledge_point_id,
        type: e.relationship_type,
      })),
    });

    logger.info(`Inserting ${edgesToCreate.length} edges in batch...`);
    const edgeCount = await this.createEdgesBatch(supabase, edgesToCreate);

    if (edgesToCreate.length > 0) {
      try {
        const { data: createdEdges, error: verifyError } = await supabase
          .from("edges")
          .select(
            "id, source_knowledge_point_id, target_knowledge_point_id, relationship_type",
          )
          .in(
            "source_knowledge_point_id",
            edgesToCreate.map((e) => e.source_knowledge_point_id),
          )
          .in(
            "target_knowledge_point_id",
            edgesToCreate.map((e) => e.target_knowledge_point_id),
          )
          .eq("graph_id", graphId)
          .is("deleted_at", null);

        if (verifyError) {
          logger.error("Edge verification failed", {
            error: verifyError.message,
            code: verifyError.code,
          });
        } else {
          logger.info("Edges verified", {
            expected: edgesToCreate.length,
            actual: createdEdges?.length || 0,
            success: createdEdges?.length === edgesToCreate.length,
            createdEdges: createdEdges?.map((e) => ({
              source: e.source_knowledge_point_id,
              target: e.target_knowledge_point_id,
              type: e.relationship_type,
            })),
          });
        }
      } catch (e) {
        logger.error("Edge verification exception", {
          error: (e as Error).message,
        });
      }
    }

    logger.info(
      `Completed: ${graphNodeIds.length} nodes (${mergedCount} merged, ${graphNodeIds.length - mergedCount} new), ${edgeCount} edges`,
    );

    if (!embeddingsGenerated) {
      const validKnowledgePointIds = knowledgePoints
        .filter((kp): kp is { id: string } => kp !== null)
        .map((kp) => kp.id);

      if (validKnowledgePointIds.length > 0) {
        try {
          await asyncTaskService.createTask(
            userId,
            "embedding_generation",
            { knowledgePointIds: validKnowledgePointIds },
            `嵌入生成 - ${validKnowledgePointIds.length}个知识点`,
          );
          logger.info(
            `Created embedding generation task for ${validKnowledgePointIds.length} knowledge points`,
          );
        } catch (error) {
          logger.error("Failed to create embedding generation task:", error);
        }
      }
    }

    const nodeMappingRecord: Record<
      string,
      { graphNodeId: string; knowledgePointId: string }
    > = {};
    for (const [tempId, info] of nodeMap) {
      nodeMappingRecord[tempId] = info;
    }

    return {
      nodeCount: graphNodeIds.length,
      edgeCount,
      graphNodeIds,
      nodeMapping: nodeMappingRecord,
      mergedCount,
    };
  }

  private async deduplicateNodes(
    supabase: SupabaseClient,
    graphId: string,
    nodes: AINodeData[],
  ): Promise<{
    nodesToCreate: AINodeData[];
    reusedKpIds: Map<string, string>;
    mergedCount: number;
  }> {
    const reusedKpIds = new Map<string, string>();
    const mergedIndices = new Set<number>();

    const { data: existingGraphNodes } = await supabase
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
      .eq("graph_id", graphId)
      .is("deleted_at", null);

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

  private async createKnowledgePointsBatch(
    supabase: SupabaseClient,
    userId: string,
    nodes: AINodeData[],
  ): Promise<{
    knowledgePoints: Array<{ id: string } | null>;
    embeddingsGenerated: boolean;
  }> {
    const results: Array<{ id: string } | null> = new Array(nodes.length).fill(
      null,
    );

    for (let i = 0; i < nodes.length; i += BATCH_SIZE) {
      const batchNodes = nodes.slice(i, i + BATCH_SIZE);

      const records = batchNodes.map((node) => ({
        title: node.title,
        content: node.content || "",
        summary: node.summary || null,
        properties: {
          source: "ai-generated",
          generated_at: new Date().toISOString(),
          ...(node.properties || {}),
        },
        embedding: node.embedding || null,
        visibility: "private" as const,
        owner_id: userId,
      }));

      try {
        const { data, error } = await supabase
          .from("knowledge_points")
          .insert(records)
          .select("id");

        if (error) {
          logger.error("Batch knowledge point insertion error:", error);
          for (let j = 0; j < batchNodes.length; j++) {
            try {
              const { data: singleData, error: singleError } = await supabase
                .from("knowledge_points")
                .insert([
                  {
                    title: batchNodes[j].title,
                    content: batchNodes[j].content || "",
                    summary: batchNodes[j].summary || null,
                    properties: {
                      source: "ai-generated",
                      ...(batchNodes[j].properties || {}),
                    },
                    embedding: batchNodes[j].embedding || null,
                    visibility: "private",
                    owner_id: userId,
                  },
                ])
                .select("id")
                .single();

              if (singleError) {
                logger.error(
                  `Individual KP creation failed for: ${batchNodes[j].title}`,
                  singleError,
                );
                results[i + j] = null;
              } else {
                results[i + j] = singleData;
              }
            } catch (e) {
              logger.error(
                `Individual KP creation exception for: ${batchNodes[j].title}`,
                e,
              );
              results[i + j] = null;
            }
          }
        } else {
          for (let j = 0; j < (data?.length || 0); j++) {
            results[i + j] = data![j];
          }
        }
      } catch (error) {
        logger.error("Knowledge point batch creation failed:", error);
      }
    }

    const kpsNeedingEmbeddings: Array<{ id: string; text: string }> = [];
    for (let i = 0; i < results.length; i++) {
      if (results[i] && !nodes[i].embedding) {
        const node = nodes[i];
        const text = node.content
          ? `${node.title}: ${node.content.slice(0, 500)}`
          : node.title;
        kpsNeedingEmbeddings.push({ id: results[i]!.id, text });
      }
    }

    let embeddingsGenerated = true;
    const preGeneratedCount = results.filter(
      (r, i) => r && nodes[i].embedding,
    ).length;

    if (preGeneratedCount > 0) {
      logger.info(
        `${preGeneratedCount} knowledge points have pre-generated embeddings`,
      );
    }

    if (kpsNeedingEmbeddings.length > 0) {
      try {
        const texts = kpsNeedingEmbeddings.map((kp) => kp.text);
        const embeddings = await aiService.generateEmbeddingsBatch(texts);

        let updatedCount = 0;
        for (let i = 0; i < kpsNeedingEmbeddings.length; i++) {
          if (embeddings[i]) {
            const { error: updateError } = await supabase
              .from("knowledge_points")
              .update({ embedding: embeddings[i] })
              .eq("id", kpsNeedingEmbeddings[i].id);

            if (!updateError) {
              updatedCount++;
            }
          }
        }

        logger.info(
          `Generated embeddings: ${updatedCount}/${kpsNeedingEmbeddings.length}`,
        );

        if (updatedCount !== kpsNeedingEmbeddings.length) {
          embeddingsGenerated = false;
          logger.warn(
            `Only ${updatedCount}/${kpsNeedingEmbeddings.length} embeddings generated`,
          );
        }
      } catch (embedError) {
        embeddingsGenerated = false;
        logger.warn("Synchronous embedding generation failed:", embedError);
      }
    }

    return { knowledgePoints: results, embeddingsGenerated };
  }

  async createEdgesBatch(
    supabase: SupabaseClient,
    edges: CreateEdgeData[],
  ): Promise<number> {
    if (edges.length === 0) return 0;

    if (edges.length > 0) {
      const graphId = edges[0].graph_id;
      const { data: existingEdges } = await supabase
        .from("edges")
        .select("source_knowledge_point_id, target_knowledge_point_id")
        .eq("graph_id", graphId)
        .is("deleted_at", null);

      const existingPairs = new Set<string>();
      if (existingEdges) {
        for (const e of existingEdges) {
          existingPairs.add(
            `${e.source_knowledge_point_id}::${e.target_knowledge_point_id}`,
          );
        }
      }

      const dedupedEdges = edges.filter((e) => {
        const key = `${e.source_knowledge_point_id}::${e.target_knowledge_point_id}`;
        return !existingPairs.has(key);
      });

      const duplicateCount = edges.length - dedupedEdges.length;
      if (duplicateCount > 0) {
        logger.info(
          `Edge dedup: ${duplicateCount} edges already exist, skipped`,
        );
      }

      if (dedupedEdges.length === 0) {
        return edges.length;
      }

      edges = dedupedEdges;
    }

    const edgeRecords = edges.map((e) => ({
      graph_id: e.graph_id,
      source_knowledge_point_id: e.source_knowledge_point_id,
      target_knowledge_point_id: e.target_knowledge_point_id,
      relationship_type: e.relationship_type || "contains",
    }));

    try {
      const { error } = await supabase.from("edges").insert(edgeRecords);

      if (error) {
        logger.error("Batch edge insertion error:", error);
        let successCount = edges.length;
        for (const edge of edges) {
          try {
            await this.retry(() =>
              edgeService.create(supabase, {
                graph_id: edge.graph_id,
                source_knowledge_point_id: edge.source_knowledge_point_id,
                target_knowledge_point_id: edge.target_knowledge_point_id,
                relationship_type: edge.relationship_type || "contains",
              }),
            );
          } catch (e) {
            successCount--;
            logger.error("Individual edge insertion error:", e);
          }
        }
        return successCount;
      }
      return edges.length;
    } catch (error) {
      logger.error("Batch edge insertion failed:", error);
      return 0;
    }
  }
}

export const autoGraphService = new AutoGraphService();

import { SupabaseClient } from "@supabase/supabase-js";
import { graphNodeService } from "./graphNodeService";
import { edgeService } from "./edgeService";
import { asyncTaskService } from "../asyncTaskService";
import { logger } from "../../utils/logger";
import { aiService } from "../ai/aiService";
import { createKnowledgePointWithGraphNode } from "../../utils/nodeHelpers";
import { cacheService, CacheKeys } from "../common/cacheService";
import type { NodeLevel } from "../../../shared/types/graph";
import type { AIProviderType } from "../../../shared/types";
import { promptService } from "../ai/promptService";
import { enrichMetadata } from "../ai/performanceMonitor";
import { withAIMonitoring } from "../ai/aiMonitor";
import { getAIProvider, getAIProviderForTask } from "../ai/factory";
import { autoGraphRouteService } from "./autoGraphRouteService";
import { scrapeUrl } from "../../utils/scraper";
import { AppError } from "../../middleware/errorHandler";
import { ErrorCodes } from "../../../shared/types/errorCodes";
import { transactionExecutor } from "../../database/transactionExecutor";
import { notDeleted } from '../common/softDeleteHelper';
import { autoGraphMergeService } from "./autoGraphMergeService";

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 200;
const BATCH_SIZE = 50;

const validLevels = ["root", "core", "sub", "normal", "leaf"];

const URL_PATTERN = /^https?:\/\/.+/;

interface AIGeneratedNode {
  id?: string;
  title: string;
  content?: string;
  summary?: string;
  level?: string;
  parentId?: string | null;
  backboneModule?: string;
  needsRefinement?: boolean;
  suggestedContent?: string;
  color?: string;
}

interface ExistingChild {
  title: string;
  content?: string;
}

export interface InitGraphParams {
  topic: string;
  style: string;
  customPrompt?: string;
  sources?: string[];
  graphId?: string;
  providerType?: string;
  model?: string;
  language?: string;
  sessionId?: string;
  userId: string;
}

export interface InitGraphResult {
  sessionId: string;
  root: {
    title: string;
    content: string;
  };
  coreNodes: AIGeneratedNode[];
}

export interface ExpandNodeParams {
  nodeId: string;
  nodeTitle: string;
  nodeContent?: string;
  nodeLevel?: string;
  graphId?: string;
  style: string;
  customPrompt?: string;
  existingChildren?: ExistingChild[];
  providerType?: string;
  model?: string;
  language?: string;
  sessionId?: string;
  userId: string;
}

export interface ExpandNodeResult {
  sessionId: string;
  parentNodeId: string;
  children: AIGeneratedNode[];
}

export interface CalculateNodePositionsResult {
  tempId: string;
  parentId: string | null;
  title: string;
  content: string;
  summary: string | null;
  level: string;
  x_position: number;
  y_position: number;
  properties?: Record<string, unknown>;
}

export interface ApplyTemplateParams {
  template?: {
    id: string;
    name: string;
    description?: string;
    nodes: Array<{
      id: string;
      title: string;
      level: string;
      parentId?: string;
    }>;
    edges: Array<{
      source: string;
      target: string;
      relationship_type?: string;
      description?: string;
    }>;
    layoutSuggestion: string;
    estimatedNodes?: number;
    difficulty?: string;
    tags?: string[];
    reasoning?: string;
  };
  templateId?: string;
  topic: string;
  style: string;
  customPrompt?: string;
  graphId: string;
  providerType?: string;
  model?: string;
  userId: string;
}

export interface ApplyTemplateResult {
  templateId: string;
  templateName: string;
  nodes: AIGeneratedNode[];
  edges: Array<{
    source: string;
    target: string;
    relationship_type?: string;
    description?: string;
  }>;
  layoutSuggestion: string;
  metadata: {
    topic: string;
    style: string;
    generatedAt: string;
    provider: string;
    model: string;
  };
}

export interface AINodeData {
  tempId: string;
  parentId: string | null;
  title: string;
  content: string;
  summary?: string | null;
  level: NodeLevel | string;
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

    const { nodesToCreate, reusedKpIds, mergedCount } =
      await autoGraphMergeService.deduplicateNodes(supabase, graphId, validNodes, userId);

    if (mergedCount > 0) {
      logger.info(`Dedup: ${mergedCount} nodes merged with existing concepts`);
    }

    for (const [tempId, kpId] of reusedKpIds) {
      const { data: existingGN } = await notDeleted(supabase
        .from("graph_nodes")
        .select("id")
        .eq("knowledge_point_id", kpId)
        .eq("graph_id", graphId)
        )
        .maybeSingle();

      if (existingGN) {
        nodeMap.set(tempId, {
          graphNodeId: existingGN.id,
          knowledgePointId: kpId,
        });
        graphNodeIds.push(existingGN.id);
      }
    }

    if (transactionExecutor.isAvailable()) {
      return this.processAINodesWithTransaction(
        supabase,
        userId,
        graphId,
        validNodes,
        nodesToCreate,
        nodeMap,
        graphNodeIds,
        mergedCount,
      );
    }

    logger.warn(
      "transactionExecutor not available, falling back to non-transactional processing for processAINodes",
    );

    const failedNodes: string[] = [];

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
            level: (validLevels.includes(nodeData.level) ? nodeData.level : "normal") as NodeLevel,
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
        const { data: createdEdges, error: verifyError } = await notDeleted(supabase
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
          );

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

  private async processAINodesWithTransaction(
    supabase: SupabaseClient,
    userId: string,
    graphId: string,
    validNodes: AINodeData[],
    nodesToCreate: AINodeData[],
    nodeMap: Map<string, { graphNodeId: string; knowledgePointId: string }>,
    graphNodeIds: string[],
    mergedCount: number,
  ): Promise<ProcessAINodesResult> {
    const knowledgePointIds: string[] = [];

    const { edgeCount } = await transactionExecutor.executeInTransaction(
      async (client) => {
        // 1. Insert knowledge_points
        logger.info(
          "Creating knowledge points in transaction (without embedding)...",
        );
        for (const nodeData of nodesToCreate) {
          const embeddingValue = nodeData.embedding
            ? `[${nodeData.embedding.join(",")}]`
            : null;

          const kpResult = await client.query(
            `INSERT INTO knowledge_points (title, content, summary, properties, embedding, visibility, owner_id)
             VALUES ($1, $2, $3, $4, $5::vector, 'private', $6) RETURNING id`,
            [
              nodeData.title,
              nodeData.content || "",
              nodeData.summary || null,
              JSON.stringify({
                source: "ai-generated",
                generated_at: new Date().toISOString(),
                ...(nodeData.properties || {}),
              }),
              embeddingValue,
              userId,
            ],
          );

          const kpId = kpResult.rows[0]?.id;
          if (!kpId) {
            throw new AppError(
              `Failed to create knowledge point for: ${nodeData.title}`,
              500,
              ErrorCodes.SYSTEM_INTERNAL_ERROR,
            );
          }
          knowledgePointIds.push(kpId);
        }

        // 2. Insert graph_nodes
        logger.info("Creating graph nodes in transaction...");
        for (let i = 0; i < nodesToCreate.length; i++) {
          const nodeData = nodesToCreate[i];
          const kpId = knowledgePointIds[i];

          const gnResult = await client.query(
            `INSERT INTO graph_nodes (graph_id, knowledge_point_id, x_position, y_position, level, is_accepted)
             VALUES ($1, $2, $3, $4, $5, true) RETURNING id`,
            [
              graphId,
              kpId,
              nodeData.x_position,
              nodeData.y_position,
              validLevels.includes(nodeData.level) ? nodeData.level : "normal",
            ],
          );

          const graphNodeId = gnResult.rows[0]?.id;
          if (!graphNodeId) {
            throw new AppError(
              `Failed to create graph node for: ${nodeData.title}`,
              500,
              ErrorCodes.SYSTEM_INTERNAL_ERROR,
            );
          }

          nodeMap.set(nodeData.tempId, { graphNodeId, knowledgePointId: kpId });
          graphNodeIds.push(graphNodeId);
        }

        // 3. Build edges list and insert
        const edgesToCreate: CreateEdgeData[] = [];
        for (const nodeData of validNodes) {
          if (nodeData.parentId) {
            let parentInfo = nodeMap.get(nodeData.parentId);
            const childInfo = nodeMap.get(nodeData.tempId);

            if (!parentInfo && childInfo) {
              const { rows: existingParent } = await client.query(
                `SELECT knowledge_point_id FROM graph_nodes WHERE id = $1 AND graph_id = $2 AND deleted_at IS NULL`,
                [nodeData.parentId, graphId],
              );

              if (existingParent.length > 0) {
                parentInfo = {
                  graphNodeId: nodeData.parentId,
                  knowledgePointId: existingParent[0].knowledge_point_id,
                };
                logger.info(`Found parent node in database (transaction)`, {
                  parentId: nodeData.parentId,
                  knowledgePointId: existingParent[0].knowledge_point_id,
                  childTempId: nodeData.tempId,
                });
              } else {
                logger.warn(`Parent node not found in database (transaction)`, {
                  parentId: nodeData.parentId,
                  childTempId: nodeData.tempId,
                });
              }
            }

            if (parentInfo && childInfo) {
              edgesToCreate.push({
                graph_id: graphId,
                source_knowledge_point_id: parentInfo.knowledgePointId,
                target_knowledge_point_id: childInfo.knowledgePointId,
                relationship_type: nodeData.relationshipType || "contains",
              });
            } else {
              logger.warn(`Could not create edge for node (transaction)`, {
                tempId: nodeData.tempId,
                parentId: nodeData.parentId,
                hasParentInfo: !!parentInfo,
                hasChildInfo: !!childInfo,
              });
            }
          }
        }

        logger.info("Edges to create (transaction)", {
          count: edgesToCreate.length,
        });

        // 4. Deduplicate edges against existing ones
        let dedupedEdges = edgesToCreate;
        if (edgesToCreate.length > 0) {
          const { rows: existingEdges } = await client.query(
            `SELECT source_knowledge_point_id, target_knowledge_point_id FROM edges WHERE graph_id = $1 AND deleted_at IS NULL`,
            [graphId],
          );

          const existingPairs = new Set<string>();
          for (const e of existingEdges) {
            existingPairs.add(
              `${e.source_knowledge_point_id}::${e.target_knowledge_point_id}`,
            );
          }

          dedupedEdges = edgesToCreate.filter((e) => {
            const key = `${e.source_knowledge_point_id}::${e.target_knowledge_point_id}`;
            return !existingPairs.has(key);
          });

          const duplicateCount = edgesToCreate.length - dedupedEdges.length;
          if (duplicateCount > 0) {
            logger.info(
              `Edge dedup (transaction): ${duplicateCount} edges already exist, skipped`,
            );
          }
        }

        // 5. Insert edges in batch
        let insertedEdgeCount = 0;
        if (dedupedEdges.length > 0) {
          const edgesValues: string[] = [];
          const edgesParams: unknown[] = [];
          let paramIdx = 1;

          for (const e of dedupedEdges) {
            edgesValues.push(
              `($${paramIdx}, $${paramIdx + 1}, $${paramIdx + 2}, $${paramIdx + 3})`,
            );
            edgesParams.push(
              e.graph_id,
              e.source_knowledge_point_id,
              e.target_knowledge_point_id,
              e.relationship_type || "contains",
            );
            paramIdx += 4;
          }

          await client.query(
            `INSERT INTO edges (graph_id, source_knowledge_point_id, target_knowledge_point_id, relationship_type)
             VALUES ${edgesValues.join(", ")}`,
            edgesParams,
          );
          insertedEdgeCount = dedupedEdges.length;
        }

        // Also count previously existing edges as "successful"
        return {
          edgeCount:
            insertedEdgeCount + (edgesToCreate.length - dedupedEdges.length),
        };
      },
    );

    logger.info(
      `Completed (transaction): ${graphNodeIds.length} nodes (${mergedCount} merged, ${graphNodeIds.length - mergedCount} new), ${edgeCount} edges`,
    );

    // Post-transaction: generate embeddings for knowledge points without them
    const kpsNeedingEmbeddings: Array<{ id: string; text: string }> = [];
    for (let i = 0; i < nodesToCreate.length; i++) {
      if (knowledgePointIds[i] && !nodesToCreate[i].embedding) {
        const node = nodesToCreate[i];
        const text = node.content
          ? `${node.title}: ${node.content.slice(0, 500)}`
          : node.title;
        kpsNeedingEmbeddings.push({ id: knowledgePointIds[i], text });
      }
    }

    let embeddingsGenerated = true;
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
          `Generated embeddings (post-transaction): ${updatedCount}/${kpsNeedingEmbeddings.length}`,
        );

        if (updatedCount !== kpsNeedingEmbeddings.length) {
          embeddingsGenerated = false;
          logger.warn(
            `Only ${updatedCount}/${kpsNeedingEmbeddings.length} embeddings generated`,
          );
        }
      } catch (embedError) {
        embeddingsGenerated = false;
        logger.warn(
          "Synchronous embedding generation failed (post-transaction):",
          embedError,
        );
      }
    }

    if (!embeddingsGenerated) {
      if (knowledgePointIds.length > 0) {
        try {
          await asyncTaskService.createTask(
            userId,
            "embedding_generation",
            { knowledgePointIds },
            `嵌入生成 - ${knowledgePointIds.length}个知识点`,
          );
          logger.info(
            `Created embedding generation task for ${knowledgePointIds.length} knowledge points`,
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
        } else if (data) {
          for (let j = 0; j < data.length; j++) {
            results[i + j] = data[j];
          }
        }
      } catch (error) {
        logger.error("Knowledge point batch creation failed:", error);
      }
    }

    const kpsNeedingEmbeddings: Array<{ id: string; text: string }> = [];
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      if (result && !nodes[i].embedding) {
        const node = nodes[i];
        const text = node.content
          ? `${node.title}: ${node.content.slice(0, 500)}`
          : node.title;
        kpsNeedingEmbeddings.push({ id: result.id, text });
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
      const { data: existingEdges } = await notDeleted(supabase
        .from("edges")
        .select("source_knowledge_point_id, target_knowledge_point_id")
        .eq("graph_id", graphId)
        );

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

  async saveTextToGraph(
    supabase: SupabaseClient,
    userId: string,
    graphId: string,
    nodes: Array<{
      id?: string;
      title?: string;
      content?: string;
      level?: string;
      properties?: Record<string, unknown>;
    }>,
    edges?: Array<{
      source: string;
      target: string;
      relationship_type?: string;
      relationship?: string;
    }>,
  ): Promise<{ nodeCount: number; edgeCount: number }> {
    const nodeMap = new Map<string, string>();
    const createdNodes: {
      id: string;
      title: string;
      content?: string;
      knowledge_point_id?: string;
    }[] = [];

    const validNodes = nodes.filter(
      (node) => node.title && node.title.trim() !== "",
    );

    if (validNodes.length === 0) {
      return { nodeCount: 0, edgeCount: 0 };
    }

    for (const node of validNodes) {
      const result = await createKnowledgePointWithGraphNode(
        supabase,
        userId,
        {
          graph_id: graphId,
          title: node.title ?? "",
          content: node.content || "",
          x_position: Math.round((Math.random() - 0.5) * 50),
          y_position: Math.round((Math.random() - 0.5) * 50),
          level: node.level || "leaf",
          properties: { ...node.properties, source: "ai-text-to-graph" },
        },
      );

      if (result) {
        if (node.id) nodeMap.set(node.id, result.knowledge_point_id || result.id);
        createdNodes.push({
          id: result.id,
          title: node.title ?? "",
          content: node.content,
          knowledge_point_id: result.knowledge_point_id,
        });
      }
    }

    let edgeCount = 0;
    if (edges && Array.isArray(edges)) {
      for (const edge of edges) {
        const sourceKPId = nodeMap.get(edge.source);
        const targetKPId = nodeMap.get(edge.target);

        if (sourceKPId && targetKPId) {
          try {
            await edgeService.create(supabase, {
              graph_id: graphId,
              source_knowledge_point_id: sourceKPId,
              target_knowledge_point_id: targetKPId,
              relationship_type: edge.relationship_type || edge.relationship || "contains",
            });
            edgeCount++;
          } catch (err) {
            logger.warn("Failed to create edge:", err);
          }
        }
      }
    }

    cacheService.del(CacheKeys.GRAPH_NODES(userId, graphId));
    cacheService.del(CacheKeys.USER_GRAPHS(userId));

    return { nodeCount: createdNodes.length, edgeCount };
  }

  async processSource(source: string): Promise<string> {
    const trimmed = source.trim();

    if (URL_PATTERN.test(trimmed)) {
      try {
        logger.info(`Fetching URL content: ${trimmed}`);
        const result = await scrapeUrl(trimmed);
        return `【来源: ${result.title}】\n${result.text.slice(0, 3000)}`;
      } catch (error) {
        logger.warn(`Failed to scrape URL: ${trimmed}`, error);
        return `【URL: ${trimmed}】(无法获取内容)`;
      }
    }

    return trimmed;
  }

  async initGraph(
    supabase: SupabaseClient,
    params: InitGraphParams,
  ): Promise<InitGraphResult> {
    const {
      topic,
      style,
      customPrompt,
      sources,
      graphId,
      providerType,
      model,
      language,
      sessionId: inputSessionId,
      userId,
    } = params;

    const sessionId = inputSessionId || crypto.randomUUID();

    const provider = providerType
      ? await getAIProvider(providerType as AIProviderType)
      : await getAIProviderForTask("text");

    if (!provider.hasKey) {
      throw new AppError(
        "AI provider not configured",
        503,
        ErrorCodes.SYSTEM_INTERNAL_ERROR,
      );
    }

    let processedSources: string[] = [];
    if (sources && sources.length > 0) {
      processedSources = await Promise.all(
        sources.map((s) => this.processSource(s)),
      );
    }

    let systemPrompt: string;

    if (style === "custom" && customPrompt) {
      systemPrompt = await promptService.getRenderedPrompt(
        supabase,
        "auto_graph_init",
        {
          topic,
          isCustom: true,
          customPrompt,
          hasSources: processedSources.length > 0,
          sources: processedSources.join("\n\n---\n\n"),
          isInit: true,
        },
        userId,
        graphId,
        language,
      );
    } else {
      const templateData: Record<string, unknown> = {
        topic,
        isAcademic: style === "academic",
        isPractical: style === "practical",
        hasSources: processedSources.length > 0,
        sources: processedSources.join("\n\n---\n\n"),
        isInit: true,
      };

      systemPrompt = await promptService.getRenderedPrompt(
        supabase,
        "auto_graph_init",
        templateData,
        userId,
        graphId,
        language,
      );
    }

    const completion = await withAIMonitoring(
      {
        operation: "auto_graph_init",
        provider: provider.providerType,
        model: model || provider.model,
        metadata: await enrichMetadata(supabase, {
          graphId,
          userId,
          topic,
          style,
        }),
        sessionId,
      },
      async () => {
        const result = await provider.client.chat.completions.create({
          messages: [
            { role: "system", content: systemPrompt },
            {
              role: "user",
              content: `主题：${topic}${processedSources.length > 0 ? `\n\n参考来源：\n${processedSources.join("\n\n---\n\n")}` : ""}`,
            },
          ],
          model: model || provider.model,
          response_format: { type: "json_object" },
          max_tokens: 4000,
        });
        return {
          result,
          usage: result.usage,
        };
      },
    );

    const content = completion.choices[0].message.content;
    let parsed;
    try {
      parsed = JSON.parse(content || '{"root": null, "coreNodes": []}');
    } catch (e) {
      logger.error("JSON Parse Error:", { content: content?.slice(-100) });
      throw new AppError(
        "AI 生成内容解析失败",
        422,
        ErrorCodes.SYSTEM_INTERNAL_ERROR,
      );
    }

    return {
      sessionId,
      root: parsed.root || {
        title: topic,
        content: `${topic}的核心概念和知识体系`,
      },
      coreNodes: parsed.coreNodes || [],
    };
  }

  async expandNode(
    supabase: SupabaseClient,
    params: ExpandNodeParams,
  ): Promise<ExpandNodeResult> {
    const {
      nodeId,
      nodeTitle,
      nodeContent,
      nodeLevel,
      graphId,
      style,
      customPrompt,
      existingChildren,
      providerType,
      model,
      language,
      sessionId: inputSessionId,
      userId,
    } = params;

    const provider = providerType
      ? await getAIProvider(providerType as AIProviderType)
      : await getAIProviderForTask("text");

    if (!provider.hasKey) {
      throw new AppError(
        "AI provider not configured",
        503,
        ErrorCodes.SYSTEM_INTERNAL_ERROR,
      );
    }

    const sessionId = inputSessionId || crypto.randomUUID();

    let systemPrompt: string;

    if (style === "custom" && customPrompt) {
      systemPrompt = await promptService.getRenderedPrompt(
        supabase,
        "auto_graph_expand",
        {
          nodeTitle,
          nodeContent: nodeContent || "",
          nodeLevel: nodeLevel || "normal",
          isCustom: true,
          customPrompt,
          hasExistingChildren:
            existingChildren && existingChildren.length > 0,
          existingChildren:
            existingChildren?.map((c) => c.title).join("、") || "",
        },
        userId,
        graphId,
        language,
      );
    } else {
      const templateData: Record<string, unknown> = {
        nodeTitle,
        nodeContent: nodeContent || "",
        nodeLevel: nodeLevel || "normal",
        isAcademic: style === "academic",
        isPractical: style === "practical",
        hasExistingChildren:
          existingChildren && existingChildren.length > 0,
        existingChildren:
          existingChildren?.map((c) => c.title).join("、") || "",
      };

      systemPrompt = await promptService.getRenderedPrompt(
        supabase,
        "auto_graph_expand",
        templateData,
        userId,
        graphId,
        language,
      );
    }

    const completion = await withAIMonitoring(
      {
        operation: "auto_graph_expand",
        provider: provider.providerType,
        model: model || provider.model,
        metadata: await enrichMetadata(supabase, {
          graphId,
          userId,
          nodeTitle,
          nodeId,
          nodeLevel,
        }),
        sessionId,
      },
      async () => {
        const result = await provider.client.chat.completions.create({
          messages: [
            { role: "system", content: systemPrompt },
            {
              role: "user",
              content: `请为「${nodeTitle}」生成子节点。${existingChildren && existingChildren.length > 0 ? `\n\n已有的子节点：${existingChildren.map((c) => c.title).join("、")}\n请生成新的、不同的子节点。` : ""}`,
            },
          ],
          model: model || provider.model,
          response_format: { type: "json_object" },
          max_tokens: 3000,
        });
        return {
          result,
          usage: result.usage,
        };
      },
    );

    const content = completion.choices[0].message.content;
    let parsed;
    try {
      parsed = JSON.parse(content || '{"children": []}');
    } catch (e) {
      logger.error("JSON Parse Error:", { content: content?.slice(-100) });
      throw new AppError(
        "AI 生成内容解析失败",
        422,
        ErrorCodes.SYSTEM_INTERNAL_ERROR,
      );
    }

    return {
      sessionId,
      parentNodeId: nodeId,
      children: parsed.children || [],
    };
  }

  calculateNodePositions(
    nodes: AIGeneratedNode[],
    existingCount: number,
  ): CalculateNodePositionsResult[] {
    return nodes
      .filter((node) => node.title && node.title.trim() !== "")
      .map((node, index) => {
        const angle =
          ((existingCount + index) / (existingCount + nodes.length)) *
          Math.PI *
          2;
        const radius = 15 + (existingCount + index) * 2;

        const tempId = node.id || `temp-${index}`;

        const properties = {
          ...(node.backboneModule && { backboneModule: node.backboneModule }),
          ...(node.needsRefinement !== undefined && {
            needsRefinement: node.needsRefinement,
          }),
          ...(node.suggestedContent && {
            suggestedContent: node.suggestedContent,
          }),
          ...(node.color && { color: node.color }),
        };

        return {
          tempId,
          parentId: node.parentId || null,
          title: node.title,
          content: node.content || "",
          summary: node.summary || null,
          level: node.level || "normal",
          x_position: Math.round(Math.cos(angle) * radius),
          y_position: Math.round(Math.sin(angle) * radius),
          properties:
            Object.keys(properties).length > 0 ? properties : undefined,
        };
      });
  }

  async applyTemplate(
    supabase: SupabaseClient,
    params: ApplyTemplateParams,
  ): Promise<ApplyTemplateResult> {
    const {
      template,
      templateId,
      topic,
      style,
      customPrompt,
      graphId,
      providerType,
      model,
      userId,
    } = params;

    if (!template && !templateId) {
      throw new AppError(
        "必须提供 template 或 templateId 参数",
        400,
        ErrorCodes.VALIDATION_ERROR,
      );
    }

    const provider = providerType
      ? await getAIProvider(providerType as AIProviderType)
      : await getAIProviderForTask("text");

    if (!provider.hasKey) {
      throw new AppError(
        "AI provider not configured",
        503,
        ErrorCodes.SYSTEM_INTERNAL_ERROR,
      );
    }

    let selectedTemplate = template;

    if (!selectedTemplate && templateId) {
      const fetchedTemplate = await autoGraphRouteService.getTemplate(
        supabase,
        templateId,
      );
      selectedTemplate = fetchedTemplate as NonNullable<ApplyTemplateParams["template"]>;
    }

    if (!selectedTemplate) {
      throw new AppError("Template not found", 404, ErrorCodes.RESOURCE_TEMPLATE_NOT_FOUND);
    }

    const systemPrompt = await promptService.getRenderedPrompt(
      supabase,
      "apply_template",
      {
        topic,
        template: selectedTemplate,
        style,
        isCustom: style === "custom",
        customPrompt: customPrompt || "",
        isAcademic: style === "academic",
        isPractical: style === "practical",
        isBeginner: style === "beginner",
      },
      userId,
      graphId,
    );

    const completion = await withAIMonitoring(
      {
        operation: "apply_template",
        provider: provider.providerType,
        model: model || provider.model,
        metadata: { graphId, userId },
      },
      async () => {
        const result = await provider.client.chat.completions.create({
          messages: [
            { role: "system", content: systemPrompt },
            {
              role: "user",
              content: `主题：${topic}\n\n模板名称：${selectedTemplate.name}\n模板结构：\n${JSON.stringify(
                {
                  nodes: selectedTemplate.nodes.map(
                    (n: {
                      id: string;
                      title: string;
                      level: string;
                      parentId?: string;
                    }) => ({
                      id: n.id,
                      title: n.title,
                      level: n.level,
                      parentId: n.parentId,
                    }),
                  ),
                  edges: selectedTemplate.edges,
                },
                null,
                2,
              )}\n\n请根据模板结构生成完整的知识图谱内容。`,
            },
          ],
          model: model || provider.model,
          response_format: { type: "json_object" },
          max_tokens: 6000,
        });
        return {
          result,
          usage: result.usage as
            | { prompt_tokens?: number; completion_tokens?: number }
            | undefined,
        };
      },
    );

    const content = completion.choices[0].message.content;
    let parsed;
    try {
      parsed = JSON.parse(content || '{"nodes": [], "edges": []}');
    } catch (e) {
      logger.error("JSON Parse Error in apply-template:", {
        content: content?.slice(-200),
      });
      throw new AppError(
        "AI 生成内容解析失败",
        422,
        ErrorCodes.SYSTEM_INTERNAL_ERROR,
      );
    }

    logger.info("Template applied successfully", {
      topic,
      templateId: selectedTemplate.id,
      nodeCount: parsed.nodes?.length || 0,
      edgeCount: parsed.edges?.length || 0,
    });

    return {
      templateId: selectedTemplate.id,
      templateName: selectedTemplate.name,
      nodes: parsed.nodes || [],
      edges: parsed.edges || [],
      layoutSuggestion: selectedTemplate.layoutSuggestion,
      metadata: {
        topic,
        style,
        generatedAt: new Date().toISOString(),
        provider: provider.providerType,
        model: model || provider.model,
      },
    };
  }
}

export const autoGraphService = new AutoGraphService();

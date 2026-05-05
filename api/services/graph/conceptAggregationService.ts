import { SupabaseClient } from "@supabase/supabase-js";
import { aiService } from "../ai/aiService";
import { logger } from "../../utils/logger";
import type {
  NodeLevel,
  ConceptSource,
  KnowledgePoint,
} from "../../../shared/types/graph";

const SIMILARITY_THRESHOLD = 0.85;
const CORE_LEVEL_THRESHOLD = 2;
const ROOT_LEVEL_THRESHOLD = 5;
const BATCH_SIZE = 50;

export interface SimilarityResult {
  knowledgePointId: string;
  title: string;
  similarity: number;
  sources: ConceptSource[];
}

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

export interface ConceptWithEmbedding {
  id: string;
  title: string;
  content?: string;
  embedding: number[];
  sources?: ConceptSource[];
  level?: NodeLevel;
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
  async calculateSimilarity(
    embedding1: number[],
    embedding2: number[],
  ): Promise<number> {
    return cosineSimilarity(embedding1, embedding2);
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
    const threshold = options.threshold ?? SIMILARITY_THRESHOLD;
    const limit = options.limit ?? 10;

    const { data: kp, error: kpError } = await supabase
      .from("knowledge_points")
      .select("id, title, embedding, properties")
      .eq("id", knowledgePointId)
      .single();

    if (kpError || !kp || !kp.embedding) {
      logger.error(
        `Knowledge point not found or no embedding: ${knowledgePointId}`,
      );
      return [];
    }

    const embedding = kp.embedding as number[];

    let query = supabase
      .from("knowledge_points")
      .select("id, title, embedding, properties")
      .not("id", "eq", knowledgePointId)
      .not("embedding", "is", null);

    if (options.excludeSameGraph && options.graphId) {
      const { data: graphNodes } = await supabase
        .from("graph_nodes")
        .select("knowledge_point_id")
        .eq("graph_id", options.graphId);

      if (graphNodes && graphNodes.length > 0) {
        const excludeIds = graphNodes.map((gn) => gn.knowledge_point_id);
        query = query.not("id", "in", `(${excludeIds.join(",")})`);
      }
    }

    const { data: candidates, error: candidatesError } =
      await query.limit(1000);

    if (candidatesError || !candidates) {
      logger.error(
        "Failed to fetch candidate knowledge points:",
        candidatesError,
      );
      return [];
    }

    const results: SimilarityResult[] = [];

    for (const candidate of candidates) {
      const candidateEmbedding = candidate.embedding as number[];
      const similarity = cosineSimilarity(embedding, candidateEmbedding);

      if (similarity >= threshold) {
        const properties = candidate.properties as {
          sources?: ConceptSource[];
        } | null;
        results.push({
          knowledgePointId: candidate.id,
          title: candidate.title,
          similarity,
          sources: properties?.sources || [],
        });
      }
    }

    results.sort((a, b) => b.similarity - a.similarity);

    return results.slice(0, limit);
  }

  async findSimilarConceptsByTitle(
    supabase: SupabaseClient,
    title: string,
    options: {
      threshold?: number;
      limit?: number;
    } = {},
  ): Promise<SimilarityResult[]> {
    const threshold = options.threshold ?? SIMILARITY_THRESHOLD;
    const limit = options.limit ?? 10;

    const embedding = await aiService.generateEmbedding(title);

    if (!embedding) {
      logger.error("Failed to generate embedding for title:", title);
      return [];
    }

    const { data: candidates, error } = await supabase
      .from("knowledge_points")
      .select("id, title, embedding, properties")
      .not("embedding", "is", null)
      .limit(1000);

    if (error || !candidates) {
      logger.error("Failed to fetch candidate knowledge points:", error);
      return [];
    }

    const results: SimilarityResult[] = [];

    for (const candidate of candidates) {
      const candidateEmbedding = candidate.embedding as number[];
      const similarity = cosineSimilarity(embedding, candidateEmbedding);

      if (similarity >= threshold) {
        const properties = candidate.properties as {
          sources?: ConceptSource[];
        } | null;
        results.push({
          knowledgePointId: candidate.id,
          title: candidate.title,
          similarity,
          sources: properties?.sources || [],
        });
      }
    }

    results.sort((a, b) => b.similarity - a.similarity);

    return results.slice(0, limit);
  }

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

        const similarity = cosineSimilarity(node1.embedding, node2.embedding);

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
          const { data: duplicateGraphNodes } = await supabase
            .from("graph_nodes")
            .select("id")
            .eq("knowledge_point_id", duplicate.id)
            .eq("graph_id", graphId)
            .is("deleted_at", null);

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

    const mergedSources = mergeSources(existingSources, newSources);
    const totalSourceCount = mergedSources.length;

    const oldLevel = (kp.level as NodeLevel) || "normal";
    const newLevel = determineNewLevel(oldLevel, totalSourceCount);

    const { error: updateError } = await supabase
      .from("knowledge_points")
      .update({
        properties: {
          ...properties,
          sources: mergedSources,
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

  async batchCalculateSimilarity(
    supabase: SupabaseClient,
    knowledgePointIds: string[],
  ): Promise<Map<string, SimilarityResult[]>> {
    const result = new Map<string, SimilarityResult[]>();

    const { data: kps, error } = await supabase
      .from("knowledge_points")
      .select("id, title, embedding, properties")
      .in("id", knowledgePointIds)
      .not("embedding", "is", null);

    if (error || !kps) {
      logger.error(
        "Failed to fetch knowledge points for batch similarity:",
        error,
      );
      return result;
    }

    const embeddingMap = new Map<
      string,
      { embedding: number[]; title: string; sources: ConceptSource[] }
    >();

    for (const kp of kps) {
      const embedding = kp.embedding as number[];
      const properties = kp.properties as { sources?: ConceptSource[] } | null;
      embeddingMap.set(kp.id, {
        embedding,
        title: kp.title,
        sources: properties?.sources || [],
      });
    }

    for (const id1 of knowledgePointIds) {
      const data1 = embeddingMap.get(id1);
      if (!data1) {
        result.set(id1, []);
        continue;
      }

      const similarities: SimilarityResult[] = [];

      for (const [id2, data2] of embeddingMap) {
        if (id1 === id2) continue;

        const similarity = cosineSimilarity(data1.embedding, data2.embedding);

        if (similarity >= SIMILARITY_THRESHOLD) {
          similarities.push({
            knowledgePointId: id2,
            title: data2.title,
            similarity,
            sources: data2.sources,
          });
        }
      }

      similarities.sort((a, b) => b.similarity - a.similarity);
      result.set(id1, similarities);
    }

    return result;
  }

  async generateEmbeddingForConcept(
    supabase: SupabaseClient,
    knowledgePointId: string,
  ): Promise<boolean> {
    const { data: kp, error } = await supabase
      .from("knowledge_points")
      .select("title, content")
      .eq("id", knowledgePointId)
      .single();

    if (error || !kp) {
      logger.error(`Knowledge point not found: ${knowledgePointId}`);
      return false;
    }

    const textToEmbed = kp.content
      ? `${kp.title}: ${kp.content.slice(0, 500)}`
      : kp.title;

    const embedding = await aiService.generateEmbedding(textToEmbed);

    if (!embedding) {
      logger.error(`Failed to generate embedding for ${knowledgePointId}`);
      return false;
    }

    const { error: updateError } = await supabase
      .from("knowledge_points")
      .update({ embedding })
      .eq("id", knowledgePointId);

    if (updateError) {
      logger.error(
        `Failed to update embedding for ${knowledgePointId}:`,
        updateError,
      );
      return false;
    }

    return true;
  }

  async generateEmbeddingsBatch(
    supabase: SupabaseClient,
    knowledgePointIds: string[],
  ): Promise<{ processed: number; failed: number }> {
    let processed = 0;
    let failed = 0;

    for (let i = 0; i < knowledgePointIds.length; i += BATCH_SIZE) {
      const batch = knowledgePointIds.slice(i, i + BATCH_SIZE);

      const { data: kps, error } = await supabase
        .from("knowledge_points")
        .select("id, title, content")
        .in("id", batch);

      if (error || !kps) {
        failed += batch.length;
        continue;
      }

      const texts = kps.map((kp) =>
        kp.content ? `${kp.title}: ${kp.content.slice(0, 500)}` : kp.title,
      );

      const embeddings = await aiService.generateEmbeddingsBatch(texts);

      for (let j = 0; j < kps.length; j++) {
        if (embeddings[j]) {
          const { error: updateError } = await supabase
            .from("knowledge_points")
            .update({ embedding: embeddings[j] })
            .eq("id", kps[j].id);

          if (updateError) {
            failed++;
          } else {
            processed++;
          }
        } else {
          failed++;
        }
      }
    }

    logger.info(
      `Batch embedding generation: ${processed} processed, ${failed} failed`,
    );

    return { processed, failed };
  }
}

export const conceptAggregationService = new ConceptAggregationService();

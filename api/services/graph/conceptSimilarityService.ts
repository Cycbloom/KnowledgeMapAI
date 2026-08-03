import { SupabaseClient } from "@supabase/supabase-js";
import { aiService } from "../ai/aiService";
import { logger } from "../../utils/logger";
import { notDeleted } from '../common/softDeleteHelper';
import type {
  ConceptSource,
} from "../../../shared/types/graph";

const SIMILARITY_THRESHOLD = parseFloat(
  process.env.CONCEPT_MERGE_THRESHOLD || "0.85",
);

export interface SimilarityResult {
  knowledgePointId: string;
  title: string;
  similarity: number;
  sources: ConceptSource[];
}

export interface ConceptWithEmbedding {
  id: string;
  title: string;
  content?: string;
  embedding: number[];
  sources?: ConceptSource[];
  level?: import("../../../shared/types/graph").NodeLevel;
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

export class ConceptSimilarityService {
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        query = (query as any).not("id", "in", `(${excludeIds.join(",")})`);
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

    try {
      const { data, error } = await supabase.rpc("match_knowledge_points", {
        query_embedding: embedding,
        match_threshold: threshold,
        match_count: limit + 1,
        p_user_id: userId ?? undefined,
      });

      if (error) {
        logger.warn(
          "pgvector RPC failed, falling back to in-memory search:",
          error,
        );
        if (options.graphId) {
          return this.findSimilarConcepts(supabase, knowledgePointId, {
            threshold,
            limit,
            graphId: options.graphId,
          });
        }
        return this.findSimilarConcepts(supabase, knowledgePointId, {
          threshold,
          limit,
        });
      }

      if (!data || !Array.isArray(data)) {
        return [];
      }

      const results: SimilarityResult[] = [];

      for (const row of data) {
        if (row.id === knowledgePointId) continue;

        const { data: kpData } = await supabase
          .from("knowledge_points")
          .select("properties")
          .eq("id", row.id)
          .single();

        const properties = kpData?.properties as {
          sources?: ConceptSource[];
        } | null;

        results.push({
          knowledgePointId: row.id,
          title: row.title,
          similarity: row.similarity,
          sources: properties?.sources || [],
        });
      }

      return results.slice(0, limit);
    } catch (error) {
      logger.warn("pgvector search failed, falling back to in-memory:", error);
      if (options.graphId) {
        return this.findSimilarConcepts(supabase, knowledgePointId, {
          threshold,
          limit,
          graphId: options.graphId,
        });
      }
      return this.findSimilarConcepts(supabase, knowledgePointId, {
        threshold,
        limit,
      });
    }
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
    const threshold = options.threshold ?? SIMILARITY_THRESHOLD;
    const limit = options.limit ?? 5;

    const { data: userGraphs, error: graphsError } = await supabase
      .from("graphs")
      .select("id, title")
      .eq("user_id", userId)
      .neq("id", graphId);

    if (graphsError || !userGraphs || userGraphs.length === 0) {
      return {};
    }

    const otherGraphIds = userGraphs.map((g) => g.id);
    const graphTitleMap = new Map(
      userGraphs.map((g) => [g.id, g.title || g.id]),
    );

    const { data: graphNodes, error: gnError } = await notDeleted(supabase
      .from("graph_nodes")
      .select(
        `
        graph_id,
        knowledge_point_id,
        knowledge_points (
          id,
          title,
          embedding
        )
      `,
      )
      .in("graph_id", otherGraphIds)
      );

    if (gnError || !graphNodes) {
      logger.error("Failed to fetch cross-graph nodes:", gnError);
      return {};
    }

    const candidates: Array<{
      kpId: string;
      kpTitle: string;
      graphId: string;
      graphTitle: string;
      embedding: number[];
    }> = [];

    for (const gn of graphNodes) {
      const kp = gn.knowledge_points as unknown as {
        id: string;
        title: string;
        embedding?: number[];
      };
      if (kp && kp.embedding) {
        candidates.push({
          kpId: kp.id,
          kpTitle: kp.title,
          graphId: gn.graph_id,
          graphTitle: graphTitleMap.get(gn.graph_id) || gn.graph_id,
          embedding: kp.embedding,
        });
      }
    }

    if (candidates.length === 0) {
      return {};
    }

    const result: Record<
      string,
      Array<{
        kpId: string;
        kpTitle: string;
        graphTitle: string;
        graphId: string;
        similarity: number;
      }>
    > = {};

    for (const concept of conceptEmbeddings) {
      const matchList: Array<{
        kpId: string;
        kpTitle: string;
        graphTitle: string;
        graphId: string;
        similarity: number;
      }> = [];

      for (const candidate of candidates) {
        const similarity = cosineSimilarity(
          concept.embedding,
          candidate.embedding,
        );

        if (similarity >= threshold) {
          matchList.push({
            kpId: candidate.kpId,
            kpTitle: candidate.kpTitle,
            graphTitle: candidate.graphTitle,
            graphId: candidate.graphId,
            similarity: Math.round(similarity * 10000) / 10000,
          });
        }
      }

      matchList.sort((a, b) => b.similarity - a.similarity);

      if (matchList.length > 0) {
        result[concept.title] = matchList.slice(0, limit);
      }
    }

    return result;
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
}

export const conceptSimilarityService = new ConceptSimilarityService();

import { SupabaseClient } from "@supabase/supabase-js";
import { aiService } from "./aiService";
import { logger } from "../../utils/logger";
import { notDeleted } from '../common/softDeleteHelper';

export interface SearchResult {
  graphs: SearchGraphResult[];
  nodes: SearchNodeResult[];
}

export interface SearchGraphResult {
  id: string;
  title: string;
  description: string | null;
  updated_at: string;
  similarity?: number;
}

export interface SearchNodeResult {
  id: string;
  title: string;
  content?: string;
  summary?: string;
  graph_id: string;
  knowledge_graphs?: {
    title: string;
  };
  similarity?: number;
  explanation?: string;
}

export interface SemanticSearchResult {
  graphs: SearchGraphResult[];
  nodes: SearchNodeResult[];
  answer: string;
}

interface GraphNodeSearchRow {
  knowledge_point_id: string;
  graph_id: string;
  knowledge_graphs?: { title: string } | { title: string }[] | null;
}

interface SemanticKpRow {
  id: string;
  title: string;
  content?: string;
  summary?: string;
  similarity?: number;
}

interface SemanticGraphRow {
  id: string;
  title: string;
  description?: string;
  similarity?: number;
}

export class SearchService {
  private escapePattern(pattern: string): string {
    return pattern.replace(/[%_\\]/g, "\\$&");
  }

  async search(supabase: SupabaseClient, query: string): Promise<SearchResult> {
    const pattern = `%${this.escapePattern(query)}%`;

    const [graphsResult, knowledgePointsResult] = await Promise.all([
      supabase
        .from("knowledge_graphs")
        .select("id, title, description, updated_at")
        .ilike("title", pattern)
        .order("updated_at", { ascending: false })
        .limit(5),
      supabase
        .from("knowledge_points")
        .select("id, title, content, owner_id, updated_at")
        .or(`title.ilike.${pattern},content.ilike.${pattern}`)
        .limit(20),
    ]);

    if (graphsResult.error) {
      logger.error("Search graphs error:", graphsResult.error);
    }

    if (knowledgePointsResult.error) {
      logger.error(
        "Search knowledge points error:",
        knowledgePointsResult.error
      );
    }

    const kpIds = (knowledgePointsResult.data || []).map((kp) => kp.id);

    let nodes: SearchNodeResult[] = [];

    if (kpIds.length > 0) {
      const { data: graphNodes, error: gnError } = await notDeleted(supabase
        .from("graph_nodes")
        .select(
          `
          knowledge_point_id,
          graph_id,
          knowledge_graphs (
            title
          )
        `
        )
        .in("knowledge_point_id", kpIds)
        );

      if (gnError) {
        logger.error("Search graph nodes error:", gnError);
      }

      const kpMap = new Map(
        (knowledgePointsResult.data || []).map((kp) => [kp.id, kp])
      );

      nodes = ((graphNodes ?? []) as unknown as GraphNodeSearchRow[]).map((gn) => {
        const kp = kpMap.get(gn.knowledge_point_id);
        const kgRaw = gn.knowledge_graphs;
        const knowledgeGraphs = Array.isArray(kgRaw) ? kgRaw[0] : kgRaw;
        return {
          id: kp?.id || gn.knowledge_point_id,
          title: kp?.title || "",
          content: kp?.content || "",
          graph_id: gn.graph_id,
          knowledge_graphs: knowledgeGraphs ?? undefined,
          updated_at: kp?.updated_at,
        };
      }) as SearchNodeResult[];
    }

    return {
      graphs: (graphsResult.data || []) as SearchGraphResult[],
      nodes,
    };
  }

  async semanticSearch(
    supabase: SupabaseClient,
    query: string,
    userId: string
  ): Promise<SemanticSearchResult> {
    const embedding = await aiService.generateEmbedding(query);

    if (!embedding) {
      return {
        graphs: [],
        nodes: [],
        answer: "",
      };
    }

    const [semanticKPs, semanticGraphs] = await Promise.all([
      supabase.rpc("match_knowledge_points", {
        query_embedding: embedding,
        match_threshold: 0.5,
        match_count: 20,
        p_user_id: userId,
      }),
      supabase.rpc("search_similar_graphs", {
        p_query_embedding: embedding,
        p_user_id: userId,
        p_match_threshold: 0.5,
        p_match_count: 5,
      }),
    ]);

    if (semanticKPs.error) {
      logger.error(
        "Semantic search knowledge points error:",
        semanticKPs.error
      );
    }

    if (semanticGraphs.error) {
      logger.error("Semantic search graphs error:", semanticGraphs.error);
    }

    let nodes: SearchNodeResult[] = [];
    let graphs: SearchGraphResult[] = [];

    if (semanticKPs.data && semanticKPs.data.length > 0) {
      const kpRows = semanticKPs.data as SemanticKpRow[];
      const kpIds = kpRows.map((kp) => kp.id);

      const { data: graphNodes } = await notDeleted(supabase
        .from("graph_nodes")
        .select(
          `
          knowledge_point_id,
          graph_id,
          knowledge_graphs (
            title
          )
        `
        )
        .in("knowledge_point_id", kpIds)
        );

      const gnMap = new Map(
        ((graphNodes ?? []) as unknown as GraphNodeSearchRow[]).map((gn) => [gn.knowledge_point_id, gn])
      );

      nodes = kpRows
        .filter((kp) => gnMap.has(kp.id))
        .map((kp) => {
          const gn = gnMap.get(kp.id);
          const kgRaw = gn?.knowledge_graphs;
          const kgTitle = Array.isArray(kgRaw) ? kgRaw[0]?.title : kgRaw?.title;
          return {
            id: kp.id,
            knowledge_point_id: kp.id,
            title: kp.title,
            content: kp.content,
            summary: kp.summary || "",
            graph_id: gn?.graph_id ?? "",
            graph_title: kgTitle || "",
            similarity: kp.similarity,
          };
        }) as SearchNodeResult[];
    }

    if (semanticGraphs.data && semanticGraphs.data.length > 0) {
      graphs = (semanticGraphs.data as unknown as SemanticGraphRow[]).map((g) => ({
        id: g.id,
        title: g.title,
        description: g.description ?? null,
        updated_at: "",
        similarity: g.similarity,
      }));
    }

    return {
      graphs,
      nodes,
      answer: "",
    };
  }
}

export const searchService = new SearchService();

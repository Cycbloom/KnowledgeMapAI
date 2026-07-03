import { SupabaseClient } from "@supabase/supabase-js";
import { aiService } from "./aiService";
import { logger } from "../../utils/logger";
import { notDeleted } from '../common/softDeleteHelper';

export interface SearchResult {
  graphs: SearchGraphResult[];
  nodes: SearchNodeResult[];
  notes: SearchNoteResult[];
}

export interface SearchGraphResult {
  id: string;
  title: string;
  description: string | null;
  updated_at: string;
  similarity?: number;
}

/**
 * 笔记搜索结果项（P1 Task 5.3）。
 * - summary 为 content 截断摘要（前 200 字符）
 * - 链接路径：/notes/:noteId（前端据此跳转）
 * - similarity: 语义检索相似度（仅 semanticSearch 返回时存在）
 */
export interface SearchNoteResult {
  id: string;
  title: string;
  summary: string;
  type: string;
  updated_at: string;
  tags: string[] | null;
  similarity?: number;
}

export interface SearchNodeResult {
  id: string;
  knowledge_point_id?: string;
  title: string;
  content?: string;
  summary?: string;
  graph_id: string;
  graph_title?: string;
  knowledge_graphs?: {
    title: string;
  };
  similarity?: number;
  explanation?: string;
}

export interface SemanticSearchResult {
  graphs: SearchGraphResult[];
  nodes: SearchNodeResult[];
  notes: SearchNoteResult[];
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

interface NoteSearchRow {
  id: string;
  title: string;
  content: string;
  type: string;
  updated_at: string;
  tags: string[] | null;
}

/**
 * match_notes RPC 返回行（与 34_notes_match_function.sql RETURNS TABLE 对齐）。
 * - id: note_embeddings.id
 * - note_id: 关联笔记 ID（前端跳转用）
 * - chunk_text: 笔记内容快照（用于检索结果摘要）
 * - title: 笔记标题
 * - similarity: 1 - cosine_distance
 */
interface MatchNoteRow {
  id: string;
  note_id: string;
  chunk_text: string | null;
  title: string;
  similarity: number;
}

export class SearchService {
  private escapePattern(pattern: string): string {
    return pattern.replace(/[%_\\]/g, "\\$&");
  }

  async search(supabase: SupabaseClient, query: string): Promise<SearchResult> {
    const pattern = `%${this.escapePattern(query)}%`;

    const [graphsResult, knowledgePointsResult, notesResult] = await Promise.all([
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
      // P1 Task 5.3: 笔记纳入全局搜索（RLS 自动按 user_id 过滤）
      notDeleted(supabase
        .from("notes")
        .select("id, title, content, type, updated_at, tags")
        .or(`title.ilike.${pattern},content.ilike.${pattern}`)
        .order("updated_at", { ascending: false })
        .limit(10)
      ),
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

    if (notesResult.error) {
      logger.error("Search notes error:", notesResult.error);
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
        const kgTitle = knowledgeGraphs?.title || "";
        return {
          id: kp?.id || gn.knowledge_point_id,
          knowledge_point_id: gn.knowledge_point_id,
          title: kp?.title || "",
          content: kp?.content || "",
          graph_id: gn.graph_id,
          graph_title: kgTitle,
          knowledge_graphs: knowledgeGraphs ?? undefined,
          updated_at: kp?.updated_at,
        };
      }) as SearchNodeResult[];
    }

    const notes = this.mapNoteRows(notesResult.data);

    return {
      graphs: (graphsResult.data || []) as SearchGraphResult[],
      nodes,
      notes,
    };
  }

  /**
   * 仅查询笔记（P1 Task 5.3）：用于 ?type=notes 单独搜索笔记。
   * 按标题/内容 LIKE 模糊匹配，RLS 自动按 user_id 过滤。
   */
  async searchNotes(
    supabase: SupabaseClient,
    query: string,
  ): Promise<SearchNoteResult[]> {
    const pattern = `%${this.escapePattern(query)}%`;

    const { data, error } = await notDeleted(supabase
      .from("notes")
      .select("id, title, content, type, updated_at, tags")
      .or(`title.ilike.${pattern},content.ilike.${pattern}`)
      .order("updated_at", { ascending: false })
      .limit(20)
    );

    if (error) {
      logger.error("searchNotes error:", error);
      return [];
    }

    return this.mapNoteRows(data);
  }

  /**
   * 将 notes 表行映射为 SearchNoteResult（content 截断为 200 字符摘要）。
   */
  private mapNoteRows(data: unknown): SearchNoteResult[] {
    if (!Array.isArray(data)) {
      return [];
    }
    return (data as NoteSearchRow[]).map((n) => ({
      id: n.id,
      title: n.title,
      summary: n.content.slice(0, 200),
      type: n.type,
      updated_at: n.updated_at,
      tags: n.tags,
    }));
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
        notes: [],
        answer: "",
      };
    }

    // 三个 RPC 并行调用:knowledge_points / graphs / notes
    // match_notes 失败不阻塞(用 result.error 判定后 notes=[],不影响 graphs/nodes)
    const [semanticKPs, semanticGraphs, semanticNotes] = await Promise.all([
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
      supabase.rpc("match_notes", {
        query_embedding: embedding,
        match_threshold: 0.5,
        match_count: 10,
        p_user_id: userId,
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

    if (semanticNotes.error) {
      // match_notes 失败不阻塞,仅记录日志
      logger.error("Semantic search notes error:", semanticNotes.error);
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

    // 映射 match_notes 返回行为 SearchNoteResult[]
    // - match_notes 不返回 type/updated_at/tags,固定/占位处理
    // - 失败时(error 不为 null)data 为 null,notes 自然为空数组
    const notes: SearchNoteResult[] =
      semanticNotes.error || !semanticNotes.data
        ? []
        : (semanticNotes.data as MatchNoteRow[]).map((row) => ({
            id: row.note_id,
            title: row.title,
            summary: (row.chunk_text ?? "").slice(0, 200),
            type: "note",
            updated_at: "",
            tags: null,
            similarity: row.similarity,
          }));

    return {
      graphs,
      nodes,
      notes,
      answer: "",
    };
  }
}

export const searchService = new SearchService();

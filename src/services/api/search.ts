import { request } from './client';

export interface SearchGraphResult {
  id: string;
  title: string;
  description?: string;
  updated_at: string;
  nodes_count?: number;
  similarity?: number;
}

export interface SearchNodeResult {
  id?: string;
  knowledge_point_id?: string;
  graph_id: string;
  title: string;
  content?: string;
  summary?: string;
  graph_title?: string;
  similarity?: number;
  updated_at?: string;
}

/**
 * 笔记搜索结果项(对齐后端 notes 检索返回)
 * type 字段对应 NoteType:"note" | "daily"
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

export interface SearchResult {
  graphs: SearchGraphResult[];
  nodes: SearchNodeResult[];
  notes?: SearchNoteResult[];
  answer?: string;
}

export const searchApi = {
  search: (query: string): Promise<SearchResult> =>
    request<SearchResult>(`/search?q=${encodeURIComponent(query)}`),

  semanticSearch: (query: string): Promise<SearchResult> =>
    request<SearchResult>(`/search?q=${encodeURIComponent(query)}&type=semantic`),
};

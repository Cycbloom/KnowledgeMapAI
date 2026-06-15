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
  knowledge_point_id: string;
  graph_id: string;
  title: string;
  content?: string;
  summary?: string;
  graph_title: string;
  similarity?: number;
  updated_at?: string;
}

export interface SearchResult {
  graphs: SearchGraphResult[];
  nodes: SearchNodeResult[];
  answer?: string;
}

export const searchApi = {
  search: (query: string): Promise<SearchResult> => 
    request(`/search?q=${encodeURIComponent(query)}`),
  
  semanticSearch: (query: string): Promise<SearchResult> => 
    request(`/search?q=${encodeURIComponent(query)}&type=semantic`),
};

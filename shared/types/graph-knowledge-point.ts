// 知识点相关类型
// KnowledgePoint 及其版本、相似知识点、删除结果等

import type {
  BackboneModule,
  ConceptType,
  KnowledgePointVisibility,
  NodeLevel,
} from "./graph-core";

export interface ConceptSource {
  title: string;
  authors?: string[];
  year?: number;
  url?: string;
  fileName?: string;
  addedAt: string;
}

export interface Keyword {
  term: string;
  importance: number;
  category: string;
  explanation: string;
}

export interface NodeProperties {
  tags?: string[];
  sources?: ConceptSource[];
  conceptType?: ConceptType;
  sourceCount?: number;
  backboneModule?: BackboneModule;
  needsRefinement?: boolean;
  [key: string]: unknown;
}

export interface KnowledgePoint {
  id: string;
  title: string;
  content?: string;
  summary?: string;
  /** 按语言 key 的学习材料，如 {"zh-CN": 中文, "en-US": English}，新增语言只需增加 key */
  learning_material?: Record<string, string>;
  properties?: NodeProperties;
  visibility: KnowledgePointVisibility;
  owner_id: string;
  embedding?: number[];
  created_at: string;
  updated_at: string;
  level?: NodeLevel;
  is_accepted?: boolean;
  /** 按语言 key 的关键词，如 {"zh-CN": [...], "en-US": [...]}，结构与学习材料对应 */
  keywords?: Record<string, Keyword[]>;
  aliases?: string[];
}

export interface KnowledgePointVersion {
  id: string;
  knowledge_point_id: string;
  version_number: number;
  title: string;
  content?: string;
  summary?: string;
  learning_material?: Record<string, string>;
  properties?: NodeProperties;
  change_summary?: string;
  changed_by?: string;
  created_at: string;
  keywords?: Record<string, Keyword[]>;
}

export interface KnowledgePointVersionDiff {
  field: string;
  old_value: unknown;
  new_value: unknown;
}

export interface KnowledgePointVersionWithDiff extends KnowledgePointVersion {
  diffs?: KnowledgePointVersionDiff[];
  previous_version?: KnowledgePointVersion;
}

export interface SimilarKnowledgePoint {
  id: string;
  title: string;
  content?: string;
  similarity: number;
  visibility: KnowledgePointVisibility;
  graphs_count?: number;
}

export interface DeleteKnowledgePointResult {
  success: boolean;
  affected_graphs: number;
  deleted_graph_nodes: number;
  deleted_edges: number;
  deleted_cards: number;
  error?: string;
}

// 图谱实体相关类型
// Graph, ReferenceBook, ExternalLink, GraphBackboneModule

import type { BackboneModule, TemplateType } from "./graph-core";
import type { Domain } from "./graph-domain";

export interface ReferenceBook {
  title: string;
  author: string;
  isbn?: string;
  description?: string;
  url?: string;
  type?: "paper" | "book" | "article" | "document" | "report" | "webpage";
  year?: number;
  journal?: string;
  doi?: string;
  processedAt?: string;
  conceptCount?: number;
}

export interface ExternalLink {
  title: string;
  url: string;
  type: "article" | "video" | "course" | "tool" | "other";
  description?: string;
}

export interface GraphBackboneModule {
  id: string;
  graph_id: string;
  module_type: BackboneModule;
  title: string;
  icon?: string;
  color?: string;
  description?: string;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface Graph {
  id: string;
  title: string;
  description?: string;
  domain?: string;
  domainIds?: string[];
  domains?: Domain[];
  user_id?: string;
  template_type?: TemplateType;
  backbone_modules?: GraphBackboneModule[];
  settings?: {
    gamification_enabled?: boolean;
    learning_direction?: "top_down" | "bottom_up";
    text_display_level?: "all" | "important" | "root_only";
    [key: string]: unknown;
  };
  created_at: string;
  updated_at?: string;
  nodes_count?: number;
  podcast_script?: string;
  is_favorite?: boolean;
  reference_books?: ReferenceBook[];
  external_links?: ExternalLink[];
  learning_guide?: string;
}

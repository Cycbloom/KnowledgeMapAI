// Inline types for Literature API

import type { LiteratureSourceDB } from "@shared/types/graph";

export type ConceptType =
  | "method"
  | "mechanism"
  | "operation"
  | "concept"
  | "technology"
  | "tool"
  | "theory"
  | "finding"
  | "trend"
  | "challenge";

export interface LiteratureMetadata {
  title?: string;
  authors?: string[];
  year?: number;
  type: "paper" | "book" | "article" | "report" | "webpage" | "document";
  journal?: string;
  doi?: string;
  keywords?: string[];
  abstract?: string;
}

export interface LiteratureInfo {
  title: string;
  authors?: string[];
  year?: number;
  url?: string;
  fileName?: string;
  type: "paper" | "book" | "article" | "document" | "report" | "webpage";
  processedAt: string;
  journal?: string;
  doi?: string;
  keywords?: string[];
  abstract?: string;
  volume?: string;
  issue?: string;
  pages?: string;
  publisher?: string;
  notes?: string;
}

export interface ExtractedConcept {
  title: string;
  description: string;
  summary?: string;
  type: ConceptType;
  source: LiteratureInfo;
  targetModule?: unknown;
  similarTo?: string;
  similarity?: number;
  crossGraphMatch?: {
    kpId: string;
    kpTitle: string;
    graphTitle: string;
    graphId: string;
    similarity: number;
  } | null;
}

export interface ExtractedRelation {
  source: string;
  target: string;
  type: string;
  confidence: number;
}

export interface LiteratureExtractRequest {
  content?: string;
  file?: File;
  url?: string;
  graph_id: string;
  literature?: {
    title?: string;
    authors?: string[];
    year?: number;
    url?: string;
    fileName?: string;
    type?: "paper" | "book" | "article" | "document" | "report" | "webpage";
  };
  options?: {
    extractTypes?: ConceptType[];
    maxConcepts?: number;
    preferredCount?: number;
    similarityThreshold?: number;
    autoDetectMetadata?: boolean;
  };
}

export interface LiteratureExtractResponse {
  concepts: ExtractedConcept[];
  relations: ExtractedRelation[];
  literature: LiteratureInfo;
}

export interface LiteratureApplyRequest {
  graph_id: string;
  concepts: ExtractedConcept[];
  relations: ExtractedRelation[];
  literature: LiteratureInfo;
}

export interface LiteratureApplyResponse {
  success: boolean;
  addedCount: number;
  mergedCount: number;
  nodeMapping: Record<string, string>;
}

export interface ILiteratureApi {
  /** 某图谱的文献来源列表（P5 收敛：GraphOutline 原直查 Supabase） */
  listSources(graphId: string): Promise<LiteratureSourceDB[]>;

  extractMetadata(data: {
    content?: string;
    url?: string;
    file?: File;
  }): Promise<{
    metadata: LiteratureMetadata;
    confidence: number;
  }>;

  extractConcepts(
    data: LiteratureExtractRequest & {
      literature?: Partial<LiteratureInfo>;
      autoDetectMetadata?: boolean;
    },
  ): Promise<LiteratureExtractResponse>;

  applyConcepts(data: LiteratureApplyRequest): Promise<LiteratureApplyResponse>;
}

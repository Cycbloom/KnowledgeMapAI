// 文献与概念提取相关类型
// ConceptSource, LiteratureSourceDB, ExtractedConcept, BACKBONE_MODULE_* 常量映射等

import { BackboneModule, type ConceptType } from "./graph-core";

export interface LiteratureSourceDB {
  id: string;
  graphId: string;
  title: string;
  authors?: string[];
  year?: number;
  type: "paper" | "book" | "article" | "report" | "webpage" | "document";
  journal?: string;
  doi?: string;
  url?: string;
  fileName?: string;
  keywords?: string[];
  abstract?: string;
  volume?: string;
  issue?: string;
  pages?: string;
  publisher?: string;
  notes?: string;
  processedAt: string;
  createdAt: string;
  updatedAt: string;
}

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
  targetModule?: BackboneModule;
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

export type ConceptTypeLabelKey =
  | "graphMap.conceptTypes.method"
  | "graphMap.conceptTypes.mechanism"
  | "graphMap.conceptTypes.operation"
  | "graphMap.conceptTypes.concept"
  | "graphMap.conceptTypes.technology"
  | "graphMap.conceptTypes.tool"
  | "graphMap.conceptTypes.theory"
  | "graphMap.conceptTypes.finding"
  | "graphMap.conceptTypes.trend"
  | "graphMap.conceptTypes.challenge";

export const CONCEPT_TYPE_LABELS: Record<ConceptType, ConceptTypeLabelKey> = {
  method: "graphMap.conceptTypes.method",
  mechanism: "graphMap.conceptTypes.mechanism",
  operation: "graphMap.conceptTypes.operation",
  concept: "graphMap.conceptTypes.concept",
  technology: "graphMap.conceptTypes.technology",
  tool: "graphMap.conceptTypes.tool",
  theory: "graphMap.conceptTypes.theory",
  finding: "graphMap.conceptTypes.finding",
  trend: "graphMap.conceptTypes.trend",
  challenge: "graphMap.conceptTypes.challenge",
};

export const CONCEPT_TYPE_COLORS: Record<ConceptType, string> = {
  method: "#3B82F6",
  mechanism: "#10B981",
  operation: "#F59E0B",
  concept: "#8B5CF6",
  technology: "#EC4899",
  tool: "#6366F1",
  theory: "#8B5CF6",
  finding: "#6366F1",
  trend: "#EC4899",
  challenge: "#F59E0B",
};

export type BackboneModuleLabelKey =
  | "graphMap.backboneModules.researchBackground.title"
  | "graphMap.backboneModules.literatureReview.title"
  | "graphMap.backboneModules.researchMethods.title"
  | "graphMap.backboneModules.coreConcepts.title"
  | "graphMap.backboneModules.applicationDomains.title"
  | "graphMap.backboneModules.futureDirections.title";

export type BackboneModuleDescriptionKey =
  | "graphMap.backboneModules.researchBackground.description"
  | "graphMap.backboneModules.literatureReview.description"
  | "graphMap.backboneModules.researchMethods.description"
  | "graphMap.backboneModules.coreConcepts.description"
  | "graphMap.backboneModules.applicationDomains.description"
  | "graphMap.backboneModules.futureDirections.description";

// i18n key mapping for backbone module labels (for frontend t() usage)
export const BACKBONE_MODULE_LABEL_I18N_KEYS: Record<
  BackboneModule,
  BackboneModuleLabelKey
> = {
  [BackboneModule.RESEARCH_BACKGROUND]:
    "graphMap.backboneModules.researchBackground.title",
  [BackboneModule.LITERATURE_REVIEW]:
    "graphMap.backboneModules.literatureReview.title",
  [BackboneModule.RESEARCH_METHODS]:
    "graphMap.backboneModules.researchMethods.title",
  [BackboneModule.CORE_CONCEPTS]: "graphMap.backboneModules.coreConcepts.title",
  [BackboneModule.APPLICATION_DOMAINS]:
    "graphMap.backboneModules.applicationDomains.title",
  [BackboneModule.FUTURE_DIRECTIONS]:
    "graphMap.backboneModules.futureDirections.title",
};

export const BACKBONE_MODULE_LABELS: Record<BackboneModule, string> = {
  [BackboneModule.RESEARCH_BACKGROUND]: "研究背景",
  [BackboneModule.LITERATURE_REVIEW]: "文献综述",
  [BackboneModule.RESEARCH_METHODS]: "研究方法",
  [BackboneModule.CORE_CONCEPTS]: "核心概念",
  [BackboneModule.APPLICATION_DOMAINS]: "应用领域",
  [BackboneModule.FUTURE_DIRECTIONS]: "未来方向",
};

export const BACKBONE_MODULE_COLORS: Record<BackboneModule, string> = {
  [BackboneModule.RESEARCH_BACKGROUND]: "#6366F1",
  [BackboneModule.LITERATURE_REVIEW]: "#8B5CF6",
  [BackboneModule.RESEARCH_METHODS]: "#3B82F6",
  [BackboneModule.CORE_CONCEPTS]: "#10B981",
  [BackboneModule.APPLICATION_DOMAINS]: "#F59E0B",
  [BackboneModule.FUTURE_DIRECTIONS]: "#EC4899",
};

export const BACKBONE_MODULE_TITLES: Record<BackboneModule, string> = {
  [BackboneModule.RESEARCH_BACKGROUND]: "研究背景",
  [BackboneModule.LITERATURE_REVIEW]: "文献综述",
  [BackboneModule.RESEARCH_METHODS]: "研究方法",
  [BackboneModule.CORE_CONCEPTS]: "核心概念",
  [BackboneModule.APPLICATION_DOMAINS]: "应用领域",
  [BackboneModule.FUTURE_DIRECTIONS]: "未来方向",
};

export const TITLE_TO_BACKBONE_MODULE: Record<string, BackboneModule> = {
  研究背景: BackboneModule.RESEARCH_BACKGROUND,
  文献综述: BackboneModule.LITERATURE_REVIEW,
  研究方法: BackboneModule.RESEARCH_METHODS,
  核心概念: BackboneModule.CORE_CONCEPTS,
  应用领域: BackboneModule.APPLICATION_DOMAINS,
  未来方向: BackboneModule.FUTURE_DIRECTIONS,
};

export const BACKBONE_MODULE_ICONS: Record<BackboneModule, string> = {
  [BackboneModule.RESEARCH_BACKGROUND]: "📚",
  [BackboneModule.LITERATURE_REVIEW]: "📄",
  [BackboneModule.RESEARCH_METHODS]: "🔬",
  [BackboneModule.CORE_CONCEPTS]: "💡",
  [BackboneModule.APPLICATION_DOMAINS]: "🎯",
  [BackboneModule.FUTURE_DIRECTIONS]: "🚀",
};

export const BACKBONE_MODULE_DESCRIPTIONS: Record<
  BackboneModule,
  BackboneModuleDescriptionKey
> = {
  [BackboneModule.RESEARCH_BACKGROUND]:
    "graphMap.backboneModules.researchBackground.description",
  [BackboneModule.LITERATURE_REVIEW]:
    "graphMap.backboneModules.literatureReview.description",
  [BackboneModule.RESEARCH_METHODS]:
    "graphMap.backboneModules.researchMethods.description",
  [BackboneModule.CORE_CONCEPTS]:
    "graphMap.backboneModules.coreConcepts.description",
  [BackboneModule.APPLICATION_DOMAINS]:
    "graphMap.backboneModules.applicationDomains.description",
  [BackboneModule.FUTURE_DIRECTIONS]:
    "graphMap.backboneModules.futureDirections.description",
};

export const CONCEPT_TO_MODULE_MAP: Record<ConceptType, BackboneModule> = {
  method: BackboneModule.RESEARCH_METHODS,
  mechanism: BackboneModule.CORE_CONCEPTS,
  operation: BackboneModule.RESEARCH_METHODS,
  concept: BackboneModule.CORE_CONCEPTS,
  technology: BackboneModule.APPLICATION_DOMAINS,
  tool: BackboneModule.RESEARCH_METHODS,
  theory: BackboneModule.LITERATURE_REVIEW,
  finding: BackboneModule.RESEARCH_BACKGROUND,
  trend: BackboneModule.FUTURE_DIRECTIONS,
  challenge: BackboneModule.FUTURE_DIRECTIONS,
};

export interface BackboneModulePreset {
  id: string;
  name: string;
  description: string;
  moduleTypes: string[];
  modules: BackboneModuleCustomConfig[];
}

export interface BackboneModuleCustomConfig {
  module_type: string;
  title: string;
  icon: string;
  color: string;
  description: string;
  suggestedNodes: string[];
  relationshipToCore: string;
}

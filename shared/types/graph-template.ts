// 模板相关类型
// TemplateTypeInfo, TEMPLATE_TYPE_MAP, Template, TemplateNode, TemplateEdge 等

import {
  BackboneModule,
  type LayoutSuggestion,
  type NodeLevel,
  type StoryCreationConfig,
  type TemplateCategory,
  type TemplateDifficulty,
  type TemplateLayoutType,
  type TemplateType,
} from "./graph-core";

export interface TemplateTypeInfo {
  type: TemplateType;
  category: TemplateCategory;
  layoutSuggestion: LayoutSuggestion;
  primaryRelationType: string;
  structureHint: string;
  backboneModules?: BackboneModule[];
  backbonePresetId?: string;
  initLevelOnly?: boolean;
  storyConfig?: StoryCreationConfig;
}

export const TEMPLATE_TYPE_MAP: Record<TemplateType, TemplateTypeInfo> = {
  knowledge_tree: {
    type: "knowledge_tree",
    category: "knowledge",
    layoutSuggestion: "tree",
    primaryRelationType: "prerequisite",
    structureHint: "hierarchical",
  },
  skill_map: {
    type: "skill_map",
    category: "knowledge",
    layoutSuggestion: "network",
    primaryRelationType: "prerequisite",
    structureHint: "network",
  },
  concept_network: {
    type: "concept_network",
    category: "knowledge",
    layoutSuggestion: "network",
    primaryRelationType: "related",
    structureHint: "network",
  },
  learning_path: {
    type: "learning_path",
    category: "knowledge",
    layoutSuggestion: "hierarchical",
    primaryRelationType: "prerequisite",
    structureHint: "linear",
  },
  topic_research: {
    type: "topic_research",
    category: "knowledge",
    layoutSuggestion: "radial",
    primaryRelationType: "related",
    structureHint: "radial_network",
    backboneModules: [
      BackboneModule.RESEARCH_BACKGROUND,
      BackboneModule.LITERATURE_REVIEW,
      BackboneModule.RESEARCH_METHODS,
      BackboneModule.CORE_CONCEPTS,
      BackboneModule.APPLICATION_DOMAINS,
      BackboneModule.FUTURE_DIRECTIONS,
    ],
    initLevelOnly: true,
  },
  project_lifecycle: {
    type: "project_lifecycle",
    category: "project",
    layoutSuggestion: "hierarchical",
    primaryRelationType: "prerequisite",
    structureHint: "timeline",
  },
  dev_workflow: {
    type: "dev_workflow",
    category: "project",
    layoutSuggestion: "hierarchical",
    primaryRelationType: "prerequisite",
    structureHint: "flowchart",
  },
  task_breakdown: {
    type: "task_breakdown",
    category: "project",
    layoutSuggestion: "tree",
    primaryRelationType: "related",
    structureHint: "hierarchical",
  },
  sprint_planning: {
    type: "sprint_planning",
    category: "project",
    layoutSuggestion: "hierarchical",
    primaryRelationType: "prerequisite",
    structureHint: "timeline_hierarchical",
  },
  root_cause: {
    type: "root_cause",
    category: "analysis",
    layoutSuggestion: "radial",
    primaryRelationType: "related",
    structureHint: "radial",
  },
  swot: {
    type: "swot",
    category: "analysis",
    layoutSuggestion: "network",
    primaryRelationType: "related",
    structureHint: "quadrant",
  },
  comparison: {
    type: "comparison",
    category: "analysis",
    layoutSuggestion: "network",
    primaryRelationType: "related",
    structureHint: "grouped",
  },
  decision_tree: {
    type: "decision_tree",
    category: "analysis",
    layoutSuggestion: "tree",
    primaryRelationType: "prerequisite",
    structureHint: "tree",
  },
  tech_ecosystem: {
    type: "tech_ecosystem",
    category: "architecture",
    layoutSuggestion: "network",
    primaryRelationType: "related",
    structureHint: "network",
  },
  org_structure: {
    type: "org_structure",
    category: "architecture",
    layoutSuggestion: "tree",
    primaryRelationType: "related",
    structureHint: "hierarchical",
  },
  system_architecture: {
    type: "system_architecture",
    category: "architecture",
    layoutSuggestion: "network",
    primaryRelationType: "related",
    structureHint: "layered_network",
  },
  knowledge_system: {
    type: "knowledge_system",
    category: "architecture",
    layoutSuggestion: "network",
    primaryRelationType: "cross_domain",
    structureHint: "network",
  },
  blank: {
    type: "blank",
    category: "knowledge",
    layoutSuggestion: "radial",
    primaryRelationType: "related",
    structureHint: "free",
  },
  story_creation: {
    type: "story_creation",
    category: "creative",
    layoutSuggestion: "hierarchical",
    primaryRelationType: "causal",
    structureHint: "narrative_hierarchy",
  },
};

export const TEMPLATE_CATEGORY_TYPES: Record<TemplateCategory, TemplateType[]> =
  {
    knowledge: [
      "knowledge_tree",
      "skill_map",
      "concept_network",
      "learning_path",
    ],
    project: [
      "project_lifecycle",
      "dev_workflow",
      "task_breakdown",
      "sprint_planning",
    ],
    analysis: ["root_cause", "swot", "comparison", "decision_tree"],
    architecture: [
      "tech_ecosystem",
      "org_structure",
      "system_architecture",
      "knowledge_system",
    ],
    creative: ["story_creation"],
  };

export const TOPIC_RESEARCH_PRESET_IDS = [
  "academic_research",
  "experimental_science",
  "engineering_research",
  "policy_research",
] as const;

export type TopicResearchPresetId = (typeof TOPIC_RESEARCH_PRESET_IDS)[number];

export interface TemplateNode {
  id: string;
  title: string;
  description?: string;
  summary?: string;
  level: NodeLevel;
  parentId?: string;
  aiPrompt?: string;
  color?: string;
  x_position?: number;
  y_position?: number;
  position_zone?: string;
}

export interface TemplateEdge {
  source: string;
  target: string;
  relationship_type?: string;
}

export interface TemplateLayout {
  type: TemplateLayoutType;
  showAxes?: boolean;
  showGrid?: boolean;
  showLabels?: boolean;
  axes?: {
    x?: { label?: string; min?: number; max?: number };
    y?: { label?: string; min?: number; max?: number };
  };
  zones?: Array<{
    id: string;
    label: string;
    bounds: { x: number; y: number; width: number; height: number };
    color?: string;
  }>;
  timeline?: {
    direction: "horizontal" | "vertical";
    startLabel?: string;
    endLabel?: string;
  };
}

export interface GenerationConfig {
  style?: "academic" | "casual" | "professional" | "creative";
  depth?: "overview" | "detailed" | "comprehensive";
  language?: string;
  target_audience?: string;
  content_focus?: string[];
  custom_instructions?: string;
}

export interface PreviewData {
  thumbnail_url?: string;
  sample_nodes?: Array<{
    id: string;
    title: string;
    level: NodeLevel;
  }>;
  sample_edges?: Array<{
    source: string;
    target: string;
  }>;
  node_count?: number;
  edge_count?: number;
}

export interface Template {
  id: string;
  name: string;
  description?: string;
  category: TemplateCategory;
  template_type?: TemplateType;
  is_system: boolean;
  user_id?: string;
  nodes: TemplateNode[];
  edges: TemplateEdge[];
  layout?: TemplateLayout;
  generation_config?: GenerationConfig;
  preview_data?: PreviewData;
  tags?: string[];
  difficulty?: TemplateDifficulty;
  estimated_nodes?: number;
  layout_suggestion?: LayoutSuggestion;
  preview_image?: string;
  created_at?: string;
  updated_at?: string;
}

export interface CreateTemplateData {
  name: string;
  description?: string;
  category: TemplateCategory;
  template_type?: TemplateType;
  nodes: TemplateNode[];
  edges: TemplateEdge[];
  layout?: TemplateLayout;
  generation_config?: GenerationConfig;
  preview_data?: PreviewData;
  tags?: string[];
  difficulty?: TemplateDifficulty;
  estimated_nodes?: number;
  layout_suggestion?: LayoutSuggestion;
}

export interface UpdateTemplateData {
  name?: string;
  description?: string;
  category?: TemplateCategory;
  template_type?: TemplateType;
  nodes?: TemplateNode[];
  edges?: TemplateEdge[];
  layout?: TemplateLayout;
  generation_config?: GenerationConfig;
  preview_data?: PreviewData;
  tags?: string[];
  difficulty?: TemplateDifficulty;
  estimated_nodes?: number;
  layout_suggestion?: LayoutSuggestion;
}

export interface CreateGraphFromTemplateData {
  template_id: string;
  title: string;
  description?: string;
}

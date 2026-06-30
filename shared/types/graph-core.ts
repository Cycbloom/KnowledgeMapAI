// 图谱基础类型别名和枚举
// 被多个子领域共用的基础类型定义

export type NodeLevel = "root" | "core" | "sub" | "normal" | "leaf";

export type KnowledgePointVisibility = "private" | "public" | "pending";

export type EdgeLineStyle = "solid" | "dashed" | "dotted" | "double";

export type RelationshipCategory =
  | "hierarchical"
  | "dependency"
  | "semantic"
  | "temporal"
  | "interaction"
  | "causal"
  | "custom";

export type LearningStatus =
  | "mastered"
  | "due"
  | "locked"
  | "new"
  | "learning";

export type GraphViewMode =
  | "mindmap"
  | "timeline"
  | "tree"
  | "planet"
  | "quadrant"
  | "semantic";

export type GraphColorMode = "level" | "status" | "heatmap" | "decay";

export type NodeSizeMode = "fixed" | "importance" | "degree" | "children";

export type EdgeWidthMode = "fixed" | "strength" | "relationship";

export type ExplorationMode = "none" | "branch" | "timeline";

export type TemplateCategory =
  | "knowledge"
  | "project"
  | "analysis"
  | "architecture"
  | "creative";

export type TemplateType =
  | "knowledge_tree"
  | "skill_map"
  | "concept_network"
  | "learning_path"
  | "topic_research"
  | "project_lifecycle"
  | "dev_workflow"
  | "task_breakdown"
  | "sprint_planning"
  | "root_cause"
  | "swot"
  | "comparison"
  | "decision_tree"
  | "tech_ecosystem"
  | "org_structure"
  | "system_architecture"
  | "knowledge_system"
  | "story_creation"
  | "blank";

export enum BackboneModule {
  RESEARCH_BACKGROUND = "research_background",
  LITERATURE_REVIEW = "literature_review",
  RESEARCH_METHODS = "research_methods",
  CORE_CONCEPTS = "core_concepts",
  APPLICATION_DOMAINS = "application_domains",
  FUTURE_DIRECTIONS = "future_directions",
}

export interface StoryCreationConfig {
  genre?: string;
  coreConflict?: string;
  characterHints?: string;
}

export type TemplateLayoutType =
  | "default"
  | "quadrant"
  | "timeline"
  | "flowchart"
  | "mindmap";

export type TemplateDifficulty = "easy" | "medium" | "hard";

export type LayoutSuggestion = "radial" | "tree" | "network" | "hierarchical";

export type GraphRelationType =
  | "prerequisite"
  | "extension"
  | "related"
  | "cross_domain";

export type RelationSource = "manual" | "ai_discovered" | "ai_suggested";

export type LearningOrder = "source_first" | "target_first" | "parallel";

export type CombinedViewLayoutMode = "grouped" | "merged" | "network";

export type SplitDirection = "horizontal" | "vertical";

export type CollaboratorRole = "owner" | "editor" | "viewer";

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

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

export type LearningStatus = "mastered" | "due" | "locked" | "new" | "learning";

export type GraphViewMode = "mindmap" | "timeline" | "tree" | "planet";

export type GraphColorMode = "level" | "status";

export type NodeSizeMode = "fixed" | "importance" | "degree" | "children";

export type EdgeWidthMode = "fixed" | "strength" | "relationship";

export type ExplorationMode = "none" | "branch" | "timeline";

export type TemplateCategory =
  | "knowledge"
  | "project"
  | "analysis"
  | "architecture";

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
  | "blank";

export interface TemplateTypeInfo {
  type: TemplateType;
  category: TemplateCategory;
  layoutSuggestion: LayoutSuggestion;
  primaryRelationType: string;
  structureHint: string;
  backboneModules?: BackboneModule[];
  initLevelOnly?: boolean;
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
      "research_background",
      "literature_review",
      "research_methods",
      "core_concepts",
      "application_domains",
      "future_directions",
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
};

export const TEMPLATE_CATEGORY_TYPES: Record<TemplateCategory, TemplateType[]> =
  {
    knowledge: [
      "knowledge_tree",
      "skill_map",
      "concept_network",
      "learning_path",
      "topic_research",
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
  };

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

export interface NodeProperties {
  tags?: string[];
  sources?: ConceptSource[];
  conceptType?: ConceptType;
  sourceCount?: number;
  backboneModule?: BackboneModule;
  needsRefinement?: boolean;
  [key: string]: unknown;
}

export interface Keyword {
  term: string;
  importance: number;
  category: string;
  explanation: string;
}

export interface KnowledgePoint {
  id: string;
  title: string;
  content?: string;
  learning_material?: string;
  properties?: NodeProperties;
  visibility: KnowledgePointVisibility;
  owner_id: string;
  embedding?: number[];
  created_at: string;
  updated_at: string;
  level?: NodeLevel;
  is_accepted?: boolean;
  keywords?: Keyword[];
}

export interface KnowledgePointVersion {
  id: string;
  knowledge_point_id: string;
  version_number: number;
  title: string;
  content?: string;
  learning_material?: string;
  properties?: NodeProperties;
  change_summary?: string;
  changed_by?: string;
  created_at: string;
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

export interface ReferenceBook {
  title: string;
  author: string;
  isbn?: string;
  description?: string;
  url?: string;
}

export interface ExternalLink {
  title: string;
  url: string;
  type: "article" | "video" | "course" | "tool" | "other";
  description?: string;
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

export interface Domain {
  id: string;
  name: string;
  description?: string;
  color: string;
  icon?: string;
  parent_id?: string | null;
  sort_order: number;
  user_id?: string;
  is_system: boolean;
  children?: DomainTreeNode[];
  graphCount?: number;
  created_at: string;
  updated_at: string;
}

export interface DomainTreeNode {
  id: string;
  name: string;
  description?: string;
  color: string;
  icon?: string;
  parent_id?: string | null;
  sort_order: number;
  is_system: boolean;
  children: DomainTreeNode[];
  graphCount?: number;
}

export interface GraphDomain {
  id: string;
  graph_id: string;
  domain_id: string;
  is_primary: boolean;
  created_at: string;
}

export interface GraphNode {
  id: string;
  graph_id: string;
  knowledge_point_id: string;
  x_position: number;
  y_position: number;
  level: NodeLevel;
  is_accepted: boolean;
  deleted_at?: string;
  created_at: string;
  updated_at: string;
}

export interface KnowledgePointWithGraphs extends KnowledgePoint {
  graph_nodes?: GraphNode[];
  graphs_count?: number;
}

export type GraphNodeWithKnowledgePoint = GraphNode &
  Omit<KnowledgePoint, "id">;

export type Node = GraphNode &
  Omit<KnowledgePoint, "id"> & {
    tags?: string[];
  };

export interface RelationshipTypeConfig {
  id: string;
  name: string;
  display_name: string;
  category: RelationshipCategory;
  color: string;
  line_style: EdgeLineStyle;
  show_arrow: boolean | "auto";
  is_builtin: boolean;
  user_id?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Edge {
  id: string;
  graph_id: string;
  source_knowledge_point_id: string;
  target_knowledge_point_id: string;
  relationship_type?: string;
  weight?: number;
  custom_label?: string;
  custom_color?: string;
  custom_line_style?: EdgeLineStyle;
  show_arrow?: boolean | null;
  deleted_at?: string;
  created_at?: string;
}

export interface NodeStatus {
  locked: boolean;
  mastered: boolean;
  due_today?: boolean;
  due?: boolean;
  review_count?: number;
  next_review?: string;
}

export interface LayoutNode extends Node {
  x: number;
  y: number;
  vx?: number;
  vy?: number;
  fx?: number | null;
  fy?: number | null;
}

export interface LayoutLink extends Edge {
  source: string | LayoutNode;
  target: string | LayoutNode;
}

export interface NodeImportance {
  score: number;
  factors: {
    degree: number;
    childrenCount: number;
    level: number;
    contentLength: number;
  };
}

export interface EdgeStrength {
  score: number;
  factors: {
    relationshipType: string;
    commonConnections: number;
    pathCount: number;
  };
}

export interface TemplateNode {
  id: string;
  title: string;
  description?: string;
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

export interface GraphRelation {
  id: string;
  source_graph_id: string;
  target_graph_id: string;
  relation_type: GraphRelationType;
  context?: string;
  metadata?: Record<string, unknown>;
  confidence?: number;
  source?: RelationSource;
  shared_concepts?: string[];
  created_at: string;
  source_graph?: Graph | Graph[];
  target_graph?: Graph | Graph[];
}

export interface GraphMapData {
  graphs: Array<Graph & { node_count?: number }>;
  relations: GraphRelation[];
}

export type GraphMapFilterMode =
  | "all"
  | "prerequisite"
  | "extension"
  | "related";

export const GRAPH_RELATION_COLORS: Record<GraphRelationType, string> = {
  prerequisite: "#3B82F6",
  extension: "#10B981",
  related: "#F59E0B",
  cross_domain: "#8B5CF6",
};

export const GRAPH_RELATION_LABELS: Record<GraphRelationType, string> = {
  prerequisite: "前置知识",
  extension: "扩展知识",
  related: "相关知识",
  cross_domain: "跨学科",
};

export interface DiscoveredRelation {
  source_graph_id: string;
  source_graph_title: string;
  target_graph_id: string;
  target_graph_title: string;
  relation_type: GraphRelationType;
  confidence: number;
  reason: string;
  shared_concepts: string[];
  suggested_learning_order?: LearningOrder;
}

export interface CrossDomainInsight {
  domains: string[];
  intersection_topics: string[];
  description: string;
  related_graph_ids: string[];
}

export interface DiscoveryResult {
  discovered_relations: DiscoveredRelation[];
  cross_domain_insights: CrossDomainInsight[];
  analysis_summary: {
    total_graphs_analyzed: number;
    relations_discovered: number;
    cross_domain_clusters: number;
    isolated_graphs: string[];
  };
}

export interface LearningPathSuggestion {
  path: string[];
  description: string;
  estimated_time: string;
  difficulty: "beginner" | "intermediate" | "advanced";
}

export interface KnowledgeGap {
  missing_topic: string;
  related_graphs: string[];
  importance: "high" | "medium" | "low";
  suggested_action: "create" | "merge" | "expand";
}

export interface CrossDomainOpportunity {
  domains: string[];
  intersection_graphs: string[];
  potential_benefits: string;
  recommended_order: string[];
}

export interface IntelligentSuggestion {
  learning_path_suggestions: LearningPathSuggestion[];
  knowledge_gaps: KnowledgeGap[];
  cross_domain_opportunities: CrossDomainOpportunity[];
}

export interface GraphRecommendation {
  graph_id: string;
  graph_title: string;
  recommendation_type: GraphRelationType;
  confidence: number;
  reason: string;
}

export interface CombinedViewGraph {
  graph_id: string;
  graph_title: string;
  color: string;
  nodes: GraphNodeWithKnowledgePoint[];
  edges: Edge[];
}

export interface CombinedViewData {
  graphs: CombinedViewGraph[];
  shared_knowledge_points: Array<{
    knowledge_point_id: string;
    knowledge_point: KnowledgePoint;
    graph_nodes: GraphNode[];
  }>;
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

export interface CrossGraphNodeConnection {
  id: string;
  knowledge_point_id: string;
  node1: {
    id: string;
    title: string;
    graph_id: string;
    x_position: number;
    y_position: number;
  };
  node2: {
    id: string;
    title: string;
    graph_id: string;
    x_position: number;
    y_position: number;
  };
  connection_type: "same_knowledge_point" | "similar_content";
  similarity?: number;
}

export interface CrossGraphRelationData {
  graph1: {
    id: string;
    title: string;
    node_count: number;
  };
  graph2: {
    id: string;
    title: string;
    node_count: number;
  };
  graph_relations: GraphRelation[];
  cross_graph_connections: CrossGraphNodeConnection[];
  exported_at: string;
}

export type SplitDirection = "horizontal" | "vertical";

export interface CombinedGraphViewData {
  graph1: Graph;
  graph2: Graph;
  relations: GraphRelation[];
}

export type CollaboratorRole = "owner" | "editor" | "viewer";

export interface GraphCollaborator {
  id: string;
  graph_id: string;
  user_id: string;
  role: CollaboratorRole;
  invited_by?: string;
  invitation_token: string;
  invited_at: string;
  accepted_at?: string;
  created_at: string;
  updated_at: string;
  user?: {
    id: string;
    email: string;
    name?: string;
  };
}

export interface InviteCollaboratorRequest {
  email: string;
  role: CollaboratorRole;
}

export interface UpdateCollaboratorRoleRequest {
  role: CollaboratorRole;
}

export interface CollaboratorWithUser extends GraphCollaborator {
  user: {
    id: string;
    email: string;
    name?: string;
  };
}

export interface GraphWithCollaborators extends Graph {
  collaborators?: CollaboratorWithUser[];
  user_role?: CollaboratorRole;
}

export const COLLABORATOR_ROLE_LABELS: Record<CollaboratorRole, string> = {
  owner: "所有者",
  editor: "编辑者",
  viewer: "查看者",
};

export const COLLABORATOR_ROLE_COLORS: Record<CollaboratorRole, string> = {
  owner: "#EF4444",
  editor: "#3B82F6",
  viewer: "#6B7280",
};

export type ConceptType =
  | "method"
  | "mechanism"
  | "operation"
  | "concept"
  | "technology"
  | "tool";

export type BackboneModule =
  | "research_background"
  | "literature_review"
  | "research_methods"
  | "core_concepts"
  | "application_domains"
  | "future_directions";

export interface ConceptSource {
  title: string;
  authors?: string[];
  year?: number;
  url?: string;
  fileName?: string;
  addedAt: string;
}

export interface LiteratureInfo {
  title: string;
  authors?: string[];
  year?: number;
  url?: string;
  fileName?: string;
  type: "paper" | "book" | "article" | "document";
  processedAt: string;
}

export interface ExtractedConcept {
  title: string;
  description: string;
  type: ConceptType;
  source: LiteratureInfo;
  targetModule?: BackboneModule;
  similarTo?: string;
  similarity?: number;
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
  options?: {
    extractTypes?: ConceptType[];
    maxConcepts?: number;
    similarityThreshold?: number;
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

export const CONCEPT_TYPE_LABELS: Record<ConceptType, string> = {
  method: "方法",
  mechanism: "机制",
  operation: "操作",
  concept: "概念",
  technology: "技术",
  tool: "工具",
};

export const CONCEPT_TYPE_COLORS: Record<ConceptType, string> = {
  method: "#3B82F6",
  mechanism: "#10B981",
  operation: "#F59E0B",
  concept: "#8B5CF6",
  technology: "#EC4899",
  tool: "#6366F1",
};

export const BACKBONE_MODULE_LABELS: Record<BackboneModule, string> = {
  research_background: "研究背景",
  literature_review: "文献综述",
  research_methods: "研究方法",
  core_concepts: "核心概念",
  application_domains: "应用领域",
  future_directions: "未来方向",
};

export const BACKBONE_MODULE_COLORS: Record<BackboneModule, string> = {
  research_background: "#6366F1",
  literature_review: "#8B5CF6",
  research_methods: "#3B82F6",
  core_concepts: "#10B981",
  application_domains: "#F59E0B",
  future_directions: "#EC4899",
};

export const CONCEPT_TO_MODULE_MAP: Record<ConceptType, BackboneModule> = {
  method: "research_methods",
  mechanism: "core_concepts",
  operation: "research_methods",
  concept: "core_concepts",
  technology: "application_domains",
  tool: "research_methods",
};

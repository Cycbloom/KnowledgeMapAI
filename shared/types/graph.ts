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
  | "learning"
  | "story"
  | "project"
  | "analysis"
  | "custom";

export type TemplateLayoutType =
  | "default"
  | "quadrant"
  | "timeline"
  | "flowchart"
  | "mindmap";

export type GraphRelationType = "prerequisite" | "extension" | "related";

export type CombinedViewLayoutMode = "grouped" | "merged" | "network";

export interface NodeProperties {
  tags?: string[];
  [key: string]: unknown;
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
}

export interface Graph {
  id: string;
  title: string;
  description?: string;
  user_id?: string;
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

export interface Template {
  id: string;
  name: string;
  description?: string;
  category: TemplateCategory;
  is_system: boolean;
  user_id?: string;
  nodes: TemplateNode[];
  edges: TemplateEdge[];
  layout?: TemplateLayout;
  preview_image?: string;
  created_at?: string;
  updated_at?: string;
}

export interface CreateTemplateData {
  name: string;
  description?: string;
  category: TemplateCategory;
  nodes: TemplateNode[];
  edges: TemplateEdge[];
  layout?: TemplateLayout;
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
};

export const GRAPH_RELATION_LABELS: Record<GraphRelationType, string> = {
  prerequisite: "前置知识",
  extension: "扩展知识",
  related: "相关知识",
};

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

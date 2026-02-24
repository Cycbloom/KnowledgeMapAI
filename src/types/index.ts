export interface AIConfig {
  provider: string;
  model: string;
}

export interface AvailableModels {
  deepseek: string[];
  volcengine: string[];
  aliyun: string[];
  [key: string]: string[];
}

export interface User {
  id: string;
  email: string;
  name?: string;
  user_metadata?: {
    name?: string;
    avatar_url?: string;
    theme?: string;
    [key: string]: unknown;
  };
  profile?: {
    xp?: number;
    level?: number;
    settings?: {
      request_retention?: number;
      maximum_interval?: number;
      ai_config?: {
        text?: AIConfig;
        embedding?: AIConfig;
        reasoning?: AIConfig;
      };
      available_models?: AvailableModels;
    };
    [key: string]: unknown;
  };
}

export interface Graph {
  id: string;
  title: string;
  description?: string;
  user_id?: string;
  settings?: {
    gamification_enabled?: boolean;
    learning_direction?: 'top_down' | 'bottom_up';
    text_display_level?: 'all' | 'important' | 'root_only';
    [key: string]: unknown;
  };
  created_at: string;
  updated_at?: string;
  nodes_count?: number;
  podcast_script?: string;
  is_favorite?: boolean;
}

export type NodeLevel = 'root' | 'core' | 'sub' | 'normal' | 'leaf';

export type KnowledgePointVisibility = 'private' | 'public' | 'pending';

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

export type GraphNodeWithKnowledgePoint = GraphNode & Omit<KnowledgePoint, 'id'>;

/**
 * 前端节点类型，用于图编辑器中的节点展示和操作
 * 
 * 扁平化设计：合并 GraphNode 和 KnowledgePoint 的所有字段
 * 
 * ID 字段说明：
 * - id: 设置为 knowledge_point_id，与 Edge 的关联方式兼容
 * - knowledge_point_id: 关联的知识点 ID（继承自 GraphNode）
 * 
 * 字段来源：
 * - 来自 GraphNode: id, graph_id, knowledge_point_id, x_position, y_position, level, is_accepted, deleted_at, created_at, updated_at
 * - 来自 KnowledgePoint: title, content, learning_material, properties, visibility, owner_id, embedding, level?, is_accepted?
 * 
 * @example
 * // 统一的访问方式
 * const title = node.title;
 * const content = node.content;
 * const properties = node.properties;
 */
export type Node = GraphNode & Omit<KnowledgePoint, 'id'> & {
  tags?: string[];
};

export interface Edge {
  id: string;
  graph_id: string;
  source_knowledge_point_id: string;
  target_knowledge_point_id: string;
  relationship_type?: string;
  weight?: number;
  deleted_at?: string;
  created_at?: string;
}

export interface StudyCard {
  id: string;
  knowledge_point_id: string;
  user_id: string;
  graph_id: string;
  source_graph_id?: string;
  question: string;
  answer: string;
  card_type: 'qa' | 'choice' | 'true_false' | 'multi_choice' | 'fill_in_the_blank' | 'essay';
  options?: string[];
  explanation?: string;
  difficulty?: number;
  last_reviewed?: string;
  next_review: string;
  review_count?: number;
  fsrs_state?: number;
  fsrs_stability?: number;
  fsrs_difficulty?: number;
  fsrs_elapsed_days?: number;
  fsrs_scheduled_days?: number;
  fsrs_retrievability?: number;
  fsrs_last_review?: string;
  created_at?: string;
}

export interface TaskPayload {
  node_id?: string;
  graph_id?: string;
  count?: number;
  depth?: number;
  node_ids?: string[];
  [key: string]: unknown;
}

export interface TaskResult {
  nodes?: Array<{ id: string; title: string }>;
  cards?: Array<{ id: string; question: string }>;
  error?: string;
  [key: string]: unknown;
}

export interface Task {
  id: string;
  user_id: string;
  type: 'generate_questions' | 'expand_graph' | 'batch_generate_questions' | string;
  name?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | string;
  payload: TaskPayload;
  result: TaskResult;
  error?: string;
  created_at: string;
  updated_at: string;
}

export interface Achievement {
  id: string;
  code: string;
  name: string;
  description: string;
  category: 'study' | 'focus' | 'creation';
  icon: string;
  xp_reward: number;
  condition_type: string;
  condition_value: number;
  unlocked_at?: string;
}

export interface UserProfile extends User {
  xp: number;
  level: number;
  role?: 'admin' | 'user';
}

export interface DailyTask {
  id: string;
  user_id: string;
  task_date: string;
  task_type: 'login' | 'study_cards' | 'focus_time' | 'create_node';
  status: 'pending' | 'completed';
  progress: number;
  target: number;
  xp_reward: number;
  completed_at?: string;
}

export type LearningStatus = 'mastered' | 'due' | 'locked' | 'new' | 'learning';

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

export type NodeStyleVariant = 'single' | 'double' | 'triple' | 'dashed' | 'dotted' | 'gradient' | 'filled' | 'outlined' | 'gradient-fill';

export type NodeShape = 'circle' | 'square' | 'diamond' | 'hexagon' | 'star';

export type CenterDotShape = 'circle' | 'diamond' | 'star' | 'none';

export type LinkStyle = 'curved' | 'straight' | 'step' | 'bezier';

export type LinkAnimation = 'none' | 'flow' | 'pulse' | 'dash';

export type ColorScheme = 'default' | 'nature' | 'ocean' | 'sunset' | 'forest' | 'custom';

export type ThemePreset = 'minimal' | 'colorful' | 'professional' | 'custom';

export interface ShadowConfig {
  enabled: boolean;
  blur: number;
  offsetX: number;
  offsetY: number;
  color: string;
}

export interface AnimationConfig {
  hoverScale: number;
  hoverGlow: boolean;
  transitionDuration: number;
  enablePulse: boolean;
  pulseSpeed: number;
}

export interface GradientConfig {
  enabled: boolean;
  type: 'linear' | 'radial';
  colors: string[];
  angle?: number;
}

export interface NodeStyle {
  variant: NodeStyleVariant;
  rings: number;
  radius: number;
  strokeWidth: number;
  showCenterDot: boolean;
  showGlow: boolean;
  shape: NodeShape;
  centerDotShape: CenterDotShape;
  shadow: ShadowConfig;
  animation: AnimationConfig;
  ringSpacing: number;
  gradient: GradientConfig;
}

export type ExplorationMode = 'none' | 'branch' | 'timeline';

export type GraphViewMode = 'mindmap' | 'timeline' | 'tree' | 'planet';

export type GraphColorMode = 'level' | 'status';

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

export type NodeSizeMode = 'fixed' | 'importance' | 'degree' | 'children';
export type EdgeWidthMode = 'fixed' | 'strength' | 'relationship';

export interface BranchSuggestion {
  id: string;
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  estimatedDifficulty: number;
  relatedTopics: string[];
}

export interface ExplorationPathItem {
  nodeId: string;
  nodeTitle: string;
  timestamp: Date;
  branchChoice: string;
  parentNodeId?: string;
  branchSuggestionId?: string;
  alternativeBranches?: BranchSuggestion[];
}

export type TemplateCategory = 'learning' | 'story' | 'project' | 'analysis' | 'custom';

export type TemplateLayoutType = 'default' | 'quadrant' | 'timeline' | 'flowchart' | 'mindmap';

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
    direction: 'horizontal' | 'vertical';
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

export type TutorMode = 'free' | 'guided' | 'learning-path';

export interface ExtractedConcept {
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
}

export interface TutorSession {
  id: string;
  mode: TutorMode;
  currentTopic?: string;
  startTime: Date;
  messages: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
  }>;
  extractedConcepts: ExtractedConcept[];
  suggestedTopics: string[];
}

export interface TutorContext {
  graphId?: string;
  currentNodeId?: string;
  currentNodeTitle?: string;
  currentNodeContent?: string;
  existingNodes?: string[];
  userProgress?: {
    masteredCount: number;
    dueCount: number;
    currentLevel: string;
  };
  mode?: TutorMode;
  learningPath?: string[];
}

export type TTSEngine = 'browser' | 'qwen3';

export interface TTSConfig {
  engine: TTSEngine;
  voice?: string;
  speed?: number;
  outputFormat?: 'mp3' | 'wav';
}

export interface TTSVoice {
  id: string;
  name: string;
  lang: string;
}

export type GraphRelationType = 'prerequisite' | 'extension' | 'related';

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

export type GraphMapFilterMode = 'all' | 'prerequisite' | 'extension' | 'related';

export const GRAPH_RELATION_COLORS: Record<GraphRelationType, string> = {
  prerequisite: '#3B82F6',
  extension: '#10B981',
  related: '#F59E0B',
};

export const GRAPH_RELATION_LABELS: Record<GraphRelationType, string> = {
  prerequisite: '前置知识',
  extension: '扩展知识',
  related: '相关知识',
};

export interface GraphRecommendation {
  graph_id: string;
  graph_title: string;
  recommendation_type: GraphRelationType;
  confidence: number;
  reason: string;
}

export interface MapAnalysisResult {
  isolated_graphs: Array<{ id: string; title: string }>;
  missing_prerequisites: Array<{
    graph_id: string;
    graph_title: string;
    suggested_topics: string[];
  }>;
  suggested_paths: Array<{
    from: string;
    from_title: string;
    to: string;
    to_title: string;
    via: string[];
  }>;
  merge_suggestions: Array<{
    graph_ids: string[];
    graph_titles: string[];
    reason: string;
  }>;
}

export interface QuickCreateGraphRequest {
  title: string;
  description?: string;
  relation_to?: {
    graph_id: string;
    type: GraphRelationType;
  };
  auto_generate_content?: boolean;
}

export interface InfiniteExpansionRequest {
  max_depth?: number;
  max_graphs_per_level?: number;
  relation_types?: GraphRelationType[];
  auto_generate_nodes?: boolean;
  node_depth?: number;
}

export interface InfiniteExpansionProgress {
  status: 'pending' | 'running' | 'completed' | 'failed';
  current_depth: number;
  total_graphs_created: number;
  total_nodes_created: number;
  current_graph_title?: string;
  created_graphs: Array<{
    id: string;
    title: string;
    relation_type: GraphRelationType;
    depth: number;
    node_count?: number;
  }>;
  errors: Array<{ message: string }>;
}

export interface InfiniteExpansionResult {
  task_id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  total_graphs_created: number;
  total_nodes_created: number;
  created_graphs: Array<{
    id: string;
    title: string;
    relation_type: GraphRelationType;
    depth: number;
    node_count: number;
  }>;
}

export type CombinedViewLayoutMode = 'grouped' | 'merged' | 'network';

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

export type LearningPathGoalType = 'natural_language' | 'graph_node' | 'template';
export type LearningPathStatus = 'active' | 'completed' | 'paused' | 'archived';
export type LearningPathNodeStatus = 'pending' | 'in_progress' | 'completed' | 'skipped';
export type LearningResourceType = 'article' | 'video' | 'book' | 'course' | 'exercise' | 'user_upload';
export type LearningResourceSource = 'ai_recommended' | 'user_added';

export interface LearningPath {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  goal_type: LearningPathGoalType;
  goal_content?: string;
  target_knowledge_point_id?: string;
  template_id?: string;
  status: LearningPathStatus;
  total_nodes: number;
  completed_nodes: number;
  progress_percentage: number;
  estimated_hours?: number;
  daily_minutes_target?: number;
  target_completion_date?: string;
  settings?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface LearningPathNodeRef {
  id: string;
  path_id: string;
  node_id: string;
  node?: Node;
  status: LearningPathNodeStatus;
  user_notes?: string;
  estimated_minutes: number;
  difficulty_level: number;
  completed_at?: string;
  created_at: string;
  updated_at: string;
}

export interface LearningResource {
  id: string;
  node_ref_id: string;
  resource_type: LearningResourceType;
  title?: string;
  url?: string;
  description?: string;
  source: LearningResourceSource;
  metadata?: Record<string, unknown>;
  created_at: string;
}

export interface LearningPathProgressLog {
  id: string;
  user_id: string;
  path_id: string;
  node_ref_id?: string;
  action: 'started' | 'completed' | 'skipped' | 'reviewed' | 'adjusted';
  duration_minutes?: number;
  metadata?: Record<string, unknown>;
  created_at: string;
}

export interface CreateLearningPathData {
  title: string;
  description?: string;
  goal_type: LearningPathGoalType;
  goal_content?: string;
  target_knowledge_point_id?: string;
  template_id?: string;
  daily_minutes_target?: number;
  target_completion_date?: string;
}

export interface GenerateLearningPathData {
  goal: string;
  context?: string;
  goal_type?: LearningPathGoalType;
  target_knowledge_point_id?: string;
  template_id?: string;
  daily_minutes_target?: number;
  target_completion_date?: string;
  conversation_history?: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
}

export interface AdjustLearningPathData {
  reason: string;
  node_ref_id?: string;
  adjustment_type: 'insert' | 'remove' | 'reorder' | 'difficulty';
}

export interface LearningPathWithNodes extends LearningPath {
  nodes: LearningPathNodeRef[];
}

export interface LearningPathNodeRefWithResources extends LearningPathNodeRef {
  resources: LearningResource[];
}

export interface LearningPathNodeCard {
  id: string;
  node_ref_id: string;
  card_id: string;
  card_type: 'qa' | 'choice' | 'judge' | 'essay';
  auto_generated: boolean;
  created_at: string;
}

export interface GenerateCardsForNodeRefData {
  node_ref_id: string;
  card_types?: ('qa' | 'choice' | 'judge' | 'essay')[];
  regenerate?: boolean;
}

export interface LearningPathNodeRefWithCards extends LearningPathNodeRef {
  resources: LearningResource[];
  cards: LearningPathNodeCard[];
}

export interface LearningPathNodeDependency {
  id: string;
  path_id: string;
  node_ref_id: string;
  depends_on_node_ref_id: string;
  dependency_type: 'prerequisite' | 'sequence';
  created_at: string;
}

export type SplitDirection = 'horizontal' | 'vertical';

export interface CombinedGraphViewData {
  graph1: Graph;
  graph2: Graph;
  relations: GraphRelation[];
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
  connection_type: 'same_knowledge_point' | 'similar_content';
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

export interface ScheduledTask {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  queue_level: number;
  position: number;
  estimated_duration?: number;
  actual_duration?: number;
  deadline?: string;
  status: 'pending' | 'in_progress' | 'paused' | 'completed' | 'cancelled';
  tags: string[];
  knowledge_point_id?: string;
  priority: number;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
  completed_at?: string;
}

export interface TaskExecution {
  id: string;
  task_id: string;
  user_id: string;
  started_at: string;
  ended_at?: string;
  duration?: number;
  queue_level: number;
  status: 'completed' | 'interrupted' | 'time_slice_ended';
}

export interface TaskSettings {
  id: string;
  user_id: string;
  q0_time_slice: number;
  q1_time_slice: number;
  q2_time_slice: number;
  break_duration: number;
  sound_enabled: boolean;
  notification_enabled: boolean;
}

export interface TaskStats {
  total_tasks: number;
  completed_tasks: number;
  total_duration: number;
  avg_duration: number;
  completion_rate: number;
  tasks_by_queue: { q0: number; q1: number; q2: number };
  tasks_by_status: Record<string, number>;
  daily?: Array<{
    date: string;
    completed: number;
    duration: number;
  }>;
}

export interface HeatmapData {
  date: string;
  count: number;
  duration: number;
}

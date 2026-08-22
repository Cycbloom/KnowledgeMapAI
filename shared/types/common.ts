export type NotificationType =
  | "task_start"
  | "task_complete"
  | "time_slice_end"
  | "deadline"
  | "break_start"
  | "break_end"
  | "daily_summary"
  | "system";

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  message?: string;
  data?: Record<string, unknown>;
  read_at?: string;
  created_at: string;
  expires_at?: string;
}

export interface NotificationSettings {
  id: string;
  user_id: string;
  browser_enabled: boolean;
  sound_enabled: boolean;
  sound_volume: number;
  task_start_enabled: boolean;
  task_complete_enabled: boolean;
  time_slice_end_enabled: boolean;
  deadline_enabled: boolean;
  break_enabled: boolean;
  daily_summary_enabled: boolean;
  deadline_reminder_minutes: number[];
  do_not_disturb_enabled: boolean;
  do_not_disturb_start: string;
  do_not_disturb_end: string;
  created_at: string;
  updated_at: string;
}

export interface CreateNotificationData {
  type: NotificationType;
  title: string;
  message?: string;
  data?: Record<string, unknown>;
  expires_at?: string;
}

export interface Task {
  id: string;
  user_id: string;
  title: string;
  description: string;
  queue_id: string;
  queue_level: number;
  position: number;
  estimated_duration: number;
  actual_duration: number;
  deadline: string;
  status:
    | "pending"
    | "in_progress"
    | "running"
    | "paused"
    | "completed"
    | "failed"
    | "cancelled";
  tags: string[];
  knowledge_point_id: string;
  priority: number;
  task_type: string;
  total_duration: number;
  progress_mode: "average" | "decreasing" | "increasing" | "custom";
  progress_percentage: number;
  parent_task_id: string;
  context: string;
  scheduled_start: string;
  scheduled_end: string;
  notes: string;
  completed_at: string;
  created_at: string;
  updated_at: string;
  deleted_at: string;
  input_data?: Record<string, unknown> | string;
  error_message?: string;
  /**
   * 运行时进度数据（通过 SSE 推送，仅 in_progress 状态有值）。
   * 与 progress_percentage 区分：后者是长期任务的计划完成百分比，
   * 前者是当前运行中的 task processor 实时计算的进度（stage/percent/completed/total 等）。
   */
  runtime_progress?: TaskRuntimeProgress;
}

/**
 * 任务运行时进度，由后端 task processor 计算并通过 SSE 推送到前端。
 * 所有字段可选，processor 可只提供部分字段（如只传 percent 不传 completed/total）。
 */
export interface TaskRuntimeProgress {
  /** 阶段标识（init / generating / expanding / deep_expanding 等） */
  stage?: string;
  /** 阶段中文文案，便于前端直接展示 */
  stageLabel?: string;
  /** 进度百分比 0-100 */
  percent?: number;
  /** 当前处理的项标识（如节点名） */
  current?: string;
  /** 已完成数 */
  completed?: number;
  /** 总数 */
  total?: number;
}

export interface PeriodicTask {
  id: string;
  user_id: string;
  period_type: "daily" | "weekly" | "monthly" | "quarterly";
  period_start: string;
  period_end: string;
  task_type: "focus" | "study" | "create" | "tasks";
  target: number;
  progress: number;
  status: "pending" | "completed";
  xp_reward: number;
  pass_points: number;
  created_at: string;
  updated_at: string;
}

export interface LearningPathProgress {
  id: string;
  user_id: string;
  path_id: string;
  node_id: string;
  status: "pending" | "in_progress" | "completed" | "skipped";
  progress_percentage: number;
  time_spent: number;
  notes: string;
  planned_duration: number;
  planned_nodes: string[];
  started_at: string;
  completed_at: string;
  created_at: string;
  updated_at: string;
}

export interface StudyCard {
  id: string;
  knowledge_point_id: string;
  user_id: string;
  graph_id: string;
  source_graph_id?: string;
  question: string;
  answer: string;
  card_type:
    | "qa"
    | "choice"
    | "true_false"
    | "multi_choice"
    | "fill_in_the_blank"
    | "essay"
    | "cloze"
    | "select_from_options"
    | "matching"
    | "ordering";
  options?: string[];
  explanation?: string;
  difficulty?: number;
  last_reviewed?: string;
  next_review: string;
  review_count?: number;
  fsrs_state?: string;
  fsrs_stability?: number;
  fsrs_difficulty?: number;
  fsrs_elapsed_days?: number;
  fsrs_scheduled_days?: number;
  fsrs_retrievability?: number;
  fsrs_last_review?: string;
  created_at?: string;
  focus_topic?: string | null;
  knowledgePointTitle?: string | null;
  graphTitle?: string | null;
}

export type TutorMode =
  | "free"
  | "guided"
  | "learning-path"
  | "literature-extract"
  | "concept-aggregation";

export interface TutorExtractedConcept {
  title: string;
  description: string;
  priority: "high" | "medium" | "low";
}

export interface TutorSession {
  id: string;
  mode: TutorMode;
  currentTopic?: string;
  startTime: Date;
  messages: Array<{
    role: "user" | "assistant";
    content: string;
    timestamp: Date;
  }>;
  extractedConcepts: TutorExtractedConcept[];
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

export type TTSEngine = "browser" | "sambert";

export interface TTSConfig {
  engine: TTSEngine;
  voice?: string;
  speed?: number;
  outputFormat?: "mp3" | "wav";
}

export interface TTSVoice {
  id: string;
  name: string;
  lang: string;
}

export type STTEngine = "browser" | "cloud";

export interface STTResult {
  text: string;
  language?: string;
  duration?: number;
}

export interface STTConfig {
  engine: STTEngine;
  language?: string;
}

export type LearningPathGoalType =
  | "natural_language"
  | "graph_node"
  | "template";

export type LearningPathStatus = "active" | "completed" | "paused" | "archived";

export type LearningPathNodeStatus =
  | "pending"
  | "in_progress"
  | "completed"
  | "skipped";

export type LearningResourceType =
  | "article"
  | "video"
  | "book"
  | "course"
  | "exercise"
  | "user_upload";

export type LearningResourceSource = "ai_recommended" | "user_added";

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
  node?: import("./graph.js").Node;
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
  action: "started" | "completed" | "skipped" | "reviewed" | "adjusted";
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
    role: "user" | "assistant";
    content: string;
  }>;
}

export interface AdjustLearningPathData {
  reason: string;
  node_ref_id?: string;
  adjustment_type: "insert" | "remove" | "reorder" | "difficulty";
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
  card_type: "qa" | "choice" | "judge" | "essay";
  auto_generated: boolean;
  created_at: string;
}

export interface GenerateCardsForNodeRefData {
  node_ref_id: string;
  card_types?: ("qa" | "choice" | "judge" | "essay")[];
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
  dependency_type: "prerequisite" | "sequence";
  created_at: string;
}

export interface QuickCreateGraphRequest {
  title: string;
  description?: string;
  relation_to?: {
    graph_id: string;
    type: import("./graph.js").GraphRelationType;
  };
  auto_generate_content?: boolean;
  domains?: Array<{ domain_id: string; is_primary?: boolean }>;
}

export interface InfiniteExpansionRequest {
  max_depth?: number;
  max_graphs_per_level?: number;
  relation_types?: import("./graph.js").GraphRelationType[];
  auto_generate_nodes?: boolean;
  node_depth?: number;
}

export interface InfiniteExpansionProgress {
  status: "pending" | "running" | "completed" | "failed";
  current_depth: number;
  total_graphs_created: number;
  total_nodes_created: number;
  current_graph_title?: string;
  created_graphs: Array<{
    id: string;
    title: string;
    relation_type: import("./graph.js").GraphRelationType;
    depth: number;
    node_count?: number;
  }>;
  errors: Array<{ message: string }>;
}

export interface InfiniteExpansionResult {
  task_id: string;
  status: "pending" | "running" | "completed" | "failed";
  total_graphs_created: number;
  total_nodes_created: number;
  created_graphs: Array<{
    id: string;
    title: string;
    relation_type: import("./graph.js").GraphRelationType;
    depth: number;
    node_count: number;
  }>;
}

export interface BranchSuggestion {
  id: string;
  title: string;
  description: string;
  priority: "high" | "medium" | "low";
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

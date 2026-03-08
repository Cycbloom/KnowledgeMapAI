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
  type:
    | "generate_questions"
    | "expand_graph"
    | "batch_generate_questions"
    | string;
  name?: string;
  status: "pending" | "processing" | "completed" | "failed" | string;
  payload: TaskPayload;
  result: TaskResult;
  error?: string;
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
    | "essay";
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

export type TutorMode = "free" | "guided" | "learning-path";

export interface ExtractedConcept {
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

export type TTSEngine = "browser" | "qwen3";

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
    type: import("./graph.js").GraphRelationType;
  };
  auto_generate_content?: boolean;
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

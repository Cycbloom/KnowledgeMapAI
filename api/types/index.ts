// Copied from src/types/index.ts to avoid tsconfig path issues in node backend
export interface Node {
  id: string;
  graph_id: string;
  title: string;
  content?: string;
  x_position: number;
  y_position: number;
  color?: string;
  level?: 'root' | 'core' | 'sub' | 'normal' | 'leaf';
  properties?: Record<string, any>;
  is_accepted?: boolean;
  learned_status?: 'new' | 'learning' | 'learned' | 'review';
  learned_at?: string;
  updated_at?: string;
  created_at?: string;
}

export interface Edge {
  id: string;
  source_node_id: string;
  target_node_id: string;
  relationship_type?: string;
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
  target_node_id?: string;
  template_id?: string;
  status: LearningPathStatus;
  total_nodes: number;
  completed_nodes: number;
  progress_percentage: number;
  estimated_hours?: number;
  daily_minutes_target?: number;
  target_completion_date?: string;
  settings?: Record<string, any>;
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
  metadata?: Record<string, any>;
  created_at: string;
}

export interface LearningPathProgressLog {
  id: string;
  user_id: string;
  path_id: string;
  node_ref_id?: string;
  action: 'started' | 'completed' | 'skipped' | 'reviewed' | 'adjusted';
  duration_minutes?: number;
  metadata?: Record<string, any>;
  created_at: string;
}

export interface CreateLearningPathData {
  title: string;
  description?: string;
  goal_type: LearningPathGoalType;
  goal_content?: string;
  target_node_id?: string;
  template_id?: string;
  daily_minutes_target?: number;
  target_completion_date?: string;
}

export interface GenerateLearningPathData {
  goal: string;
  context?: string;
  goal_type?: LearningPathGoalType;
  target_node_id?: string;
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

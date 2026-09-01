import type { LearningPathStage } from "./learningPathAlgorithms";

export interface LearningPath {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  goal?: string;
  target_date?: string;
  source_graph_id?: string;
  domain_id?: string;
  path_type: "single_graph" | "cross_graph";
  total_estimated_time: number;
  ai_generated: boolean;
  status: "active" | "completed" | "paused" | "archived";
  daily_minutes_target: number;
  created_at: string;
  updated_at: string;
  nodes?: LearningPathNode[];
  progress?: LearningPathProgressSummary;
}

export interface LearningPathNode {
  id: string;
  path_id: string;
  knowledge_point_id?: string;
  graph_id?: string;
  order_index: number;
  title: string;
  description?: string;
  estimated_time: number;
  is_milestone: boolean;
  prerequisites: string[];
  status: "pending" | "in_progress" | "completed" | "skipped";
  started_at?: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
}

export interface LearningPathProgress {
  id: string;
  user_id: string;
  path_id: string;
  node_id: string;
  status: string;
  progress_percentage: number;
  time_spent: number;
  notes?: string;
  started_at?: string;
  completed_at?: string;
}

export interface LearningPathProgressSummary {
  total_nodes: number;
  completed_nodes: number;
  in_progress_nodes: number;
  pending_nodes: number;
  skipped_nodes: number;
  total_time_spent: number;
  progress_percentage: number;
}

export interface LearningPlan {
  id: string;
  user_id: string;
  path_id: string;
  node_id: string;
  status: string;
  progress_percentage: number;
  time_spent: number;
  notes?: string;
  planned_duration?: number;
  planned_nodes: string[];
  started_at?: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateLearningPathInput {
  title: string;
  description?: string;
  goal?: string;
  target_date?: string;
  source_graph_id?: string;
  domain_id?: string;
  path_type?: "single_graph" | "cross_graph";
  total_estimated_time?: number;
  ai_generated?: boolean;
  daily_minutes_target?: number;
  nodes?: CreateLearningPathNodeInput[];
}

export interface CreateLearningPathNodeInput {
  knowledge_point_id?: string;
  graph_id?: string;
  order_index: number;
  title: string;
  description?: string;
  estimated_time?: number;
  is_milestone?: boolean;
  prerequisites?: string[];
}

export interface UpdateLearningPathInput {
  title?: string;
  description?: string;
  goal?: string;
  target_date?: string;
  status?: "active" | "completed" | "paused" | "archived";
  daily_minutes_target?: number;
}

export interface UpdateNodeStatusInput {
  status: "pending" | "in_progress" | "completed" | "skipped";
  notes?: string;
  time_spent?: number;
  progress_percentage?: number;
}

export interface LearningPathWithNodeCount {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  goal: string | null;
  target_date: string | null;
  source_graph_id: string | null;
  domain_id: string | null;
  path_type: string;
  total_estimated_time: number;
  ai_generated: boolean;
  status: string;
  daily_minutes_target: number;
  created_at: string;
  updated_at: string;
  nodes_count: number;
  completed_nodes_count: number;
}

export interface LearningPathResult {
  id?: string;
  graphId: string;
  graphTitle: string;
  totalNodes: number;
  completedNodes: number;
  estimatedTotalTime: number;
  stages: LearningPathStage[];
  todayPlan: LearningPathStage[];
  predictions: {
    completionDate: string;
    weeklyProgress: number[];
    recommendedDailyTime: number;
  };
  suggestions: string[];
  aiGenerated: boolean;
  targetGoal?: string;
  savedPath?: LearningPath;
}

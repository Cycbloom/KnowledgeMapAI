import React from "react";
import {
  Target,
  TrendingUp,
  CheckCircle2,
  Circle,
  Play,
  SkipForward,
  RefreshCw,
  BookOpen,
} from "lucide-react";
import { NodeStatus } from "../../services/api/learningPaths";

export interface LearningPathNode {
  id: string;
  node_id: string;
  title: string;
  content?: string;
  order: number;
  estimated_minutes?: number;
  difficulty_level?: number;
  status: NodeStatus;
  prerequisites?: string[];
  mastery_level?: number;
  started_at?: string;
  completed_at?: string;
  time_spent?: number;
  notes?: string;
  related_task_id?: string;
  /** 图谱级节点（跨图路径）：仅关联图谱，无知识点 */
  graph_id?: string;
  related_task?: {
    id: string;
    title: string;
    status: string;
    scheduled_start?: string;
    scheduled_end?: string;
  };
}

export interface ApiLearningPathNode {
  id: string;
  knowledge_point_id?: string;
  graph_id?: string;
  title: string;
  description?: string;
  order_index?: number;
  estimated_time?: number;
  status?: NodeStatus;
  prerequisites?: string[];
  started_at?: string;
  completed_at?: string;
}

export interface LearningPathMilestone {
  id: string;
  title: string;
  description?: string;
  target_date?: string;
  completed_at?: string;
  node_ids: string[];
  progress: number;
  is_completed: boolean;
}

export interface LearningPathPlan {
  id: string;
  date: string;
  planned_nodes: string[];
  actual_nodes?: string[];
  estimated_minutes?: number;
  actual_minutes?: number;
  completed: boolean;
  notes?: string;
}

export interface LearningPathSuggestion {
  type: "review" | "practice" | "extend" | "prerequisite";
  title: string;
  description: string;
  priority: "high" | "medium" | "low";
  node_id?: string;
}

export interface LearningPathDetail {
  id: string;
  title: string;
  description?: string;
  graph_id?: string;
  graph_title?: string;
  path_type?: "single_graph" | "cross_graph";
  status: "active" | "completed" | "paused" | "archived";
  goal_type: "natural_language" | "graph_node" | "template";
  goal_content?: string;
  target_knowledge_point_id?: string;
  daily_minutes_target?: number;
  target_completion_date?: string;
  /** 学习窗口（P5 排课回写）：首末排期日；未排课时缺省 */
  scheduled_start_date?: string | null;
  scheduled_end_date?: string | null;
  created_at: string;
  updated_at: string;
  nodes: LearningPathNode[];
  milestones: LearningPathMilestone[];
  plans: LearningPathPlan[];
  suggestions: LearningPathSuggestion[];
  progress: {
    completed_nodes: number;
    total_nodes: number;
    total_time_spent: number;
    estimated_total_time: number;
    completion_percentage: number;
    current_streak: number;
    longest_streak: number;
    last_activity_at?: string;
  };
}

type StatusLabelKey =
  | "learningPath.statusLabels.pending"
  | "learningPath.statusLabels.learning"
  | "learningPath.statusLabels.completed"
  | "learningPath.statusLabels.skipped";

export const STATUS_CONFIG: Record<
  NodeStatus,
  { labelKey: StatusLabelKey; color: string; bgColor: string; icon: React.ReactNode }
> = {
  pending: {
    labelKey: "learningPath.statusLabels.pending",
    color: "text-gray-500",
    bgColor: "bg-gray-100 dark:bg-gray-700",
    icon: <Circle className="w-4 h-4" />,
  },
  in_progress: {
    labelKey: "learningPath.statusLabels.learning",
    color: "text-primary-500",
    bgColor: "bg-primary-100 dark:bg-primary-900/30",
    icon: <Play className="w-4 h-4" />,
  },
  completed: {
    labelKey: "learningPath.statusLabels.completed",
    color: "text-green-500",
    bgColor: "bg-green-100 dark:bg-green-900/30",
    icon: <CheckCircle2 className="w-4 h-4" />,
  },
  skipped: {
    labelKey: "learningPath.statusLabels.skipped",
    color: "text-yellow-500",
    bgColor: "bg-yellow-100 dark:bg-yellow-900/30",
    icon: <SkipForward className="w-4 h-4" />,
  },
};

export const SUGGESTION_ICONS: Record<string, React.ReactNode> = {
  review: <RefreshCw className="w-4 h-4" />,
  practice: <Target className="w-4 h-4" />,
  extend: <TrendingUp className="w-4 h-4" />,
  prerequisite: <BookOpen className="w-4 h-4" />,
};

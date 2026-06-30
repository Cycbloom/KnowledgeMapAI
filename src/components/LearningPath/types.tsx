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
  status: "active" | "completed" | "paused" | "archived";
  goal_type: "natural_language" | "graph_node" | "template";
  goal_content?: string;
  target_knowledge_point_id?: string;
  daily_minutes_target?: number;
  target_completion_date?: string;
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

export const STATUS_CONFIG: Record<
  NodeStatus,
  { label: string; color: string; bgColor: string; icon: React.ReactNode }
> = {
  pending: {
    label: "待学习",
    color: "text-gray-500",
    bgColor: "bg-gray-100 dark:bg-gray-700",
    icon: <Circle className="w-4 h-4" />,
  },
  in_progress: {
    label: "学习中",
    color: "text-primary-500",
    bgColor: "bg-primary-100 dark:bg-primary-900/30",
    icon: <Play className="w-4 h-4" />,
  },
  completed: {
    label: "已完成",
    color: "text-green-500",
    bgColor: "bg-green-100 dark:bg-green-900/30",
    icon: <CheckCircle2 className="w-4 h-4" />,
  },
  skipped: {
    label: "已跳过",
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

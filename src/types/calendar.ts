import type { TaskSubtask } from "@shared/types";

export type CalendarMode = "plan" | "history";

export type ActivityEventType = "focus_study" | "review" | "path_progress";

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  start: string;
  end?: string;
  type: "task" | "study" | "review" | "other";
  color?: string;
  allDay?: boolean;
  estimated_duration?: number;
  mode?: CalendarMode;
  activityType?: ActivityEventType;
  activityData?: Record<string, unknown>;
  subtasks?: TaskSubtask[];
  subtask_count?: number;
  subtask_completed?: number;
  has_subtasks?: boolean;
}

export interface ActivityEvent {
  id: string;
  user_id: string;
  activity_type: ActivityEventType;
  title: string;
  description?: string;
  started_at: string;
  ended_at?: string;
  duration?: number;
  metadata?: Record<string, unknown>;
  knowledge_point_id?: string;
  graph_id?: string;
  task_id?: string;
  created_at: string;
}

export interface DailyActivityStats {
  date: string;
  total_duration: number;
  activity_count: number;
  activities_by_type: Record<ActivityEventType, number>;
}

export interface ActivityTypeConfig {
  icon: string;
  color: string;
  label: string;
}

export const ACTIVITY_TYPE_CONFIG: Record<
  ActivityEventType,
  ActivityTypeConfig
> = {
  focus_study: { icon: "Brain", color: "purple", label: "专注学习" },
  review: { icon: "RotateCcw", color: "green", label: "复习知识点" },
  path_progress: { icon: "Route", color: "indigo", label: "学习路径进展" },
};

export interface ExecutionEvent {
  id: string;
  task_id: string;
  task_title: string;
  started_at: string;
  ended_at?: string;
  duration?: number;
  status?: string;
}

export interface EventDropInfo {
  eventId: string;
  newStart: Date;
  newEnd?: Date;
}

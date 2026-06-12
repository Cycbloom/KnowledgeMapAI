import type { TaskSubtask, UserTask } from "@shared/types";

export type CalendarMode = "plan" | "history";

export type ActivityEventType = "focus_study" | "review" | "path_progress";

/**
 * CalendarEvent 是 UserTask 的日历视图投影类型。
 *
 * 它将 UserTask 的数据转换为日历组件所需的格式，包含：
 * - 从 UserTask 直接映射的字段（id, title, description 等）
 * - 从 UserTask 计算派生的字段（start, end, type, color, allDay）
 * - 日历视图特有的扩展字段（mode, activityType, activityData）
 *
 * 转换逻辑位于 `src/utils/calendarEventMapper.ts` 中的 `userTaskToCalendarEvent` 函数。
 */
export interface CalendarEvent {
  /** 从 UserTask.id 映射 */
  id: UserTask["id"];
  /** 从 UserTask.title 映射 */
  title: UserTask["title"];
  /** 从 UserTask.description 映射 */
  description?: UserTask["description"];
  /** 从 UserTask.scheduled_start || UserTask.deadline || UserTask.created_at 计算 */
  start: string;
  /** 从 UserTask.scheduled_end 映射 */
  end?: UserTask["scheduled_end"];
  /** 从 UserTask.tags 计算：包含"学习"→study，包含"复习"→review，否则→task */
  type: "task" | "study" | "review" | "other";
  /** 从 UserTask.priority 计算：4→red，3→orange，其他→blue */
  color?: string;
  /** 从 UserTask.scheduled_start 计算：无 scheduled_start 时为 true */
  allDay?: boolean;
  /** 从 UserTask.estimated_duration 映射 */
  estimated_duration?: UserTask["estimated_duration"];
  /** 日历视图特有字段：当前日历模式 */
  mode?: CalendarMode;
  /** 活动事件特有字段 */
  activityType?: ActivityEventType;
  /** 活动事件特有字段 */
  activityData?: Record<string, unknown>;
  /** 从 UserTask.subtasks 映射 */
  subtasks?: TaskSubtask[];
  /** 从 UserTask.subtask_count 映射 */
  subtask_count?: UserTask["subtask_count"];
  /** 从 UserTask.subtask_completed 映射 */
  subtask_completed?: UserTask["subtask_completed"];
  /** 从 UserTask.has_subtasks 映射 */
  has_subtasks?: UserTask["has_subtasks"];
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

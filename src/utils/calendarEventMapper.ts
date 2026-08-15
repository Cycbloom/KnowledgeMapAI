import type { UserTask } from "@shared/types";
import type { CalendarEvent } from "../types/calendar";

/**
 * 将 UserTask 的 tags 映射为日历事件的类型。
 * 包含"study"→study，包含"review"→review，否则→task
 */
function mapTaskType(tags: string[]): CalendarEvent["type"] {
  // 预构建 Set 索引，替代对同一数组的两次 includes 线性扫描（O(n)→O(1) 查询）
  const tagSet = new Set(tags ?? []);
  if (tagSet.has("study")) return "study";
  if (tagSet.has("review")) return "review";
  return "task";
}

/**
 * 将 UserTask 的 priority 映射为日历事件的颜色。
 * 4→red（紧急），3→orange（高），其他→blue
 */
function mapPriorityColor(priority: number): string {
  if (priority === 4) return "red";
  if (priority === 3) return "orange";
  return "blue";
}

/**
 * 将 UserTask 转换为 CalendarEvent。
 *
 * 这是 UserTask 到日历视图投影的核心转换函数，
 * 包含字段直接映射和计算派生逻辑。
 */
export function userTaskToCalendarEvent(task: UserTask): CalendarEvent {
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    start: task.scheduled_start || task.deadline || task.created_at,
    end: task.scheduled_end,
    type: mapTaskType(task.tags),
    color: mapPriorityColor(task.priority),
    allDay: !task.scheduled_start,
    estimated_duration: task.estimated_duration,
    subtasks: task.subtasks || [],
    subtask_count: task.subtask_count || 0,
    subtask_completed: task.subtask_completed || 0,
    has_subtasks: task.has_subtasks || false,
  };
}

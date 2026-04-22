export type TaskType = "one_time" | "long_term" | "periodic" | "learning";

export type ProgressMode = "average" | "decreasing" | "increasing" | "custom";

export type TaskStatus =
  | "pending"
  | "in_progress"
  | "paused"
  | "completed"
  | "cancelled";

export type ExecutionStatus = "completed" | "interrupted" | "time_slice_ended";

export type DependencyType = "strict" | "soft";

export type ScheduleType = "daily" | "weekly" | "custom" | "smart";

export type SubtaskStatus = "pending" | "in_progress" | "completed";

export type LearningState = "learning" | "review" | "practice" | "quiz";

export type LinkType = "web" | "file" | "api";

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
  status: TaskStatus;
  tags: string[];
  knowledge_point_id?: string;
  priority: number;
  queue_id?: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
  completed_at?: string;
  task_type?: TaskType;
  total_duration?: number;
  progress_mode?: ProgressMode;
  progress_percentage?: number;
  parent_task_id?: string;
  context?: string;
  dependencies?: TaskDependency[];
  subtask_count?: number;
  subtask_completed?: number;
  has_subtasks?: boolean;
}

export interface Queue {
  id: string;
  user_id: string;
  name: string;
  color: string;
  time_slice: number;
  priority: number;
  created_at: string;
  updated_at: string;
}

export interface CreateQueueData {
  name: string;
  color?: string;
  time_slice?: number;
  priority: number;
}

export interface UpdateQueueData {
  name?: string;
  color?: string;
  time_slice?: number;
}

export interface TaskDependency {
  id: string;
  task_id: string;
  depends_on_task_id: string;
  dependency_type: DependencyType;
  created_at: string;
  depends_on_task?: {
    id: string;
    title: string;
    description?: string;
    status: string;
    queue_level: number;
    priority: number;
  };
}

export interface TaskSchedule {
  id: string;
  user_id: string;
  task_template_id: string;
  schedule_type: ScheduleType;
  schedule_config: {
    time?: string;
    days?: number[];
    interval_days?: number;
    base_interval?: number;
    adjustment_factor?: number;
    [key: string]: unknown;
  };
  next_run_at?: string;
  last_run_at?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  task_template?: {
    id: string;
    title: string;
    description?: string;
    queue_level: number;
    priority: number;
    tags: string[];
  };
}

export interface TaskProgressPlan {
  id: string;
  task_id: string;
  plan_date: string;
  planned_percentage: number;
  actual_percentage: number;
  status: "pending" | "completed" | "skipped";
  notes?: string;
  created_at: string;
}

export interface TaskExecution {
  id: string;
  task_id: string;
  user_id: string;
  started_at: string;
  ended_at?: string;
  duration?: number;
  queue_level: number;
  status: ExecutionStatus;
}

export interface StateHistoryEntry {
  from_state: LearningState;
  to_state: LearningState;
  changed_at: string;
  mastery_level_before: number;
  mastery_level_after: number;
  reason?: string;
}

export interface TaskSubtask {
  id: string;
  task_id: string;
  title: string;
  description?: string;
  status: SubtaskStatus;
  priority: number;
  position: number;
  estimated_duration?: number;
  actual_duration?: number;
  due_date?: string;
  completed_at?: string;
  learning_path_node_id?: string;
  knowledge_point_id: string;
  learning_state: LearningState;
  mastery_level: number;
  last_state_change_at: string;
  state_history: StateHistoryEntry[];
  created_at: string;
  updated_at: string;
}

export interface TaskLink {
  id: string;
  task_id: string;
  link_type: LinkType;
  title?: string;
  url: string;
  description?: string;
  icon?: string;
  metadata?: Record<string, unknown>;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface TaskKnowledgePoint {
  id: string;
  task_id: string;
  knowledge_point_id: string;
  relevance_score: number;
  is_primary: boolean;
  notes?: string;
  created_at: string;
  knowledge_point?: {
    id: string;
    title: string;
    content?: string;
    visibility?: string;
    owner_id?: string;
  };
}

export interface TaskDetail extends ScheduledTask {
  dependencies: TaskDependency[];
  dependents: TaskDependency[];
  progress_plans: TaskProgressPlan[];
  executions: TaskExecution[];
  required_time_slots?: number;
  subtasks?: TaskSubtask[];
  links?: TaskLink[];
  knowledge_points?: TaskKnowledgePoint[];
  notes?: string;
  subtask_count: number;
  subtask_completed: number;
  has_subtasks: boolean;
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

export interface UpdateTaskSettingsData {
  q0_time_slice?: number;
  q1_time_slice?: number;
  q2_time_slice?: number;
  break_duration?: number;
  sound_enabled?: boolean;
  notification_enabled?: boolean;
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

export interface UserTimeSlot {
  id: string;
  user_id: string;
  day_of_week: number | null;
  start_time: string;
  end_time: string;
  is_available: boolean;
  label?: string;
  created_at: string;
}

export interface CreateTaskData {
  title: string;
  description?: string;
  estimated_duration?: number;
  deadline?: string;
  tags?: string[];
  knowledge_point_id?: string;
  priority?: number;
}

export interface TaskFilters {
  status?: string;
  queue_level?: number;
  tags?: string[];
  from_date?: string;
  to_date?: string;
}

export interface ExecutionFilters {
  task_id?: string;
  from_date?: string;
  to_date?: string;
  status?: string;
}

export interface SchedulerStats {
  total_tasks: number;
  completed_tasks: number;
  total_duration: number;
  by_queue: {
    q0: { count: number; duration: number };
    q1: { count: number; duration: number };
    q2: { count: number; duration: number };
  };
  by_status: Record<string, number>;
  daily: Array<{
    date: string;
    completed: number;
    duration: number;
  }>;
}

export interface CreateScheduledTaskData {
  title: string;
  description?: string;
  queue_level?: number;
  estimated_duration?: number;
  deadline?: string;
  tags?: string[];
  knowledge_point_id?: string;
  priority?: number;
  task_type?: TaskType;
  total_duration?: number;
  progress_mode?: ProgressMode;
  context?: string;
  parent_task_id?: string;
}

export interface UpdateScheduledTaskData {
  title?: string;
  description?: string;
  estimated_duration?: number;
  deadline?: string;
  tags?: string[];
  priority?: number;
  task_type?: TaskType;
  total_duration?: number;
  progress_mode?: ProgressMode;
  progress_percentage?: number;
  context?: string;
  parent_task_id?: string;
  scheduled_start?: string;
  scheduled_end?: string;
}

export interface QueueData {
  q0: ScheduledTask[];
  q1: ScheduledTask[];
  q2: ScheduledTask[];
}

export interface GenerateTaskDetailsResult {
  description: string;
  tags: string[];
  estimated_duration: number;
  priority: number;
  suggested_queue: number;
}

export interface FocusSession {
  id: string;
  user_id: string;
  task_id?: string;
  started_at: string;
  ended_at?: string;
  duration?: number;
  pomodoro_count: number;
  white_noise_type?: string;
  is_break: boolean;
  created_at: string;
}

export interface CreateFocusSessionData {
  task_id?: string;
  started_at: string;
  ended_at?: string;
  duration?: number;
  pomodoro_count?: number;
  white_noise_type?: string;
  is_break?: boolean;
}

export interface UserFocusStats {
  id: string;
  user_id: string;
  total_focus_seconds: number;
  total_sessions: number;
  total_pomodoros: number;
  total_tasks_completed: number;
  current_streak: number;
  longest_streak: number;
  last_focus_date?: string;
  created_at: string;
  updated_at: string;
}

export interface DailyFocusStats {
  date: string;
  total_duration: number;
  session_count: number;
  pomodoro_count: number;
  tasks_completed: number;
  avg_session_duration: number;
}

export interface WeeklyFocusStats {
  week_start: string;
  week_end: string;
  total_duration: number;
  total_sessions: number;
  total_pomodoros: number;
  tasks_completed: number;
  daily_average: number;
  best_day: { date: string; duration: number };
  streak_days: number;
}

export interface MonthlyFocusStats {
  month: string;
  total_duration: number;
  total_sessions: number;
  total_pomodoros: number;
  tasks_completed: number;
  daily_average: number;
  active_days: number;
  best_day: { date: string; duration: number };
  streak_longest: number;
  weekly_breakdown: Array<{
    week: number;
    duration: number;
    sessions: number;
  }>;
}

export interface Achievement {
  id: string;
  code: string;
  name: string;
  description: string;
  category: "focus" | "tasks" | "streak" | "special" | "study" | "creation";
  icon: string;
  color: string;
  xp_reward: number;
  condition_type: string;
  condition_value: number;
  is_hidden: boolean;
  created_at: string;
}

export interface UserAchievement {
  id: string;
  user_id: string;
  achievement_id: string;
  achievement?: Achievement;
  unlocked_at: string;
  progress: number;
  metadata: Record<string, unknown>;
}

export interface AchievementCheckResult {
  unlocked: Achievement[];
  progress: Array<{
    achievement: Achievement;
    current: number;
    target: number;
    percentage: number;
  }>;
}

export interface ReviewTask {
  id: string;
  user_id: string;
  knowledge_point_id: string;
  task_id: string;
  interval_days: number;
  ease_factor: number;
  repetitions: number;
  next_review_date: string;
  last_review_date: string | null;
  last_quality_score: number | null;
  created_at: string;
  updated_at: string;
}

export interface CreateReviewTaskData {
  knowledge_point_id: string;
  task_id: string;
}

export interface UpdateReviewTaskData {
  quality: number;
}

export interface ReviewTaskStats {
  total: number;
  overdue: number;
  today: number;
  upcoming: number;
  future: number;
  averageEaseFactor: number;
  averageInterval: number;
  averageRepetitions: number;
}

export interface PendingReviewTask extends ReviewTask {
  urgency: "overdue" | "today" | "upcoming" | "future";
  masteryLevel: number;
}

export type {
  SchedulerEventType,
  SchedulerEvent,
  SchedulerEventHandler,
  SchedulerEventPayload,
} from "./events";

export type {
  AppEventType,
  AppEvent,
  AppEventHandler,
  AppEventPayload,
  GraphEventType,
  GraphCreatedPayload,
  GraphUpdatedPayload,
  GraphDeletedPayload,
  NodeCreatedPayload,
  NodeUpdatedPayload,
  NodeDeletedPayload,
  EdgeCreatedPayload,
  EdgeDeletedPayload,
  AIEventType,
  AITaskCompletedPayload,
  AITaskFailedPayload,
  StudyEventType,
  StudySessionCompletedPayload,
  SystemEventType,
  CacheInvalidationNeededPayload,
  NotificationNeededPayload,
} from "./events";

export type {
  TaskStartedPayload,
  TaskPausedPayload,
  TaskResumedPayload,
  TaskCompletedPayload,
  TaskDemotedPayload,
  TaskMovedPayload,
  FocusSessionStartedPayload,
  FocusSessionEndedPayload,
  ReviewCompletedPayload,
  ScheduleExecutedPayload,
  LearningProgressUpdatedPayload,
} from "./events";

import type { SchedulerEventType as SchedulerEventTypeLocal } from "./events";

export interface SchedulerEventLog {
  id: string;
  event_type: SchedulerEventTypeLocal;
  payload: Record<string, unknown>;
  source?: string;
  status: "pending" | "processed" | "failed";
  error_message?: string;
  retry_count: number;
  created_at: string;
  processed_at?: string;
}

export interface StateTransition {
  from: LearningState;
  to: LearningState;
  condition: {
    min_mastery?: number;
    max_mastery?: number;
  };
}

export interface LearningStateConfig {
  state: LearningState;
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  icon: string;
  description: string;
}

export const LEARNING_STATE_CONFIGS: Record<LearningState, LearningStateConfig> = {
  learning: {
    state: "learning",
    label: "学习",
    color: "text-blue-600 dark:text-blue-400",
    bgColor: "bg-blue-100 dark:bg-blue-500/20",
    borderColor: "border-blue-300 dark:border-blue-500/30",
    icon: "BookOpen",
    description: "初始学习阶段，仅出现一次",
  },
  review: {
    state: "review",
    label: "复习",
    color: "text-green-600 dark:text-green-400",
    bgColor: "bg-green-100 dark:bg-green-500/20",
    borderColor: "border-green-300 dark:border-green-500/30",
    icon: "RefreshCw",
    description: "复习已学内容",
  },
  practice: {
    state: "practice",
    label: "练习",
    color: "text-orange-600 dark:text-orange-400",
    bgColor: "bg-orange-100 dark:bg-orange-500/20",
    borderColor: "border-orange-300 dark:border-orange-500/30",
    icon: "Pencil",
    description: "简单题目快速检验",
  },
  quiz: {
    state: "quiz",
    label: "测验",
    color: "text-purple-600 dark:text-purple-400",
    bgColor: "bg-purple-100 dark:bg-purple-500/20",
    borderColor: "border-purple-300 dark:border-purple-500/30",
    icon: "FileCheck",
    description: "综合题目全面评估",
  },
};

export interface CreateSubtaskData {
  title: string;
  description?: string;
  knowledge_point_id: string;
  estimated_duration?: number;
  priority?: number;
}

export interface UpdateSubtaskData {
  title?: string;
  description?: string;
  status?: SubtaskStatus;
  learning_state?: LearningState;
  mastery_level?: number;
  estimated_duration?: number;
  actual_duration?: number;
  priority?: number;
}

export interface TransitionSubtaskData {
  to_state: LearningState;
  mastery_level: number;
  reason?: string;
}

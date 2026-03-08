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

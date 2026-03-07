import { request } from './client';

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
  status: 'pending' | 'in_progress' | 'paused' | 'completed' | 'cancelled';
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
}

export type TaskType = 'one_time' | 'long_term' | 'periodic' | 'learning';
export type ProgressMode = 'average' | 'decreasing' | 'increasing' | 'custom';

export interface TaskDependency {
  id: string;
  task_id: string;
  depends_on_task_id: string;
  dependency_type: 'strict' | 'soft';
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
  schedule_type: 'daily' | 'weekly' | 'custom' | 'smart';
  schedule_config: Record<string, unknown>;
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
  status: 'pending' | 'completed' | 'skipped';
  notes?: string;
  created_at: string;
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

export interface TaskDetail extends ScheduledTask {
  dependencies: TaskDependency[];
  dependents: TaskDependency[];
  progress_plans: TaskProgressPlan[];
  executions: TaskExecution[];
  required_time_slots?: number;
}

export interface TaskExecution {
  id: string;
  task_id: string;
  user_id: string;
  started_at: string;
  ended_at?: string;
  duration?: number;
  queue_level: number;
  status: 'completed' | 'interrupted' | 'time_slice_ended';
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

export interface Achievement {
  id: string;
  code: string;
  name: string;
  description: string;
  category: 'focus' | 'tasks' | 'streak' | 'special';
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

export interface AchievementCheckResult {
  unlocked: Achievement[];
  progress: Array<{
    achievement: Achievement;
    current: number;
    target: number;
    percentage: number;
  }>;
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

export const schedulerApi = {
  createTask: (data: CreateScheduledTaskData) =>
    request('/scheduler/tasks', { method: 'POST', body: JSON.stringify(data) }),

  getTasks: (filters?: TaskFilters) => {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.queue_level !== undefined) params.append('queue_level', filters.queue_level.toString());
    if (filters?.tags?.length) params.append('tags', filters.tags.join(','));
    if (filters?.from_date) params.append('from_date', filters.from_date);
    if (filters?.to_date) params.append('to_date', filters.to_date);
    const queryString = params.toString();
    return request(`/scheduler/tasks${queryString ? `?${queryString}` : ''}`);
  },

  getTask: (id: string) => request(`/scheduler/tasks/${id}`),

  updateTask: (id: string, data: UpdateScheduledTaskData) =>
    request(`/scheduler/tasks/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  deleteTask: (id: string) => request(`/scheduler/tasks/${id}`, { method: 'DELETE' }),

  startTask: (id: string) => request(`/scheduler/tasks/${id}/start`, { method: 'POST' }),

  pauseTask: (id: string) => request(`/scheduler/tasks/${id}/pause`, { method: 'POST' }),

  completeTask: (id: string) => request(`/scheduler/tasks/${id}/complete`, { method: 'POST' }),

  demoteTask: (id: string) => request(`/scheduler/tasks/${id}/demote`, { method: 'POST' }),

  getQueues: () => request('/scheduler/queues'),

  createQueue: (data: CreateQueueData) =>
    request('/scheduler/queues', { method: 'POST', body: JSON.stringify(data) }),

  updateQueue: (id: string, data: UpdateQueueData) =>
    request(`/scheduler/queues/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  deleteQueue: (id: string, targetQueueId?: string) =>
    request(`/scheduler/queues/${id}`, {
      method: 'DELETE',
      body: JSON.stringify({ target_queue_id: targetQueueId }),
    }),

  reorderQueues: (queueIds: string[]) =>
    request('/scheduler/queues/reorder', {
      method: 'PUT',
      body: JSON.stringify({ queue_ids: queueIds }),
    }),

  moveTask: (id: string, targetQueue: number | string) => {
    const body = typeof targetQueue === 'number'
      ? { target_queue: targetQueue }
      : { target_queue_id: targetQueue };
    return request(`/scheduler/tasks/${id}/move`, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  },

  reorderTasks: (queueLevel: number, taskIds: string[]) =>
    request(`/scheduler/tasks/reorder`, {
      method: 'PUT',
      body: JSON.stringify({ queue_level: queueLevel, task_ids: taskIds }),
    }),

  getExecutions: (filters?: ExecutionFilters) => {
    const params = new URLSearchParams();
    if (filters?.task_id) params.append('task_id', filters.task_id);
    if (filters?.from_date) params.append('from_date', filters.from_date);
    if (filters?.to_date) params.append('to_date', filters.to_date);
    if (filters?.status) params.append('status', filters.status);
    const queryString = params.toString();
    return request(`/scheduler/executions${queryString ? `?${queryString}` : ''}`);
  },

  getTaskExecutions: (taskId: string) =>
    request(`/scheduler/tasks/${taskId}/executions`),

  getSettings: () => request('/scheduler/settings'),

  updateSettings: (data: UpdateTaskSettingsData) =>
    request('/scheduler/settings', { method: 'PUT', body: JSON.stringify(data) }),

  getStats: (period: 'day' | 'week' | 'month' | 'year' = 'week') =>
    request(`/scheduler/stats?period=${period}`),

  getHeatmap: (year?: number, month?: number) => {
    const params = new URLSearchParams();
    if (year !== undefined) params.append('year', year.toString());
    if (month !== undefined) params.append('month', month.toString());
    const queryString = params.toString();
    return request(`/scheduler/heatmap${queryString ? `?${queryString}` : ''}`);
  },

  generateTaskDetails: (title: string, context?: string) =>
    request('/scheduler/generate-details', {
      method: 'POST',
      body: JSON.stringify({ title, context }),
    }),

  createFocusSession: (data: CreateFocusSessionData) =>
    request('/scheduler/focus-sessions', { method: 'POST', body: JSON.stringify(data) }),

  updateFocusSession: (id: string, data: Partial<FocusSession>) =>
    request(`/scheduler/focus-sessions/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  getFocusSessions: (options?: {
    from_date?: string;
    to_date?: string;
    task_id?: string;
    is_break?: boolean;
    limit?: number;
  }) => {
    const params = new URLSearchParams();
    if (options?.from_date) params.append('from_date', options.from_date);
    if (options?.to_date) params.append('to_date', options.to_date);
    if (options?.task_id) params.append('task_id', options.task_id);
    if (options?.is_break !== undefined) params.append('is_break', String(options.is_break));
    if (options?.limit) params.append('limit', String(options.limit));
    const queryString = params.toString();
    return request(`/scheduler/focus-sessions${queryString ? `?${queryString}` : ''}`);
  },

  getUserFocusStats: () => request('/scheduler/focus-stats'),

  getDailyFocusStats: (date?: string) => {
    const params = date ? `?date=${date}` : '';
    return request(`/scheduler/focus-stats/daily${params}`);
  },

  getWeeklyFocusStats: (weekStart?: string) => {
    const params = weekStart ? `?week_start=${weekStart}` : '';
    return request(`/scheduler/focus-stats/weekly${params}`);
  },

  getMonthlyFocusStats: (year?: number, month?: number) => {
    const params = new URLSearchParams();
    if (year !== undefined) params.append('year', String(year));
    if (month !== undefined) params.append('month', String(month));
    const queryString = params.toString();
    return request(`/scheduler/focus-stats/monthly${queryString ? `?${queryString}` : ''}`);
  },

  getYearlyHeatmap: (year?: number) => {
    const params = year ? `?year=${year}` : '';
    return request(`/scheduler/focus-stats/heatmap${params}`);
  },

  getAllAchievements: () => request('/scheduler/achievements'),

  getUserAchievements: () => request('/scheduler/achievements/user'),

  checkAchievements: () => request('/scheduler/achievements/check', { method: 'POST' }),

  getTaskDetail: (id: string) => request(`/scheduler/tasks/${id}/detail`),

  addTaskDependency: (taskId: string, data: { depends_on_task_id: string; dependency_type?: 'strict' | 'soft' }) =>
    request(`/scheduler/tasks/${taskId}/dependencies`, { method: 'POST', body: JSON.stringify(data) }),

  removeTaskDependency: (taskId: string, dependencyId: string) =>
    request(`/scheduler/tasks/${taskId}/dependencies/${dependencyId}`, { method: 'DELETE' }),

  getTaskDependencies: (taskId: string) =>
    request(`/scheduler/tasks/${taskId}/dependencies`),

  getTaskDependents: (taskId: string) =>
    request(`/scheduler/tasks/${taskId}/dependents`),

  createSchedule: (data: {
    task_template_id: string;
    schedule_type: 'daily' | 'weekly' | 'custom' | 'smart';
    schedule_config?: Record<string, unknown>;
    is_active?: boolean;
  }) => request('/scheduler/schedules', { method: 'POST', body: JSON.stringify(data) }),

  updateSchedule: (id: string, data: {
    schedule_config?: Record<string, unknown>;
    is_active?: boolean;
  }) => request(`/scheduler/schedules/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  deleteSchedule: (id: string) =>
    request(`/scheduler/schedules/${id}`, { method: 'DELETE' }),

  getSchedules: () => request('/scheduler/schedules'),

  createProgressPlan: (taskId: string, data: {
    start_date: string;
    end_date: string;
    progress_mode: ProgressMode;
    custom_allocations?: Array<{ date: string; percentage: number }>;
  }) => request(`/scheduler/tasks/${taskId}/progress-plan`, { method: 'POST', body: JSON.stringify(data) }),

  updateProgressPlan: (taskId: string, data: {
    planId?: string;
    date?: string;
    planned_percentage?: number;
    actual_percentage?: number;
    status?: 'pending' | 'completed' | 'skipped';
    notes?: string;
  }) => request(`/scheduler/tasks/${taskId}/progress-plan`, { method: 'PUT', body: JSON.stringify(data) }),

  getProgressPlan: (taskId: string) =>
    request(`/scheduler/tasks/${taskId}/progress-plan`),

  updateProgress: (taskId: string, data: {
    date?: string;
    percentage: number;
    notes?: string;
  }) => request(`/scheduler/tasks/${taskId}/progress`, { method: 'POST', body: JSON.stringify(data) }),

  getTimeSlots: () => request('/scheduler/time-slots'),

  createTimeSlot: (data: {
    day_of_week?: number;
    start_time: string;
    end_time: string;
    is_available?: boolean;
    label?: string;
  }) => request('/scheduler/time-slots', { method: 'POST', body: JSON.stringify(data) }),

  updateTimeSlot: (id: string, data: {
    start_time?: string;
    end_time?: string;
    is_available?: boolean;
    label?: string;
  }) => request(`/scheduler/time-slots/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  deleteTimeSlot: (id: string) =>
    request(`/scheduler/time-slots/${id}`, { method: 'DELETE' }),

  getSubtasks: (taskId: string) =>
    request(`/scheduler/tasks/${taskId}/subtasks`),

  createSubtask: (taskId: string, data: {
    title: string;
    description?: string;
    priority?: number;
    estimated_duration?: number;
    due_date?: string;
  }) => request(`/scheduler/tasks/${taskId}/subtasks`, { method: 'POST', body: JSON.stringify(data) }),

  updateSubtask: (taskId: string, subtaskId: string, data: {
    title?: string;
    description?: string;
    status?: 'pending' | 'in_progress' | 'completed';
    priority?: number;
    estimated_duration?: number;
    actual_duration?: number;
    due_date?: string | null;
  }) => request(`/scheduler/tasks/${taskId}/subtasks/${subtaskId}`, { method: 'PUT', body: JSON.stringify(data) }),

  deleteSubtask: (taskId: string, subtaskId: string) =>
    request(`/scheduler/tasks/${taskId}/subtasks/${subtaskId}`, { method: 'DELETE' }),

  getLinks: (taskId: string) =>
    request(`/scheduler/tasks/${taskId}/links`),

  createLink: (taskId: string, data: {
    link_type?: 'web' | 'file' | 'api';
    title?: string;
    url: string;
    description?: string;
    icon?: string;
    metadata?: Record<string, unknown>;
  }) => request(`/scheduler/tasks/${taskId}/links`, { method: 'POST', body: JSON.stringify(data) }),

  updateLink: (taskId: string, linkId: string, data: {
    title?: string;
    description?: string;
    icon?: string;
    metadata?: Record<string, unknown>;
  }) => request(`/scheduler/tasks/${taskId}/links/${linkId}`, { method: 'PUT', body: JSON.stringify(data) }),

  deleteLink: (taskId: string, linkId: string) =>
    request(`/scheduler/tasks/${taskId}/links/${linkId}`, { method: 'DELETE' }),

  getTaskKnowledgePoints: (taskId: string) =>
    request(`/scheduler/tasks/${taskId}/knowledge-points`),

  addTaskKnowledgePoint: (taskId: string, data: {
    knowledge_point_id: string;
    relevance_score?: number;
    is_primary?: boolean;
    notes?: string;
  }) => request(`/scheduler/tasks/${taskId}/knowledge-points`, { method: 'POST', body: JSON.stringify(data) }),

  updateTaskKnowledgePoint: (taskId: string, kpId: string, data: {
    relevance_score?: number;
    is_primary?: boolean;
    notes?: string;
  }) => request(`/scheduler/tasks/${taskId}/knowledge-points/${kpId}`, { method: 'PUT', body: JSON.stringify(data) }),

  removeTaskKnowledgePoint: (taskId: string, kpId: string) =>
    request(`/scheduler/tasks/${taskId}/knowledge-points/${kpId}`, { method: 'DELETE' }),

  updateNotes: (taskId: string, notes: string) =>
    request(`/scheduler/tasks/${taskId}/notes`, { method: 'PUT', body: JSON.stringify({ notes }) }),

  getSmartRecommendation: () =>
    request('/scheduler/smart-recommendation'),

  getDynamicPriority: (taskId: string) =>
    request(`/scheduler/tasks/${taskId}/dynamic-priority`),

  checkTaskDependencies: (taskId: string) =>
    request(`/scheduler/tasks/${taskId}/dependency-check`),
};

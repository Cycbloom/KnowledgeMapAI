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
}

export interface UpdateScheduledTaskData {
  title?: string;
  description?: string;
  estimated_duration?: number;
  deadline?: string;
  tags?: string[];
  priority?: number;
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
};

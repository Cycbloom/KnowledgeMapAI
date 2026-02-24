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
  created_at: string;
  updated_at: string;
  deleted_at?: string;
  completed_at?: string;
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

  moveTask: (id: string, targetQueue: number) =>
    request(`/scheduler/tasks/${id}/move`, {
      method: 'POST',
      body: JSON.stringify({ queue_level: targetQueue }),
    }),

  reorderTasks: (queueLevel: number, taskIds: string[]) =>
    request(`/scheduler/queues/${queueLevel}/reorder`, {
      method: 'POST',
      body: JSON.stringify({ task_ids: taskIds }),
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
};

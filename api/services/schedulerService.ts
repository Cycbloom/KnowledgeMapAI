import { SupabaseClient } from '@supabase/supabase-js';
import { getPaginationParams, PaginationOptions } from '../utils/pagination.js';

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

const DEFAULT_SETTINGS: Omit<TaskSettings, 'id' | 'user_id'> = {
  q0_time_slice: 25,
  q1_time_slice: 50,
  q2_time_slice: 100,
  break_duration: 5,
  sound_enabled: true,
  notification_enabled: true,
};

export class SchedulerService {
  async createTask(
    client: SupabaseClient,
    userId: string,
    taskData: CreateTaskData
  ): Promise<ScheduledTask> {
    const { data: maxPosResult } = await client
      .from('scheduled_tasks')
      .select('position')
      .eq('user_id', userId)
      .eq('queue_level', 0)
      .is('deleted_at', null)
      .order('position', { ascending: false })
      .limit(1)
      .single();

    const nextPosition = (maxPosResult?.position ?? -1) + 1;

    const { data, error } = await client
      .from('scheduled_tasks')
      .insert({
        user_id: userId,
        title: taskData.title,
        description: taskData.description,
        queue_level: 0,
        position: nextPosition,
        estimated_duration: taskData.estimated_duration,
        deadline: taskData.deadline,
        tags: taskData.tags || [],
        knowledge_point_id: taskData.knowledge_point_id,
        priority: taskData.priority ?? 0,
        status: 'pending',
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to create task: ${error.message}`);
    return data as ScheduledTask;
  }

  async updateTask(
    client: SupabaseClient,
    taskId: string,
    userId: string,
    updates: Partial<Omit<ScheduledTask, 'id' | 'user_id' | 'created_at' | 'updated_at'>>
  ): Promise<ScheduledTask> {
    const { data, error } = await client
      .from('scheduled_tasks')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', taskId)
      .eq('user_id', userId)
      .is('deleted_at', null)
      .select()
      .single();

    if (error) throw new Error(`Failed to update task: ${error.message}`);
    if (!data) throw new Error('Task not found');
    return data as ScheduledTask;
  }

  async deleteTask(
    client: SupabaseClient,
    taskId: string,
    userId: string
  ): Promise<void> {
    const { error } = await client
      .from('scheduled_tasks')
      .update({
        deleted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', taskId)
      .eq('user_id', userId);

    if (error) throw new Error(`Failed to delete task: ${error.message}`);
  }

  async getTask(
    client: SupabaseClient,
    taskId: string,
    userId: string
  ): Promise<ScheduledTask | null> {
    const { data, error } = await client
      .from('scheduled_tasks')
      .select('*')
      .eq('id', taskId)
      .eq('user_id', userId)
      .is('deleted_at', null)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Failed to fetch task: ${error.message}`);
    }
    return data as ScheduledTask | null;
  }

  async getTasks(
    client: SupabaseClient,
    userId: string,
    filters?: TaskFilters,
    options?: PaginationOptions
  ): Promise<{ tasks: ScheduledTask[]; total: number }> {
    const { offset, end } = getPaginationParams(options);
    let query = client
      .from('scheduled_tasks')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .is('deleted_at', null)
      .order('queue_level', { ascending: true })
      .order('position', { ascending: true })
      .range(offset, end);

    if (filters?.status && filters.status !== 'all') {
      query = query.eq('status', filters.status);
    }
    if (filters?.queue_level !== undefined) {
      query = query.eq('queue_level', filters.queue_level);
    }
    if (filters?.tags && filters.tags.length > 0) {
      query = query.contains('tags', filters.tags);
    }
    if (filters?.from_date) {
      query = query.gte('created_at', filters.from_date);
    }
    if (filters?.to_date) {
      query = query.lte('created_at', filters.to_date);
    }

    const { data, error, count } = await query;
    if (error) throw new Error(`Failed to fetch tasks: ${error.message}`);
    return { tasks: data as ScheduledTask[], total: count || 0 };
  }

  async getTasksByQueue(
    client: SupabaseClient,
    userId: string,
    queueLevel: number
  ): Promise<ScheduledTask[]> {
    const { data, error } = await client
      .from('scheduled_tasks')
      .select('*')
      .eq('user_id', userId)
      .eq('queue_level', queueLevel)
      .is('deleted_at', null)
      .order('position', { ascending: true });

    if (error) throw new Error(`Failed to fetch tasks by queue: ${error.message}`);
    return data as ScheduledTask[];
  }

  async startTask(
    client: SupabaseClient,
    taskId: string,
    userId: string
  ): Promise<{ task: ScheduledTask; execution: TaskExecution }> {
    const { data: task, error: taskError } = await client
      .from('scheduled_tasks')
      .select('*')
      .eq('id', taskId)
      .eq('user_id', userId)
      .is('deleted_at', null)
      .single();

    if (taskError || !task) throw new Error('Task not found');

    const { data: execution, error: execError } = await client
      .from('task_executions')
      .insert({
        task_id: taskId,
        user_id: userId,
        started_at: new Date().toISOString(),
        queue_level: task.queue_level,
        status: 'time_slice_ended',
      })
      .select()
      .single();

    if (execError) throw new Error(`Failed to create execution: ${execError.message}`);

    const { data: updatedTask, error: updateError } = await client
      .from('scheduled_tasks')
      .update({
        status: 'in_progress',
        updated_at: new Date().toISOString(),
      })
      .eq('id', taskId)
      .select()
      .single();

    if (updateError) throw new Error(`Failed to update task: ${updateError.message}`);

    return {
      task: updatedTask as ScheduledTask,
      execution: execution as TaskExecution,
    };
  }

  async pauseTask(
    client: SupabaseClient,
    taskId: string,
    userId: string
  ): Promise<ScheduledTask> {
    const { data: execution, error: execError } = await client
      .from('task_executions')
      .select('*')
      .eq('task_id', taskId)
      .eq('user_id', userId)
      .is('ended_at', null)
      .order('started_at', { ascending: false })
      .limit(1)
      .single();

    if (execError && execError.code !== 'PGRST116') {
      throw new Error(`Failed to find active execution: ${execError.message}`);
    }

    if (execution) {
      const endedAt = new Date();
      const startedAt = new Date(execution.started_at);
      const duration = Math.floor((endedAt.getTime() - startedAt.getTime()) / 1000);

      await client
        .from('task_executions')
        .update({
          ended_at: endedAt.toISOString(),
          duration,
          status: 'interrupted',
        })
        .eq('id', execution.id);
    }

    const { data, error } = await client
      .from('scheduled_tasks')
      .update({
        status: 'paused',
        updated_at: new Date().toISOString(),
      })
      .eq('id', taskId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw new Error(`Failed to pause task: ${error.message}`);
    return data as ScheduledTask;
  }

  async completeTask(
    client: SupabaseClient,
    taskId: string,
    userId: string
  ): Promise<ScheduledTask> {
    const { data: execution, error: execError } = await client
      .from('task_executions')
      .select('*')
      .eq('task_id', taskId)
      .eq('user_id', userId)
      .is('ended_at', null)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (execError) {
      throw new Error(`Failed to find active execution: ${execError.message}`);
    }

    if (execution) {
      const endedAt = new Date();
      const startedAt = new Date(execution.started_at);
      const duration = Math.floor((endedAt.getTime() - startedAt.getTime()) / 1000);

      await client
        .from('task_executions')
        .update({
          ended_at: endedAt.toISOString(),
          duration,
          status: 'completed',
        })
        .eq('id', execution.id);
    }

    const { data: _task, error: taskError } = await client
      .from('scheduled_tasks')
      .select('actual_duration')
      .eq('id', taskId)
      .eq('user_id', userId)
      .single();

    if (taskError) throw new Error('Task not found');

    const { data: allExecutions, error: sumError } = await client
      .from('task_executions')
      .select('duration')
      .eq('task_id', taskId)
      .eq('user_id', userId)
      .not('duration', 'is', null);

    if (sumError) throw new Error(`Failed to calculate total duration: ${sumError.message}`);

    const totalDuration = allExecutions?.reduce((sum, e) => sum + (e.duration || 0), 0) || 0;

    const { data, error } = await client
      .from('scheduled_tasks')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        actual_duration: Math.floor(totalDuration / 60),
        updated_at: new Date().toISOString(),
      })
      .eq('id', taskId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw new Error(`Failed to complete task: ${error.message}`);
    return data as ScheduledTask;
  }

  async moveTaskToQueue(
    client: SupabaseClient,
    taskId: string,
    userId: string,
    targetQueue: number
  ): Promise<ScheduledTask> {
    if (targetQueue < 0 || targetQueue > 2) {
      throw new Error('Invalid queue level. Must be 0, 1, or 2.');
    }

    const { data: maxPosResult } = await client
      .from('scheduled_tasks')
      .select('position')
      .eq('user_id', userId)
      .eq('queue_level', targetQueue)
      .is('deleted_at', null)
      .order('position', { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextPosition = (maxPosResult?.position ?? -1) + 1;

    const { data, error } = await client
      .from('scheduled_tasks')
      .update({
        queue_level: targetQueue,
        position: nextPosition,
        updated_at: new Date().toISOString(),
      })
      .eq('id', taskId)
      .eq('user_id', userId)
      .is('deleted_at', null)
      .select()
      .single();

    if (error) throw new Error(`Failed to move task: ${error.message}`);
    if (!data) throw new Error('Task not found');
    return data as ScheduledTask;
  }

  async reorderTasks(
    client: SupabaseClient,
    userId: string,
    queueLevel: number,
    taskIds: string[]
  ): Promise<ScheduledTask[]> {
    const updates = taskIds.map((id, index) => ({
      id,
      position: index,
      updated_at: new Date().toISOString(),
    }));

    const results: ScheduledTask[] = [];

    for (const update of updates) {
      const { data, error } = await client
        .from('scheduled_tasks')
        .update({
          position: update.position,
          updated_at: update.updated_at,
        })
        .eq('id', update.id)
        .eq('user_id', userId)
        .eq('queue_level', queueLevel)
        .is('deleted_at', null)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to reorder task ${update.id}: ${error.message}`);
      }
      results.push(data as ScheduledTask);
    }

    return results;
  }

  async demoteTask(
    client: SupabaseClient,
    taskId: string,
    userId: string
  ): Promise<ScheduledTask> {
    const { data: task, error: fetchError } = await client
      .from('scheduled_tasks')
      .select('queue_level')
      .eq('id', taskId)
      .eq('user_id', userId)
      .is('deleted_at', null)
      .single();

    if (fetchError || !task) throw new Error('Task not found');

    const currentQueue = task.queue_level;
    if (currentQueue >= 2) {
      throw new Error('Task is already in the lowest priority queue (Q2)');
    }

    return this.moveTaskToQueue(client, taskId, userId, currentQueue + 1);
  }

  getTimeSlice(settings: TaskSettings, queueLevel: number): number {
    switch (queueLevel) {
      case 0:
        return settings.q0_time_slice;
      case 1:
        return settings.q1_time_slice;
      case 2:
        return settings.q2_time_slice;
      default:
        return settings.q0_time_slice;
    }
  }

  async createExecution(
    client: SupabaseClient,
    executionData: Omit<TaskExecution, 'id'>
  ): Promise<TaskExecution> {
    const { data, error } = await client
      .from('task_executions')
      .insert(executionData)
      .select()
      .single();

    if (error) throw new Error(`Failed to create execution: ${error.message}`);
    return data as TaskExecution;
  }

  async updateExecution(
    client: SupabaseClient,
    executionId: string,
    updates: Partial<Omit<TaskExecution, 'id' | 'task_id' | 'user_id'>>
  ): Promise<TaskExecution> {
    const { data, error } = await client
      .from('task_executions')
      .update(updates)
      .eq('id', executionId)
      .select()
      .single();

    if (error) throw new Error(`Failed to update execution: ${error.message}`);
    if (!data) throw new Error('Execution not found');
    return data as TaskExecution;
  }

  async getExecutions(
    client: SupabaseClient,
    userId: string,
    filters?: ExecutionFilters,
    options?: PaginationOptions
  ): Promise<{ executions: TaskExecution[]; total: number }> {
    const { offset, end } = getPaginationParams(options);
    let query = client
      .from('task_executions')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .order('started_at', { ascending: false })
      .range(offset, end);

    if (filters?.task_id) {
      query = query.eq('task_id', filters.task_id);
    }
    if (filters?.status) {
      query = query.eq('status', filters.status);
    }
    if (filters?.from_date) {
      query = query.gte('started_at', filters.from_date);
    }
    if (filters?.to_date) {
      query = query.lte('started_at', filters.to_date);
    }

    const { data, error, count } = await query;
    if (error) throw new Error(`Failed to fetch executions: ${error.message}`);
    return { executions: data as TaskExecution[], total: count || 0 };
  }

  async getSettings(client: SupabaseClient, userId: string): Promise<TaskSettings> {
    const { data, error } = await client
      .from('task_settings')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) throw new Error(`Failed to fetch settings: ${error.message}`);

    if (!data) {
      const { data: newSettings, error: createError } = await client
        .from('task_settings')
        .insert({
          user_id: userId,
          ...DEFAULT_SETTINGS,
        })
        .select()
        .single();

      if (createError) throw new Error(`Failed to create settings: ${createError.message}`);
      return newSettings as TaskSettings;
    }

    return data as TaskSettings;
  }

  async updateSettings(
    client: SupabaseClient,
    userId: string,
    updates: Partial<Omit<TaskSettings, 'id' | 'user_id'>>
  ): Promise<TaskSettings> {
    const existingSettings = await this.getSettings(client, userId);

    const { data, error } = await client
      .from('task_settings')
      .update(updates)
      .eq('id', existingSettings.id)
      .select()
      .single();

    if (error) throw new Error(`Failed to update settings: ${error.message}`);
    return data as TaskSettings;
  }

  async getStats(
    client: SupabaseClient,
    userId: string,
    period: 'day' | 'week' | 'month' = 'week'
  ): Promise<SchedulerStats> {
    const now = new Date();
    let startDate: Date;

    switch (period) {
      case 'day':
        startDate = new Date(now);
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'week':
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 7);
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'month':
        startDate = new Date(now);
        startDate.setMonth(startDate.getMonth() - 1);
        startDate.setHours(0, 0, 0, 0);
        break;
    }

    const { data: tasks, error: tasksError } = await client
      .from('scheduled_tasks')
      .select('*')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .gte('created_at', startDate.toISOString());

    if (tasksError) throw new Error(`Failed to fetch tasks: ${tasksError.message}`);

    const { data: executions, error: execError } = await client
      .from('task_executions')
      .select('*')
      .eq('user_id', userId)
      .gte('started_at', startDate.toISOString());

    if (execError) throw new Error(`Failed to fetch executions: ${execError.message}`);

    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(t => t.status === 'completed').length;
    const totalDuration = executions.reduce((sum, e) => sum + (e.duration || 0), 0);

    const byQueue = {
      q0: { count: 0, duration: 0 },
      q1: { count: 0, duration: 0 },
      q2: { count: 0, duration: 0 },
    };

    tasks.forEach(t => {
      const queueKey = `q${t.queue_level}` as keyof typeof byQueue;
      byQueue[queueKey].count++;
    });

    executions.forEach(e => {
      const queueKey = `q${e.queue_level}` as keyof typeof byQueue;
      byQueue[queueKey].duration += e.duration || 0;
    });

    const byStatus: Record<string, number> = {};
    tasks.forEach(t => {
      byStatus[t.status] = (byStatus[t.status] || 0) + 1;
    });

    const daily: SchedulerStats['daily'] = [];
    const daysCount = period === 'day' ? 1 : period === 'week' ? 7 : 30;

    for (let i = daysCount - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      const dateStr = date.toISOString().split('T')[0];
      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);

      const dayTasks = tasks.filter(t => {
        const completedAt = t.completed_at;
        return completedAt && completedAt >= date.toISOString() && completedAt < nextDate.toISOString();
      });

      const dayExecutions = executions.filter(e => {
        return e.started_at >= date.toISOString() && e.started_at < nextDate.toISOString();
      });

      daily.push({
        date: dateStr,
        completed: dayTasks.length,
        duration: dayExecutions.reduce((sum, e) => sum + (e.duration || 0), 0),
      });
    }

    return {
      total_tasks: totalTasks,
      completed_tasks: completedTasks,
      total_duration: totalDuration,
      by_queue: byQueue,
      by_status: byStatus,
      daily,
    };
  }

  async getHeatmapData(
    client: SupabaseClient,
    userId: string,
    year?: number,
    month?: number
  ): Promise<HeatmapData[]> {
    const targetYear = year ?? new Date().getFullYear();
    const targetMonth = month;

    let startDate: Date;
    let endDate: Date;

    if (targetMonth !== undefined) {
      startDate = new Date(targetYear, targetMonth - 1, 1);
      endDate = new Date(targetYear, targetMonth, 0, 23, 59, 59, 999);
    } else {
      startDate = new Date(targetYear, 0, 1);
      endDate = new Date(targetYear, 11, 31, 23, 59, 59, 999);
    }

    const { data: executions, error } = await client
      .from('task_executions')
      .select('started_at, duration')
      .eq('user_id', userId)
      .gte('started_at', startDate.toISOString())
      .lte('started_at', endDate.toISOString());

    if (error) throw new Error(`Failed to fetch heatmap data: ${error.message}`);

    const groupedByDate: Record<string, { count: number; duration: number }> = {};

    executions.forEach(e => {
      const dateStr = e.started_at.split('T')[0];
      if (!groupedByDate[dateStr]) {
        groupedByDate[dateStr] = { count: 0, duration: 0 };
      }
      groupedByDate[dateStr].count++;
      groupedByDate[dateStr].duration += e.duration || 0;
    });

    return Object.entries(groupedByDate)
      .map(([date, data]) => ({
        date,
        count: data.count,
        duration: data.duration,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  async createFocusSession(
    client: SupabaseClient,
    userId: string,
    data: CreateFocusSessionData
  ): Promise<FocusSession> {
    const { data: session, error } = await client
      .from('focus_sessions')
      .insert({
        user_id: userId,
        task_id: data.task_id,
        started_at: data.started_at,
        ended_at: data.ended_at,
        duration: data.duration,
        pomodoro_count: data.pomodoro_count || 0,
        white_noise_type: data.white_noise_type,
        is_break: data.is_break || false,
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to create focus session: ${error.message}`);
    return session as FocusSession;
  }

  async updateFocusSession(
    client: SupabaseClient,
    sessionId: string,
    userId: string,
    updates: Partial<Omit<FocusSession, 'id' | 'user_id' | 'created_at'>>
  ): Promise<FocusSession> {
    const { data, error } = await client
      .from('focus_sessions')
      .update(updates)
      .eq('id', sessionId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw new Error(`Failed to update focus session: ${error.message}`);
    if (!data) throw new Error('Focus session not found');
    return data as FocusSession;
  }

  async getFocusSessions(
    client: SupabaseClient,
    userId: string,
    options?: {
      from_date?: string;
      to_date?: string;
      task_id?: string;
      is_break?: boolean;
      limit?: number;
    }
  ): Promise<FocusSession[]> {
    let query = client
      .from('focus_sessions')
      .select('*')
      .eq('user_id', userId)
      .order('started_at', { ascending: false });

    if (options?.from_date) {
      query = query.gte('started_at', options.from_date);
    }
    if (options?.to_date) {
      query = query.lte('started_at', options.to_date);
    }
    if (options?.task_id) {
      query = query.eq('task_id', options.task_id);
    }
    if (options?.is_break !== undefined) {
      query = query.eq('is_break', options.is_break);
    }
    if (options?.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;
    if (error) throw new Error(`Failed to fetch focus sessions: ${error.message}`);
    return data as FocusSession[];
  }

  async getUserFocusStats(
    client: SupabaseClient,
    userId: string
  ): Promise<UserFocusStats> {
    const { data, error } = await client
      .from('user_focus_stats')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) throw new Error(`Failed to fetch user focus stats: ${error.message}`);

    if (!data) {
      return {
        id: '',
        user_id: userId,
        total_focus_seconds: 0,
        total_sessions: 0,
        total_pomodoros: 0,
        total_tasks_completed: 0,
        current_streak: 0,
        longest_streak: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    }

    return data as UserFocusStats;
  }

  async getDailyFocusStats(
    client: SupabaseClient,
    userId: string,
    date?: string
  ): Promise<DailyFocusStats> {
    const targetDate = date || new Date().toISOString().split('T')[0];
    const startDate = new Date(targetDate);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 1);

    const { data: sessions, error: sessionsError } = await client
      .from('focus_sessions')
      .select('*')
      .eq('user_id', userId)
      .eq('is_break', false)
      .gte('started_at', startDate.toISOString())
      .lt('started_at', endDate.toISOString());

    if (sessionsError) throw new Error(`Failed to fetch daily sessions: ${sessionsError.message}`);

    const { data: tasks, error: tasksError } = await client
      .from('scheduled_tasks')
      .select('id')
      .eq('user_id', userId)
      .eq('status', 'completed')
      .gte('completed_at', startDate.toISOString())
      .lt('completed_at', endDate.toISOString());

    if (tasksError) throw new Error(`Failed to fetch daily tasks: ${tasksError.message}`);

    const totalDuration = sessions?.reduce((sum, s) => sum + (s.duration || 0), 0) || 0;
    const sessionCount = sessions?.length || 0;
    const pomodoroCount = sessions?.reduce((sum, s) => sum + (s.pomodoro_count || 0), 0) || 0;

    return {
      date: targetDate,
      total_duration: totalDuration,
      session_count: sessionCount,
      pomodoro_count: pomodoroCount,
      tasks_completed: tasks?.length || 0,
      avg_session_duration: sessionCount > 0 ? Math.round(totalDuration / sessionCount) : 0,
    };
  }

  async getWeeklyFocusStats(
    client: SupabaseClient,
    userId: string,
    weekStart?: string
  ): Promise<WeeklyFocusStats> {
    const now = new Date();
    const start = weekStart ? new Date(weekStart) : new Date(now);
    if (!weekStart) {
      start.setDate(start.getDate() - start.getDay());
    }
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);

    const { data: sessions, error: sessionsError } = await client
      .from('focus_sessions')
      .select('*')
      .eq('user_id', userId)
      .eq('is_break', false)
      .gte('started_at', start.toISOString())
      .lt('started_at', end.toISOString());

    if (sessionsError) throw new Error(`Failed to fetch weekly sessions: ${sessionsError.message}`);

    const { data: tasks, error: tasksError } = await client
      .from('scheduled_tasks')
      .select('id, completed_at')
      .eq('user_id', userId)
      .eq('status', 'completed')
      .gte('completed_at', start.toISOString())
      .lt('completed_at', end.toISOString());

    if (tasksError) throw new Error(`Failed to fetch weekly tasks: ${tasksError.message}`);

    const stats = await this.getUserFocusStats(client, userId);

    const dailyStats: Record<string, number> = {};
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      dailyStats[d.toISOString().split('T')[0]] = 0;
    }

    sessions?.forEach(s => {
      const dateStr = new Date(s.started_at).toISOString().split('T')[0];
      if (dailyStats[dateStr] !== undefined) {
        dailyStats[dateStr] += s.duration || 0;
      }
    });

    const totalDuration = sessions?.reduce((sum, s) => sum + (s.duration || 0), 0) || 0;
    const bestDay = Object.entries(dailyStats).reduce(
      (best, [date, duration]) => (duration > best.duration ? { date, duration } : best),
      { date: '', duration: 0 }
    );

    return {
      week_start: start.toISOString().split('T')[0],
      week_end: new Date(end.getTime() - 1).toISOString().split('T')[0],
      total_duration: totalDuration,
      total_sessions: sessions?.length || 0,
      total_pomodoros: sessions?.reduce((sum, s) => sum + (s.pomodoro_count || 0), 0) || 0,
      tasks_completed: tasks?.length || 0,
      daily_average: Math.round(totalDuration / 7),
      best_day: bestDay,
      streak_days: stats.current_streak,
    };
  }

  async getMonthlyFocusStats(
    client: SupabaseClient,
    userId: string,
    year?: number,
    month?: number
  ): Promise<MonthlyFocusStats> {
    const now = new Date();
    const targetYear = year ?? now.getFullYear();
    const targetMonth = month ?? now.getMonth() + 1;

    const startDate = new Date(targetYear, targetMonth - 1, 1);
    const endDate = new Date(targetYear, targetMonth, 0, 23, 59, 59, 999);

    const { data: sessions, error: sessionsError } = await client
      .from('focus_sessions')
      .select('*')
      .eq('user_id', userId)
      .eq('is_break', false)
      .gte('started_at', startDate.toISOString())
      .lte('started_at', endDate.toISOString());

    if (sessionsError) throw new Error(`Failed to fetch monthly sessions: ${sessionsError.message}`);

    const { data: tasks, error: tasksError } = await client
      .from('scheduled_tasks')
      .select('id, completed_at')
      .eq('user_id', userId)
      .eq('status', 'completed')
      .gte('completed_at', startDate.toISOString())
      .lte('completed_at', endDate.toISOString());

    if (tasksError) throw new Error(`Failed to fetch monthly tasks: ${tasksError.message}`);

    const stats = await this.getUserFocusStats(client, userId);

    const dailyStats: Record<string, number> = {};
    const activeDays = new Set<string>();

    sessions?.forEach(s => {
      const dateStr = new Date(s.started_at).toISOString().split('T')[0];
      if (!dailyStats[dateStr]) dailyStats[dateStr] = 0;
      dailyStats[dateStr] += s.duration || 0;
      activeDays.add(dateStr);
    });

    const totalDuration = sessions?.reduce((sum, s) => sum + (s.duration || 0), 0) || 0;
    const bestDay = Object.entries(dailyStats).reduce(
      (best, [date, duration]) => (duration > best.duration ? { date, duration } : best),
      { date: '', duration: 0 }
    );

    const weeksInMonth = Math.ceil(endDate.getDate() / 7);
    const weeklyBreakdown = [];
    for (let w = 0; w < weeksInMonth; w++) {
      const weekStart = new Date(startDate);
      weekStart.setDate(weekStart.getDate() + w * 7);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);

      const weekSessions = sessions?.filter(s => {
        const d = new Date(s.started_at);
        return d >= weekStart && d < weekEnd;
      }) || [];

      weeklyBreakdown.push({
        week: w + 1,
        duration: weekSessions.reduce((sum, s) => sum + (s.duration || 0), 0),
        sessions: weekSessions.length,
      });
    }

    const daysInMonth = endDate.getDate();

    return {
      month: `${targetYear}-${targetMonth.toString().padStart(2, '0')}`,
      total_duration: totalDuration,
      total_sessions: sessions?.length || 0,
      total_pomodoros: sessions?.reduce((sum, s) => sum + (s.pomodoro_count || 0), 0) || 0,
      tasks_completed: tasks?.length || 0,
      daily_average: Math.round(totalDuration / daysInMonth),
      active_days: activeDays.size,
      best_day: bestDay,
      streak_longest: stats.longest_streak,
      weekly_breakdown: weeklyBreakdown,
    };
  }

  async getYearlyHeatmap(
    client: SupabaseClient,
    userId: string,
    year?: number
  ): Promise<HeatmapData[]> {
    const targetYear = year ?? new Date().getFullYear();
    const startDate = new Date(targetYear, 0, 1);
    const endDate = new Date(targetYear, 11, 31, 23, 59, 59, 999);

    const { data: sessions, error } = await client
      .from('focus_sessions')
      .select('started_at, duration')
      .eq('user_id', userId)
      .eq('is_break', false)
      .gte('started_at', startDate.toISOString())
      .lte('started_at', endDate.toISOString());

    if (error) throw new Error(`Failed to fetch yearly heatmap: ${error.message}`);

    const groupedByDate: Record<string, { count: number; duration: number }> = {};

    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      groupedByDate[dateStr] = { count: 0, duration: 0 };
    }

    sessions?.forEach(s => {
      const dateStr = new Date(s.started_at).toISOString().split('T')[0];
      if (groupedByDate[dateStr]) {
        groupedByDate[dateStr].count++;
        groupedByDate[dateStr].duration += s.duration || 0;
      }
    });

    return Object.entries(groupedByDate)
      .map(([date, data]) => ({
        date,
        count: data.count,
        duration: data.duration,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  async getAllAchievements(client: SupabaseClient): Promise<Achievement[]> {
    const { data, error } = await client
      .from('achievements')
      .select('*')
      .order('category')
      .order('condition_value');

    if (error) throw new Error(`Failed to fetch achievements: ${error.message}`);
    return data as Achievement[];
  }

  async getUserAchievements(
    client: SupabaseClient,
    userId: string
  ): Promise<(UserAchievement & { achievement: Achievement })[]> {
    const { data, error } = await client
      .from('user_achievements')
      .select('*, achievement:achievements(*)')
      .eq('user_id', userId)
      .order('unlocked_at', { ascending: false });

    if (error) throw new Error(`Failed to fetch user achievements: ${error.message}`);
    return data as (UserAchievement & { achievement: Achievement })[];
  }

  async checkAndUnlockAchievements(
    client: SupabaseClient,
    userId: string
  ): Promise<AchievementCheckResult> {
    const stats = await this.getUserFocusStats(client, userId);
    const allAchievements = await this.getAllAchievements(client);
    const userAchievements = await this.getUserAchievements(client, userId);
    const unlockedCodes = new Set(userAchievements.map(ua => ua.achievement.code));

    const unlocked: Achievement[] = [];
    const progress: AchievementCheckResult['progress'] = [];

    for (const achievement of allAchievements) {
      if (unlockedCodes.has(achievement.code)) continue;

      let current = 0;
      switch (achievement.condition_type) {
        case 'focus_sessions':
          current = stats.total_sessions;
          break;
        case 'total_focus_hours':
          current = Math.floor(stats.total_focus_seconds / 3600);
          break;
        case 'consecutive_days':
          current = stats.current_streak;
          break;
        case 'tasks_completed':
          current = stats.total_tasks_completed;
          break;
        case 'pomodoros_completed':
          current = stats.total_pomodoros;
          break;
        case 'daily_focus_hours': {
          const todayStats = await this.getDailyFocusStats(client, userId);
          current = Math.floor(todayStats.total_duration / 3600);
          break;
        }
        default:
          continue;
      }

      const percentage = Math.min(100, Math.round((current / achievement.condition_value) * 100));

      if (current >= achievement.condition_value) {
        const { error: insertError } = await client
          .from('user_achievements')
          .insert({
            user_id: userId,
            achievement_id: achievement.id,
            progress: 100,
            metadata: { unlocked_value: current },
          });

        if (!insertError) {
          unlocked.push(achievement);
        }
      } else {
        progress.push({
          achievement,
          current,
          target: achievement.condition_value,
          percentage,
        });
      }
    }

    return { unlocked, progress };
  }

  async checkSpecialAchievements(
    client: SupabaseClient,
    userId: string,
    session: FocusSession
  ): Promise<Achievement[]> {
    const unlocked: Achievement[] = [];
    const userAchievements = await this.getUserAchievements(client, userId);
    const unlockedCodes = new Set(userAchievements.map(ua => ua.achievement.code));

    const sessionHour = new Date(session.started_at).getHours();

    if (!unlockedCodes.has('night_owl') && sessionHour >= 0 && sessionHour < 5) {
      const achievement = await this.unlockSpecialAchievement(client, userId, 'night_owl');
      if (achievement) unlocked.push(achievement);
    }

    if (!unlockedCodes.has('early_bird') && sessionHour >= 5 && sessionHour < 7) {
      const achievement = await this.unlockSpecialAchievement(client, userId, 'early_bird');
      if (achievement) unlocked.push(achievement);
    }

    const dayOfWeek = new Date(session.started_at).getDay();
    if (!unlockedCodes.has('weekend_warrior') && (dayOfWeek === 0 || dayOfWeek === 6)) {
      const dailyStats = await this.getDailyFocusStats(client, userId);
      if (dailyStats.total_duration >= 4 * 3600) {
        const achievement = await this.unlockSpecialAchievement(client, userId, 'weekend_warrior');
        if (achievement) unlocked.push(achievement);
      }
    }

    return unlocked;
  }

  private async unlockSpecialAchievement(
    client: SupabaseClient,
    userId: string,
    code: string
  ): Promise<Achievement | null> {
    const { data: achievement, error: achievementError } = await client
      .from('achievements')
      .select('*')
      .eq('code', code)
      .single();

    if (achievementError || !achievement) return null;

    const { error: insertError } = await client
      .from('user_achievements')
      .insert({
        user_id: userId,
        achievement_id: achievement.id,
        progress: 100,
        metadata: { unlocked_at: new Date().toISOString() },
      });

    if (insertError) return null;
    return achievement as Achievement;
  }
}

export const schedulerService = new SchedulerService();

import { SupabaseClient } from '@supabase/supabase-js';
import { getPaginationParams, PaginationOptions } from '../../utils/pagination.js';

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

export class TaskService {
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
}

export const taskService = new TaskService();

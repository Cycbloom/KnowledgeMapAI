
import { SupabaseClient } from '@supabase/supabase-js';

export interface Task {
  id: string;
  user_id: string;
  type: 'generate_questions' | 'expand_graph';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  payload: any;
  result: any;
  error?: string;
  created_at: string;
  updated_at: string;
}

export class TaskService {
  async createTask(supabase: SupabaseClient, userId: string, type: string, payload: any) {
    const { data, error } = await supabase
      .from('tasks')
      .insert({
        user_id: userId,
        type,
        payload,
        status: 'pending'
      })
      .select()
      .single();

    if (error) throw error;
    return data as Task;
  }

  async getTasks(supabase: SupabaseClient, userId: string, status?: string) {
    let query = supabase
      .from('tasks')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data as Task[];
  }

  async retryTask(supabase: SupabaseClient, taskId: string, userId: string) {
    // Only failed tasks can be retried
    const { data: task, error: fetchError } = await supabase
      .from('tasks')
      .select('*')
      .eq('id', taskId)
      .eq('user_id', userId)
      .single();

    if (fetchError) throw fetchError;
    if (!task) throw new Error('Task not found');
    if (task.status !== 'failed') throw new Error('Only failed tasks can be retried');

    const { data, error } = await supabase
      .from('tasks')
      .update({
        status: 'pending',
        error: null,
        result: null,
        created_at: new Date().toISOString(), // Move to top of queue
        updated_at: new Date().toISOString()
      })
      .eq('id', taskId)
      .select()
      .single();

    if (error) throw error;
    return data as Task;
  }

  async deleteTask(supabase: SupabaseClient, taskId: string, userId: string) {
    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', taskId)
      .eq('user_id', userId);

    if (error) throw error;
    return true;
  }

  async getPendingTasks(supabase: SupabaseClient) {
    // Note: This requires Service Role Key in the worker
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(5); // Process 5 at a time

    if (error) throw error;
    return data as Task[];
  }

  async updateTaskStatus(supabase: SupabaseClient, taskId: string, status: string, result?: any, errorMsg?: string) {
    const updateData: any = {
      status,
      updated_at: new Date().toISOString()
    };

    if (result) updateData.result = result;
    if (errorMsg) updateData.error = errorMsg;

    const { error } = await supabase
      .from('tasks')
      .update(updateData)
      .eq('id', taskId);

    if (error) throw error;
  }
}

export const taskService = new TaskService();

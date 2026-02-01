
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

  async getTasks(supabase: SupabaseClient, userId: string) {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;
    return data as Task[];
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

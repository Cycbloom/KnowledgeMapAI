import type { SupabaseClient } from '@supabase/supabase-js';

export type UpdateTaskStatusFunction = (
  supabase: SupabaseClient,
  taskId: string,
  status: string,
  progress?: { stage?: string; progress?: number; [key: string]: unknown } | null,
  result?: any,
  errorMsg?: string,
  userId?: string
) => Promise<void>;

export interface TaskProcessor {
  process(taskId: string, userId: string, payload: any, supabase: SupabaseClient, updateTaskStatus: UpdateTaskStatusFunction): Promise<void>;
}

export const taskProcessors: Record<string, TaskProcessor> = {};

export function registerProcessor(type: string, processor: TaskProcessor) {
  taskProcessors[type] = processor;
}

export function getProcessor(type: string): TaskProcessor | undefined {
  return taskProcessors[type];
}

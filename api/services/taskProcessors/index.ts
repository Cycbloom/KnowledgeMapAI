import type { SupabaseClient } from '@supabase/supabase-js';
import type { Task } from '../taskService.js';

export interface TaskProcessor {
  process(taskId: string, userId: string, payload: any, supabase: SupabaseClient, updateTaskStatus: Function): Promise<void>;
}

export const taskProcessors: Record<string, TaskProcessor> = {};

export function registerProcessor(type: string, processor: TaskProcessor) {
  taskProcessors[type] = processor;
}

export function getProcessor(type: string): TaskProcessor | undefined {
  return taskProcessors[type];
}

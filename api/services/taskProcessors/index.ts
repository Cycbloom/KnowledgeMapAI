import type { SupabaseClient } from '@supabase/supabase-js';

export interface TaskProgress {
  stage?: string;
  progress?: number;
  [key: string]: unknown;
}

export interface UpdateTaskStatusOptions {
  taskId: string;
  status: string;
  progress?: TaskProgress | null;
  result?: any;
  error?: string;
  userId?: string;
  client?: SupabaseClient;
}

export type UpdateTaskStatusFunction = (
  arg1: SupabaseClient | string | UpdateTaskStatusOptions,
  arg2?: string,
  arg3?: string,
  arg4?: TaskProgress | null,
  arg5?: any,
  arg6?: string,
  arg7?: string,
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

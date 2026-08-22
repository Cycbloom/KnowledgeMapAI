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
  result?: Record<string, unknown>;
  error?: string;
  userId?: string;
  client?: SupabaseClient;
}

export type UpdateTaskStatusFunction = (
  arg1: SupabaseClient | string | UpdateTaskStatusOptions,
  arg2?: string,
  arg3?: string,
  arg4?: TaskProgress | null,
  arg5?: Record<string, unknown>,
  arg6?: string,
  arg7?: string,
) => Promise<void>;

/**
 * 任务协作控制信号。
 *
 * 任务处理期间，外部请求（暂停/终止）通过 AsyncTaskService 的内存控制表
 * 写入信号，processor 在每个批次的检查点调用 {@link TaskControl.throwIfAborted}
 * 协作式响应，避免强制中断当前 AI 调用导致半成品数据。
 */
export type TaskControlSignal = "ok" | "pause" | "cancel";

/**
 * 处理器收到的协作控制句柄。
 *
 * - signal(): 读取当前信号（ok / pause / cancel）
 * - throwIfAborted(): 存在 pause/cancel 信号时抛出 TaskAbortError，
 *   由 processor 的 catch 分支统一落库（paused / cancelled）后正常返回
 */
export interface TaskControl {
  signal(): TaskControlSignal;
  throwIfAborted(): void;
}

/**
 * 协作式中断异常。processor 收到 pause/cancel 信号时抛出，
 * 外层 catch 识别该异常后标记对应终态（paused / cancelled），
 * 与真正的业务失败（置 failed）区分开。
 */
export class TaskAbortError extends Error {
  constructor(public readonly reason: "paused" | "cancelled") {
    super(reason === "paused" ? "Task paused" : "Task cancelled");
    this.name = "TaskAbortError";
  }
}

export interface TaskProcessor {
  process(
    taskId: string,
    userId: string,
    payload: unknown,
    supabase: SupabaseClient,
    updateTaskStatus: UpdateTaskStatusFunction,
    control: TaskControl,
  ): Promise<void>;
}

export const taskProcessors: Record<string, TaskProcessor> = {};

export function registerProcessor(type: string, processor: TaskProcessor) {
  taskProcessors[type] = processor;
}

export function getProcessor(type: string): TaskProcessor | undefined {
  return taskProcessors[type];
}

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { sseService } from "./core/sseService";
import { logger } from "../utils/logger";
import { getProcessor, TaskAbortError, type TaskControl, type TaskControlSignal } from "./taskProcessors/index";
import { getPaginationParams, PaginationOptions } from "../utils/pagination";
import { AppError } from "../middleware/errorHandler";
import { ErrorCodes } from "../../shared/types/errorCodes";
import { Task } from "../../shared/types/common";
import type { SystemTaskType, SystemTask } from "../../shared/types/scheduler";
import "./taskProcessors/batchGenerateCardsProcessor.js";
import "./taskProcessors/recursiveGraphProcessor.js";
import "./taskProcessors/infiniteExpansionProcessor.js";
import "./taskProcessors/embeddingGenerationProcessor.js";
import "./taskProcessors/quizGenerationProcessor.js";
import "./taskProcessors/generateQuestionsProcessor.js";
import "./taskProcessors/expandGraphProcessor.js";
import "./taskProcessors/translateNodesProcessor.js";
import "./taskProcessors/discoverNodeRelationsProcessor.js";

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

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey =
  process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

let defaultClient: SupabaseClient;

try {
  const validUrl = supabaseUrl || 'https://placeholder.supabase.co';
  const validKey = supabaseServiceKey || supabaseKey || 'placeholder-key';
  
  defaultClient = createClient(validUrl, validKey);
  logger.info('TaskService Supabase client initialized successfully');
} catch (error) {
  logger.error('Failed to initialize AsyncTaskService Supabase client:', error);
  defaultClient = createClient('https://placeholder.supabase.co', 'placeholder-key');
}

export class AsyncTaskService {
  private static readonly MAX_CONCURRENT = 3;
  private activeCount = 0;

  /**
   * 进程内任务控制表：外部请求（暂停/终止）写入信号，
   * processor 在批次检查点通过 buildTaskControl 读取并协作式响应。
   * 任务结束后（finally）清理对应条目。
   */
  private taskControls = new Map<string, { pause: boolean; cancel: boolean }>();

  /**
   * 为指定任务构建协作控制句柄。
   *
   * 信号优先级：cancel > pause > ok。仅本进程正在处理的任务有对应条目；
   * 不在本进程（pending/paused 或其它实例）的任务 signal 恒为 ok，
   * 由 pauseTask/cancelTask 直接落库处理。
   */
  private buildTaskControl(taskId: string): TaskControl {
    const getSignal = (): TaskControlSignal => {
      const c = this.taskControls.get(taskId);
      if (c?.cancel) return "cancel";
      if (c?.pause) return "pause";
      return "ok";
    };
    return {
      signal: getSignal,
      throwIfAborted: () => {
        const signal = getSignal();
        if (signal === "pause") throw new TaskAbortError("paused");
        if (signal === "cancel") throw new TaskAbortError("cancelled");
      },
    };
  }

  private mapTaskTypeToSystemTaskType(type: string): SystemTaskType {
    const typeMap: Record<string, SystemTaskType> = {
      "generate_questions": "ai_generation",
      "generate_quiz": "ai_generation",
      "batch_generate_questions": "ai_generation",
      "expand_graph": "graph_expansion",
      "recursive_graph_generation": "graph_expansion",
      "infinite_graph_expansion": "graph_expansion",
      "embedding_generation": "knowledge_sync",
      "translate_nodes": "ai_generation",
      "discover_node_relations": "ai_generation",
    };
    return typeMap[type] || "ai_generation";
  }

  /**
   * 启动恢复：查询滞留的 pending 任务（created_at 早于 5 分钟前）并恢复执行。
   *
   * 用于进程重启后恢复因崩溃/重启而中断的 pending 任务。非阻塞调用，
   * 内部错误被捕获并记录，不影响主进程启动。
   */
  async initialize(): Promise<void> {
    try {
      const supabase = defaultClient;
      const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);

      const { data, error } = await supabase
        .from("system_tasks")
        .select("*")
        .eq("status", "pending")
        .lt("created_at", fiveMinAgo.toISOString())
        .order("created_at", { ascending: true })
        .limit(20);

      if (error) {
        logger.error("asyncTaskService.initialize: failed to fetch stalled tasks:", error);
        return;
      }

      const stalledTasks = (data as SystemTask[] | null) ?? [];
      if (stalledTasks.length === 0) {
        logger.info("asyncTaskService.initialize: no stalled tasks to recover");
        return;
      }

      logger.info(`asyncTaskService.initialize: recovering ${stalledTasks.length} stalled task(s)`);

      for (const task of stalledTasks) {
        const originalType = this.getOriginalTaskType(task.task_type, task.title);
        const payload = (task.input_data as Record<string, unknown>) ?? {};
        this.processTaskAsync(task.id, task.user_id, originalType, payload).catch((err) => {
          logger.error(`asyncTaskService.initialize: failed to recover task ${task.id}:`, err);
        });
      }
    } catch (error) {
      logger.error("asyncTaskService.initialize: unexpected error:", error);
    }
  }

  /**
   * 乐观锁 claim：原子地将任务从 pending → running。
   *
   * 使用 `UPDATE ... WHERE id = ? AND status = 'pending' RETURNING *` 模式，
   * 多实例并发时仅一者能 claim 成功（返回非空数组），其余返回空数组并跳过。
   *
   * @returns claim 成功返回 true，失败（已被其他实例处理或不存在）返回 false
   */
  private async claimTask(taskId: string): Promise<boolean> {
    const supabase = defaultClient;
    const { data, error } = await supabase
      .from("system_tasks")
      .update({
        status: "running",
        claimed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", taskId)
      .eq("status", "pending")
      .select();

    if (error) {
      logger.error(`claimTask: failed to claim task ${taskId}:`, error);
      return false;
    }

    return Array.isArray(data) && data.length > 0;
  }

  async createTask(userId: string, type: string, payload?: Record<string, unknown>, name?: string) {
    const supabase = defaultClient;
    const systemTaskType = this.mapTaskTypeToSystemTaskType(type);

    const { data, error } = await supabase
      .from("system_tasks")
      .insert({
        user_id: userId,
        task_type: systemTaskType,
        title: name || type,
        status: "pending",
        input_data: payload || {},
      })
      .select()
      .single();

    if (error) throw new AppError(ErrorCodes.DATABASE_QUERY_ERROR, { message: `Failed to create task: ${error.message}` });

    logger.info("Processing task synchronously");
    this.processTaskAsync(data.id, userId, type, payload || {}).catch((err) => {
      logger.error(`Failed to process task ${data.id} synchronously:`, err);
    });

    return data as Task;
  }

  /**
   * 异步处理任务：先通过 claimTask 原子抢占，再执行 processTask。
   *
   * 并发控制：全局 MAX_CONCURRENT=3 信号量，超过上限的任务保留 pending
   * 状态等待下次轮询（initialize 或 createTask 触发）。
   *
   * 注意：activeCount 必须在 await 之前同步递增，否则在 for 循环中并发调用
   * processTaskAsync 时所有任务都会通过并发检查，导致信号量失效。
   */
  private async processTaskAsync(
    taskId: string,
    userId: string,
    type: string,
    payload: Record<string, unknown>,
  ) {
    this.activeCount += 1;
    if (this.activeCount > AsyncTaskService.MAX_CONCURRENT) {
      this.activeCount -= 1;
      logger.info(`processTaskAsync: concurrency limit reached, skipping task ${taskId} (will retry on next poll)`);
      return;
    }

    try {
      const claimed = await this.claimTask(taskId);
      if (!claimed) {
        logger.info(`processTaskAsync: task ${taskId} already claimed by another instance, skipping`);
        return;
      }

      // claim 成功后建立控制条目：暂停/终止请求通过写入该条目信号，
      // 处理器在批次检查点协作式响应。finally 中统一清理。
      this.taskControls.set(taskId, { pause: false, cancel: false });

      await this.processTask(taskId, userId, type, payload);
    } catch (error) {
      logger.error(`Error in async task processing for task ${taskId}:`, error);
    } finally {
      this.activeCount -= 1;
      this.taskControls.delete(taskId);
    }
  }

  async updateTaskStatus(
    arg1: SupabaseClient | string | UpdateTaskStatusOptions,
    arg2?: string,
    arg3?: string,
    arg4?: TaskProgress | null,
    arg5?: Record<string, unknown>,
    arg6?: string,
    arg7?: string,
  ) {
    let supabase: SupabaseClient;
    let taskId: string;
    let status: string;
    let progress: TaskProgress | null | undefined;
    let result: Record<string, unknown> | undefined;
    let errorMsg: string | undefined;
    let userId: string | undefined;

    if (typeof arg1 === 'object' && arg1 !== null && 'taskId' in arg1 && 'status' in arg1) {
      const options = arg1 as UpdateTaskStatusOptions;
      supabase = options.client || defaultClient;
      taskId = options.taskId;
      status = options.status;
      progress = options.progress;
      result = options.result;
      errorMsg = options.error;
      userId = options.userId;
    } else {
      if (typeof arg1 !== "string" && arg1 !== undefined) {
        supabase = arg1 as SupabaseClient;
        taskId = arg2 ?? "";
        status = arg3 ?? "";
        progress = arg4;
        result = arg5;
        errorMsg = arg6;
        userId = arg7;
      } else {
        supabase = defaultClient;
        taskId = arg1 as string;
        status = arg2 ?? "";
        result = arg3 as unknown as Record<string, unknown> | undefined;
        errorMsg = arg4 as unknown as string | undefined;
        userId = arg5 as unknown as string | undefined;
        progress = undefined;
      }
    }

    const updateData: {
      status: string;
      updated_at: string;
      output_data?: Record<string, unknown>;
      error_message?: string;
      runtime_progress?: Record<string, unknown> | null;
    } = { status, updated_at: new Date().toISOString() };
    if (result) updateData.output_data = result;
    if (errorMsg) updateData.error_message = errorMsg;
    // Persist runtime progress to the DB column so Task Center can always
    // render a progress bar after refresh / SSE reconnection. When the
    // processor explicitly passes null we clear it (e.g. terminal failed
    // state to hide stale percent); undefined keeps the column unchanged
    // so callers that only update status don't wipe existing progress.
    if (progress === null) {
      updateData.runtime_progress = null;
    } else if (progress !== undefined) {
      updateData.runtime_progress =
        typeof progress === 'object' && progress !== null
          ? (progress as Record<string, unknown>)
          : { progress };
    }

    logger.info(`Updating task ${taskId} status to ${status}`, {
      stage: progress?.stage,
      progress: progress?.progress,
      percent:
        typeof progress === 'object' && progress !== null
          ? (progress as Record<string, unknown>).percent ??
            (progress as Record<string, unknown>).progress
          : undefined,
    });

    const { error } = await supabase
      .from("system_tasks")
      .update(updateData)
      .eq("id", taskId);

    if (error) throw error;

    if (userId) {
      sseService.sendToUser(userId, {
        type: "task_update",
        taskId,
        status,
        result,
        error: errorMsg,
        // 透传 processor 计算的运行时进度（stage/percent/completed/total 等），
        // 前端 useTaskEvents 将其写入 task.runtime_progress 字段。
        // progress 为 undefined/null 时 JSON.stringify 会省略该字段，前端降级为原 spinner。
        progress: progress ?? undefined,
      });
    }
  }

  async getTasks(
    client: SupabaseClient,
    userId: string,
    status?: string,
    options?: PaginationOptions,
  ) {
    const { offset, end } = getPaginationParams(options);
    let query = client
      .from("system_tasks")
      .select("*", { count: "exact" })
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .range(offset, end);

    if (status && status !== "all") {
      query = query.eq("status", status);
    }

    const { data, error, count } = await query;
    if (error) throw new AppError(ErrorCodes.DATABASE_QUERY_ERROR, { message: `Failed to fetch tasks: ${error.message}` });
    return { tasks: data as Task[], total: count || 0 };
  }

  async getTask(
    client: SupabaseClient,
    taskId: string,
    userId: string,
  ): Promise<Task | null> {
    const { data, error } = await client
      .from("system_tasks")
      .select("*")
      .eq("id", taskId)
      .eq("user_id", userId)
      .single();

    if (error && error.code !== "PGRST116")
      {throw new AppError(ErrorCodes.DATABASE_QUERY_ERROR, { message: `Failed to fetch task: ${error.message}` });}
    return data as Task | null;
  }

  async getPendingTasks(client: SupabaseClient) {
    const { data, error } = await client
      .from("system_tasks")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(10);

    if (error) throw error;
    return data as Task[];
  }

  async retryTask(client: SupabaseClient, taskId: string, userId: string) {
    const { data: task, error: fetchError } = await client
      .from("system_tasks")
      .select("*")
      .eq("id", taskId)
      .eq("user_id", userId)
      .single();

    if (fetchError || !task) throw new AppError(ErrorCodes.RESOURCE_NOT_FOUND, { message: "Task not found" });

    const { data, error } = await client
      .from("system_tasks")
      .update({
        status: "pending",
        retry_count: (task.retry_count || 0) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("id", taskId)
      .eq("user_id", userId)
      .select()
      .single();

    if (error) throw new AppError(ErrorCodes.DATABASE_QUERY_ERROR, { message: `Failed to retry task: ${error.message}` });

    logger.info("Processing retried task synchronously");
    const originalType = this.getOriginalTaskType(task.task_type, task.title);
    this.processTaskAsync(data.id, userId, originalType, (task.input_data as Record<string, unknown>) || {}).catch(
      (err) => {
        logger.error(
          `Failed to process retried task ${data.id} synchronously:`,
          err,
        );
      },
    );

    return data as Task;
  }

  /**
   * 还原精确的 processor 类型。
   *
   * system_tasks.task_type 只保存粗粒度 SystemTaskType（如 ai_generation），
   * 同一个 SystemTaskType 下可能注册多个 processor（ai_generation 下既有
   * generate_questions 也有 generate_quiz）。createTask 时 title 默认等于
   * 原始类型（title = name || type），因此优先用 title 精确还原 processor；
   * 否则回退到粗粒度反查表（保证旧任务/自定义名称仍可执行）。
   */
  private getOriginalTaskType(systemTaskType: string, title?: string): string {
    if (title && getProcessor(title)) {
      return title;
    }
    const reverseMap: Record<string, string> = {
      "ai_generation": "generate_questions",
      "graph_expansion": "expand_graph",
      "knowledge_sync": "embedding_generation",
    };
    return reverseMap[systemTaskType] || systemTaskType;
  }

  async deleteTask(client: SupabaseClient, taskId: string, userId: string) {
    const { error } = await client
      .from("system_tasks")
      .delete()
      .eq("id", taskId)
      .eq("user_id", userId);

    if (error) throw new AppError(ErrorCodes.DATABASE_QUERY_ERROR, { message: `Failed to delete task: ${error.message}` });
  }

  private async loadTask(taskId: string): Promise<SystemTask> {
    const supabase = defaultClient;
    const { data, error } = await supabase
      .from("system_tasks")
      .select("*")
      .eq("id", taskId)
      .single();

    if (error || !data) {
      throw new AppError(ErrorCodes.RESOURCE_NOT_FOUND, { message: "Task not found" });
    }
    return data as SystemTask;
  }

  private isTerminal(status: string): boolean {
    return status === "completed" || status === "failed" || status === "cancelled";
  }

  /**
   * 终止任务。
   *
   * - 运行中任务（本进程有控制条目）：写入 cancel 信号，processor 在下一批次
   *   检查点协作停止并置 cancelled（SSE 广播由 processor 触发）。
   * - 未运行任务（pending/paused 或其它实例）：直接置 cancelled。
   */
  async cancelTask(taskId: string, userId: string) {
    const task = await this.loadTask(taskId);
    if (this.isTerminal(task.status)) {
      throw new AppError(ErrorCodes.VALIDATION_ERROR, { message: "Task has already finished" });
    }

    const control = this.taskControls.get(taskId);
    if (control) {
      control.cancel = true;
      control.pause = false;
      return { success: true, pending: true };
    }

    await this.updateTaskStatus(taskId, "cancelled", undefined, undefined, undefined, userId);
    return { success: true };
  }

  /**
   * 暂停任务。
   *
   * - 运行中任务（本进程有控制条目）：写入 pause 信号，processor 在当前批次
   *   完成后协作暂停并置 paused。
   * - 未运行任务（pending）：直接置 paused，claim（仅 pending → running）
   *   不会将其拾起。
   */
  async pauseTask(taskId: string, userId: string) {
    const task = await this.loadTask(taskId);
    if (this.isTerminal(task.status) || task.status === "paused") {
      throw new AppError(ErrorCodes.VALIDATION_ERROR, { message: "Task cannot be paused in current state" });
    }

    const control = this.taskControls.get(taskId);
    if (control) {
      control.pause = true;
      return { success: true, pending: true };
    }

    await this.updateTaskStatus(taskId, "paused", undefined, undefined, undefined, userId);
    return { success: true };
  }

  /**
   * 恢复暂停的任务。
   *
   * 状态 paused → pending 并重新触发 processTaskAsync（重新 claim 后从头执行；
   * embedding 等幂等处理器会天然跳过已完成部分，近似续跑）。
   */
  async resumeTask(taskId: string, userId: string) {
    const task = await this.loadTask(taskId);
    if (task.status !== "paused") {
      throw new AppError(ErrorCodes.VALIDATION_ERROR, { message: "Only paused tasks can be resumed" });
    }

    this.taskControls.delete(taskId);
    await this.updateTaskStatus(taskId, "pending", undefined, undefined, undefined, userId);

    const originalType = this.getOriginalTaskType(task.task_type, task.title);
    const payload = (task.input_data as Record<string, unknown>) ?? {};
    this.processTaskAsync(task.id, task.user_id, originalType, payload).catch((err) => {
      logger.error(`Failed to resume task ${task.id}:`, err);
    });

    return { success: true };
  }

  async processTask(
    taskId: string,
    userId: string,
    type: string,
    payload: Record<string, unknown>,
  ) {
    const supabase = defaultClient;
    const processor = getProcessor(type);

    if (!processor) {
      logger.error(`No processor found for task type: ${type}`);
      await this.updateTaskStatus({
        taskId,
        status: "failed",
        error: `Unknown task type: ${type}`,
        userId,
      });
      return;
    }

    await processor.process(
      taskId,
      userId,
      payload,
      supabase,
      this.updateTaskStatus.bind(this),
      this.buildTaskControl(taskId),
    );
  }
}

export const asyncTaskService = new AsyncTaskService();

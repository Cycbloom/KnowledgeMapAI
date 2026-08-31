import { SupabaseClient } from "@supabase/supabase-js";
import {
  getPaginationParams,
  PaginationOptions,
} from "../../utils/pagination";
import { AppError } from "../../middleware/errorHandler";
import { ErrorCodes } from "../../../shared/types/errorCodes";
import type {
  ActivityKind,
  ActivitySlice,
  LearningState,
} from "../../../shared/types/scheduler";

export interface TaskExecution {
  id: string;
  task_id: string;
  user_id: string;
  subtask_id?: string;
  knowledge_point_id?: string;
  stage?: LearningState;
  activity_log?: ActivitySlice[];
  started_at: string | null;
  ended_at?: string;
  duration?: number;
  queue_level: number;
  status:
    | "completed"
    | "interrupted"
    | "time_slice_ended"
    | "pending"
    | "in_progress";
}

/** 一次学习/答题活动的上下文，用于会话 beingActivity/appendSlice/pending 回写 */
export interface SessionActivityContext {
  taskId?: string;
  subtaskId?: string;
  knowledgePointId?: string;
  stage?: LearningState;
  kind: ActivityKind;
}

export interface ExecutionFilters {
  task_id?: string;
  from_date?: string;
  to_date?: string;
  status?: string;
}

export class ExecutionService {
  async createExecution(
    client: SupabaseClient,
    executionData: Omit<TaskExecution, "id">,
  ): Promise<TaskExecution> {
    const { data, error } = await client
      .from("task_executions")
      .insert(executionData)
      .select()
      .single();

    if (error) throw new AppError(ErrorCodes.SCHEDULER_TASK_EXECUTION_FAILED, { details: { originalError: error.message } });
    return data as TaskExecution;
  }

  async updateExecution(
    client: SupabaseClient,
    executionId: string,
    updates: Partial<Omit<TaskExecution, "id" | "task_id" | "user_id">>,
  ): Promise<TaskExecution> {
    const { data, error } = await client
      .from("task_executions")
      .update(updates)
      .eq("id", executionId)
      .select()
      .single();

    if (error) throw new AppError(ErrorCodes.SCHEDULER_TASK_EXECUTION_FAILED, { details: { originalError: error.message } });
    if (!data) throw new AppError(ErrorCodes.RESOURCE_NOT_FOUND);
    return data as TaskExecution;
  }

  /**
   * 查找该用户最新一条打开的会话（in_progress）。
   */
  async findOpen(
    client: SupabaseClient,
    userId: string,
  ): Promise<TaskExecution | null> {
    const { data, error } = await client
      .from("task_executions")
      .select("*")
      .eq("user_id", userId)
      .eq("status", "in_progress")
      .order("started_at", { ascending: false })
      .limit(1);

    if (error) {
      throw new AppError(ErrorCodes.SCHEDULER_TASK_EXECUTION_FAILED, { details: { originalError: error.message } });
    }
    return (data?.[0] as TaskExecution) ?? null;
  }

  /**
   * 开始/延续一次学习活动会话。
   * - 无开会话 → 新建一条 in_progress 会话并开始计时。
   * - 开会话且上下文(kp/kind)变化 → 收尾上一片段并追加新片段。
   * - 上下文一致 → 幂等 no-op。
   */
  async beginActivity(
    client: SupabaseClient,
    userId: string,
    ctx: SessionActivityContext,
  ): Promise<TaskExecution | null> {
    const now = new Date().toISOString();
    const open = await this.findOpen(client, userId);

    if (open) {
      const openNorm = this.normalize(open);
      const current = this.currentSlice(openNorm.activity_log);
      const sameContext =
        !!current &&
        current.kind === ctx.kind &&
        (current.knowledge_point_id ?? null) ===
          (ctx.knowledgePointId ?? null) &&
        !current.ended_at;

      if (sameContext) return openNorm;

      const closedLog = this.finalizeCurrentSlice(openNorm.activity_log, now);
      const nextSlice: ActivitySlice = {
        kind: ctx.kind,
        knowledge_point_id: ctx.knowledgePointId,
        started_at: now,
      };
      const activityLog = [...closedLog, nextSlice];
      const updates: Partial<Omit<TaskExecution, "id" | "task_id" | "user_id">> =
        {
          activity_log: activityLog,
          stage: ctx.stage ?? openNorm.stage,
          knowledge_point_id: ctx.knowledgePointId ?? openNorm.knowledge_point_id,
          subtask_id: ctx.subtaskId ?? openNorm.subtask_id,
        };
      return this.updateExecution(client, openNorm.id, updates);
    }

    if (!ctx.taskId) return null;
    const newExecution = await this.createExecution(client, {
      task_id: ctx.taskId,
      user_id: userId,
      subtask_id: ctx.subtaskId,
      knowledge_point_id: ctx.knowledgePointId,
      stage: ctx.stage,
      activity_log: [
        {
          kind: ctx.kind,
          knowledge_point_id: ctx.knowledgePointId,
          started_at: now,
        },
      ],
      started_at: now,
      queue_level: 0,
      status: "in_progress",
    });
    return this.normalize(newExecution);
  }

  /**
   * 在既有会话内追加一个新活动片段（收尾当前片段）。用于会话内切换知识点/学习↔做题。
   */
  async appendSlice(
    client: SupabaseClient,
    userId: string,
    executionId: string,
    ctx: SessionActivityContext,
  ): Promise<TaskExecution> {
    const exec = await this.getRaw(client, userId, executionId);
    const normalized = this.normalize(exec);
    const now = new Date().toISOString();
    const closedLog = this.finalizeCurrentSlice(normalized.activity_log, now);
    const activityLog: ActivitySlice[] = [
      ...closedLog,
      {
        kind: ctx.kind,
        knowledge_point_id: ctx.knowledgePointId,
        started_at: now,
      },
    ];
    const updates: Partial<Omit<TaskExecution, "id" | "task_id" | "user_id">> =
      {
        activity_log: activityLog,
        stage: ctx.stage ?? normalized.stage,
        knowledge_point_id: ctx.knowledgePointId ?? normalized.knowledge_point_id,
        subtask_id: ctx.subtaskId ?? normalized.subtask_id,
      };
    return this.updateExecution(client, executionId, updates);
  }

  /**
   * 结束会话：收尾当前片段，置 ended_at/duration，状态 completed。
   */
  async endSession(
    client: SupabaseClient,
    userId: string,
    executionId: string,
  ): Promise<TaskExecution> {
    const exec = await this.getRaw(client, userId, executionId);
    const normalized = this.normalize(exec);
    const now = new Date().toISOString();
    const activityLog = this.finalizeCurrentSlice(normalized.activity_log, now);
    const duration = this.slicesToDuration(activityLog, normalized.started_at, now);
    return this.updateExecution(client, executionId, {
      activity_log: activityLog,
      ended_at: now,
      duration,
      status: "completed",
    });
  }

  /**
   * 阶段推进回写：向开会话追加一个待计时(pending)片段；无开会话则新建 pending 执行行。
   * started_at 保持 null → 时长贡献 0，体现「阶段开始不计时」。
   */
  async createPendingForStage(
    client: SupabaseClient,
    userId: string,
    ctx: { taskId?: string; subtaskId?: string; knowledgePointId?: string; stage: LearningState },
  ): Promise<TaskExecution | null> {
    const open = await this.findOpen(client, userId);

    if (open) {
      const openNorm = this.normalize(open);
      const activityLog: ActivitySlice[] = [
        ...(openNorm.activity_log ?? []),
        {
          kind: ctx.stage,
          knowledge_point_id: ctx.knowledgePointId ?? openNorm.knowledge_point_id,
          started_at: null,
        },
      ];
      const updates: Partial<Omit<TaskExecution, "id" | "task_id" | "user_id">> =
        {
          activity_log: activityLog,
          stage: ctx.stage,
          knowledge_point_id: ctx.knowledgePointId ?? openNorm.knowledge_point_id,
          subtask_id: ctx.subtaskId ?? openNorm.subtask_id,
        };
      return this.updateExecution(client, openNorm.id, updates);
    }

    if (!ctx.taskId) return null;
    return this.createExecution(client, {
      task_id: ctx.taskId,
      user_id: userId,
      subtask_id: ctx.subtaskId,
      knowledge_point_id: ctx.knowledgePointId,
      stage: ctx.stage,
      activity_log: [
        {
          kind: ctx.stage,
          knowledge_point_id: ctx.knowledgePointId,
          started_at: null,
        },
      ],
      started_at: null,
      queue_level: 0,
      status: "pending",
    });
  }

  private async getRaw(
    client: SupabaseClient,
    userId: string,
    executionId: string,
  ): Promise<TaskExecution> {
    const { data, error } = await client
      .from("task_executions")
      .select("*")
      .eq("id", executionId)
      .eq("user_id", userId)
      .single();

    if (error) throw new AppError(ErrorCodes.SCHEDULER_TASK_EXECUTION_FAILED, { details: { originalError: error.message } });
    if (!data) throw new AppError(ErrorCodes.RESOURCE_NOT_FOUND);
    return data as TaskExecution;
  }

  /** 归一化 activity_log（数据库返回可能是 null/非数组） */
  private normalize(exec: TaskExecution): TaskExecution {
    const log = exec.activity_log ?? [];
    return { ...exec, activity_log: Array.isArray(log) ? log : [] };
  }

  private currentSlice(log: ActivitySlice[] | undefined): ActivitySlice | undefined {
    const array = Array.isArray(log) ? log : [];
    return array[array.length - 1];
  }

  /** 收尾未结束的最后一个片段（写 ended_at + duration_seconds），返回新的日志数组 */
  private finalizeCurrentSlice(
    log: ActivitySlice[] | undefined,
    now: string,
  ): ActivitySlice[] {
    const array = Array.isArray(log) ? log : [];
    if (array.length === 0) return array;
    const last = array[array.length - 1];
    if (last.started_at && !last.ended_at) {
      const started = new Date(last.started_at).getTime();
      const ended = new Date(now).getTime();
      const duration = Math.max(0, Math.round((ended - started) / 1000));
      const closed: ActivitySlice = {
        ...last,
        ended_at: now,
        duration_seconds: last.duration_seconds ?? duration,
      };
      return [...array.slice(0, -1), closed];
    }
    return array;
  }

  private slicesToDuration(
    log: ActivitySlice[],
    fallbackStartedAt: string | null,
    now: string,
  ): number {
    const array = Array.isArray(log) ? log : [];
    const fromSlices = array.reduce((sum, s) => sum + (s.duration_seconds ?? 0), 0);
    if (fromSlices > 0) return fromSlices;
    if (fallbackStartedAt) {
      return Math.max(
        0,
        Math.round((new Date(now).getTime() - new Date(fallbackStartedAt).getTime()) / 1000),
      );
    }
    return 0;
  }

  async getExecutions(
    client: SupabaseClient,
    userId: string,
    filters?: ExecutionFilters,
    options?: PaginationOptions,
  ): Promise<{ executions: TaskExecution[]; total: number }> {
    const { offset, end } = getPaginationParams(options);
    let query = client
      .from("task_executions")
      .select("*", { count: "exact" })
      .eq("user_id", userId)
      .order("started_at", { ascending: false })
      .range(offset, end);

    if (filters?.task_id) {
      query = query.eq("task_id", filters.task_id);
    }
    if (filters?.status) {
      query = query.eq("status", filters.status);
    }
    if (filters?.from_date) {
      query = query.gte("started_at", filters.from_date);
    }
    if (filters?.to_date) {
      query = query.lte("started_at", filters.to_date);
    }

    const { data, error, count } = await query;
    if (error) throw new AppError(ErrorCodes.SCHEDULER_TASK_EXECUTION_FAILED, { details: { originalError: error.message } });
    return { executions: data as TaskExecution[], total: count || 0 };
  }
}

export const executionService = new ExecutionService();

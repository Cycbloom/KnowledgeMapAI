/**
 * @schedule decision - 跨图路径 stage 周窗口排课（P2 两级排课）。
 *
 * 大路径（cross_graph）粒度 = 自然周：把 stage（图级节点）按顺序装箱到周窗口；
 * 小路径（单图）仍按日排入 learning_path_schedule（pathSchedulerService）。
 * 周窗口驱动大循环挑图：schedulerDecisionService 优先选中「本周窗口」对应的图，
 * 无窗口数据时回退到路径顺序/评分挑图（向后兼容）。
 *
 * 状态说明：窗口 status 由本服务在创建/重排时置 planned；滞后（isLagging）为派生值
 * （week_end 已过且 status 仍为 planned），由 Dashboard 消费并提示手动顺延。
 */
import { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "../../../utils/logger";
import { AppError } from "../../../middleware/errorHandler";
import { ErrorCodes } from "../../../../shared/types/errorCodes";
import { learningPathService } from "../../study/learningPathService";
import { capacityService } from "./capacityService";
import type { LearningPathNode } from "../../study/learningPathTypes";

export type StageWindowStatus = "planned" | "in_progress" | "completed" | "skipped";

export interface StageWindow {
  id?: string;
  stageIndex: number;
  graphId: string | null;
  graphNodeId: string;
  title?: string;
  weekStartDate: string;
  weekEndDate: string;
  plannedMinutes: number;
  status: StageWindowStatus;
  /** 派生：窗口已结束但仍为 planned → 进度滞后 */
  isLagging?: boolean;
}

/** 统一 YYYY-MM-DD 本地日期字符串（本地时钟，避免 UTC 偏移） */
function toDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDays(d: Date, n: number): Date {
  const next = new Date(d);
  next.setDate(next.getDate() + n);
  next.setHours(0, 0, 0, 0);
  return next;
}

/** 本周周一（自然周起点） */
function startOfWeek(d: Date): Date {
  const date = new Date(d);
  date.setHours(0, 0, 0, 0);
  const offset = (date.getDay() + 6) % 7; // 周一=0
  return addDays(date, -offset);
}

class StageWindowPlannerService {
  /**
   * 为跨图路径排周窗口（创建路径后自动 / 手动重排共用）。
   * 装箱规则与日排课对齐：里程碑 stage 独占一周；普通 stage 按
   * 周容量（全局日预算 × 7）顺序装箱，单个超长 stage 跨多周。
   * 幂等：重排时删除该路径现有窗口后重建。
   */
  async planStageWindows(
    supabase: SupabaseClient,
    userId: string,
    pathId: string,
    options?: { start_date?: string },
  ): Promise<{ pathId: string; windows: StageWindow[]; startDate?: string; endDate?: string }> {
    const path = await learningPathService.getLearningPath(
      supabase,
      pathId,
      userId,
    );
    if (!path) {
      throw new AppError(
        "learningPath.api.errors.notFound",
        404,
        ErrorCodes.RESOURCE_NOT_FOUND,
      );
    }
    const stages = (path.nodes ?? [])
      .filter((n): n is LearningPathNode => !!n.graph_id)
      .sort((a, b) => a.order_index - b.order_index);
    if (stages.length === 0) {
      return { pathId, windows: [] };
    }

    const { dailyCapacityMinutes } = await capacityService.getCapacitySettings(
      supabase,
      userId,
    );
    const weeklyCapacity = Math.max(30, dailyCapacityMinutes * 7);

    const start = options?.start_date
      ? startOfWeek(new Date(`${options.start_date}T00:00:00`))
      : startOfWeek(new Date());

    const windows = this.packStagesIntoWeeks(stages, start, weeklyCapacity);

    // 重排语义：先清空该路径现有窗口再写入
    const { error: deleteError } = await supabase
      .from("learning_path_stage_windows")
      .delete()
      .eq("path_id", pathId)
      .eq("user_id", userId);
    if (deleteError) {
      logger.warn("[StageWindow] delete old windows failed", {
        pathId,
        error: deleteError.message,
      });
    }

    const rows = windows.map((w) => ({
      user_id: userId,
      path_id: pathId,
      stage_index: w.stageIndex,
      graph_id: w.graphId,
      graph_node_id: w.graphNodeId,
      week_start_date: w.weekStartDate,
      week_end_date: w.weekEndDate,
      planned_minutes: w.plannedMinutes,
      status: w.status,
    }));
    const { error: insertError } = await supabase
      .from("learning_path_stage_windows")
      .insert(rows);
    if (insertError) {
      logger.warn("[StageWindow] insert windows failed", {
        pathId,
        error: insertError.message,
      });
    }

    // 回写大路径学习窗口（与日排课回写语义一致）
    const dayStrs = windows
      .flatMap((w) => [w.weekStartDate, w.weekEndDate])
      .sort();
    const startDate = dayStrs[0];
    const endDate = dayStrs[dayStrs.length - 1];
    if (startDate && endDate) {
      const { error: windowError } = await supabase
        .from("learning_paths")
        .update({ scheduled_start_date: startDate, scheduled_end_date: endDate })
        .eq("id", pathId)
        .eq("user_id", userId);
      if (windowError) {
        logger.warn("[StageWindow] update learning window failed", {
          pathId,
          error: windowError.message,
        });
      }
    }

    return { pathId, windows, startDate, endDate };
  }

  /** 查询路径的周窗口列表（带派生滞后标记） */
  async getStageWindows(
    supabase: SupabaseClient,
    userId: string,
    pathId: string,
  ): Promise<StageWindow[]> {
    const today = toDateString(new Date());
    const { data, error } = await supabase
      .from("learning_path_stage_windows")
      .select("*")
      .eq("user_id", userId)
      .eq("path_id", pathId)
      .order("stage_index", { ascending: true });
    if (error) {
      logger.warn("[StageWindow] fetch windows failed", {
        pathId,
        error: error.message,
      });
      return [];
    }
    return (data ?? []).map((row) => this.rowToWindow(row, today));
  }

  /**
   * 当前周（含今天）的所有窗口，按路径优先级排序，供大循环挑图。
   * 仅返回 active 路径的窗口。
   */
  async getCurrentWeekWindows(
    supabase: SupabaseClient,
    userId: string,
    now: Date = new Date(),
  ): Promise<Array<StageWindow & { pathPriority: number; pathTargetDate: string | null }>> {
    const today = toDateString(now);
    const { data, error } = await supabase
      .from("learning_path_stage_windows")
      .select(
        "*, learning_paths!inner(status, priority, target_date)",
      )
      .eq("user_id", userId)
      .lte("week_start_date", today)
      .gte("week_end_date", today);
    if (error) {
      logger.warn("[StageWindow] fetch current week windows failed", {
        userId,
        error: error.message,
      });
      return [];
    }
    return (data ?? [])
      .filter(
        (row: Record<string, unknown>) =>
          ((row.learning_paths as Record<string, unknown> | null)?.status as
            | string
            | undefined) === "active",
      )
      .map((row: Record<string, unknown>) => {
        const path = row.learning_paths as Record<string, unknown>;
        return {
          ...this.rowToWindow(row, today),
          pathPriority: Number(path.priority) || 0,
          pathTargetDate: (path.target_date as string | null) ?? null,
        };
      })
      .sort((a, b) => {
        if (a.pathPriority !== b.pathPriority) {
          return b.pathPriority - a.pathPriority;
        }
        return (a.pathTargetDate ?? "9999-12-31").localeCompare(
          b.pathTargetDate ?? "9999-12-31",
        );
      });
  }

  /**
   * 一键顺延：保留已结束的窗口，把未结束（week_end ≥ 今天）的窗口对应的
   * stage 从下周一重新装箱。已完成阶段的窗口不受影响。
   */
  async postponePath(
    supabase: SupabaseClient,
    userId: string,
    pathId: string,
  ): Promise<{ pathId: string; postponedFrom: string; windows: StageWindow[] }> {
    const today = toDateString(new Date());
    const all = await this.getStageWindows(supabase, userId, pathId);
    const future = all.filter((w) => w.weekEndDate >= today);
    if (future.length === 0) {
      // 没有未结束窗口 → 等价于全量重排
      const result = await this.planStageWindows(supabase, userId, pathId);
      return { pathId, postponedFrom: today, windows: result.windows };
    }

    const fromStageIndex = Math.min(...future.map((w) => w.stageIndex));
    const nextMonday = toDateString(addDays(startOfWeek(new Date()), 7));

    const { error: deleteError } = await supabase
      .from("learning_path_stage_windows")
      .delete()
      .eq("path_id", pathId)
      .eq("user_id", userId)
      .gte("stage_index", fromStageIndex);
    if (deleteError) {
      logger.warn("[StageWindow] postpone delete failed", {
        pathId,
        error: deleteError.message,
      });
      throw new AppError(
        "learningPath.api.errors.updateFailed",
        500,
        ErrorCodes.SYSTEM_INTERNAL_ERROR,
      );
    }

    const path = await learningPathService.getLearningPath(
      supabase,
      pathId,
      userId,
    );
    const stages = (path?.nodes ?? [])
      .filter(
        (n): n is LearningPathNode =>
          !!n.graph_id && n.order_index >= fromStageIndex,
      )
      .sort((a, b) => a.order_index - b.order_index);

    let windows: StageWindow[] = [];
    if (stages.length > 0) {
      const { dailyCapacityMinutes } = await capacityService.getCapacitySettings(
        supabase,
        userId,
      );
      const weeklyCapacity = Math.max(30, dailyCapacityMinutes * 7);
      windows = this.packStagesIntoWeeks(
        stages,
        new Date(`${nextMonday}T00:00:00`),
        weeklyCapacity,
      );
      const rows = windows.map((w) => ({
        user_id: userId,
        path_id: pathId,
        stage_index: w.stageIndex,
        graph_id: w.graphId,
        graph_node_id: w.graphNodeId,
        week_start_date: w.weekStartDate,
        week_end_date: w.weekEndDate,
        planned_minutes: w.plannedMinutes,
        status: w.status,
      }));
      const { error: insertError } = await supabase
        .from("learning_path_stage_windows")
        .insert(rows);
      if (insertError) {
        logger.warn("[StageWindow] postpone insert failed", {
          pathId,
          error: insertError.message,
        });
      }
    }

    // 窗口端点只扩不缩（与日排课 extendWindow 语义一致）
    const keptEnds = all
      .filter((w) => w.weekEndDate < today)
      .map((w) => w.weekEndDate)
      .sort();
    const newEnds = windows.map((w) => w.weekEndDate).sort();
    const endDate =
      newEnds[newEnds.length - 1] ?? keptEnds[keptEnds.length - 1];
    if (endDate) {
      await supabase
        .from("learning_paths")
        .update({ scheduled_end_date: endDate })
        .eq("id", pathId)
        .eq("user_id", userId);
    }

    return { pathId, postponedFrom: nextMonday, windows };
  }

  /**
   * 用户级滞后窗口查询（Dashboard「进度滞后」提示）：
   * 窗口已结束（week_end < 今天）但状态仍为 planned 的周窗口。
   */
  async getLaggingWindows(
    supabase: SupabaseClient,
    userId: string,
  ): Promise<Array<StageWindow & { pathTitle?: string }>> {
    const today = toDateString(new Date());
    const { data, error } = await supabase
      .from("learning_path_stage_windows")
      .select("*, learning_paths(title)")
      .eq("user_id", userId)
      .eq("status", "planned")
      .lt("week_end_date", today)
      .order("week_end_date", { ascending: true });
    if (error) {
      logger.warn("[StageWindow] fetch lagging windows failed", {
        userId,
        error: error.message,
      });
      return [];
    }
    return (data ?? []).map((row: Record<string, unknown>) => ({
      ...this.rowToWindow(row, today),
      pathTitle: (row.learning_paths as { title?: string } | null)?.title,
    }));
  }

  /** 周装箱：里程碑独占一周；超长 stage 跨多周；返回窗口列表 */
  private packStagesIntoWeeks(
    stages: LearningPathNode[],
    start: Date,
    weeklyCapacity: number,
  ): StageWindow[] {
    const windows: StageWindow[] = [];
    let cursor = start;
    let weekUsed = 0;

    for (const stage of stages) {
      const time = stage.estimated_time || 30;
      const spanWeeks = Math.max(1, Math.ceil(time / weeklyCapacity));
      if (stage.is_milestone) {
        // 里程碑独占一周：若本周已有普通 stage 则顺延到下周
        if (weekUsed > 0) {
          cursor = addDays(cursor, 7);
          weekUsed = 0;
        }
        windows.push(this.buildWindow(stage, cursor, spanWeeks, time));
        cursor = addDays(cursor, spanWeeks * 7);
        weekUsed = 0;
        continue;
      }
      if (weekUsed > 0 && weekUsed + time > weeklyCapacity) {
        cursor = addDays(cursor, 7);
        weekUsed = 0;
      }
      windows.push(this.buildWindow(stage, cursor, spanWeeks, time));
      weekUsed += time;
      // 超长 stage 跨多周：游标推进到覆盖后的下一周
      if (spanWeeks > 1) {
        cursor = addDays(cursor, (spanWeeks - 1) * 7);
        weekUsed = time;
      }
    }
    return windows;
  }

  private buildWindow(
    stage: LearningPathNode,
    weekStart: Date,
    spanWeeks: number,
    time: number,
  ): StageWindow {
    return {
      stageIndex: stage.order_index,
      graphId: stage.graph_id ?? null,
      graphNodeId: stage.id,
      title: stage.title,
      weekStartDate: toDateString(weekStart),
      weekEndDate: toDateString(addDays(weekStart, spanWeeks * 7 - 1)),
      plannedMinutes: time,
      status: "planned",
    };
  }

  private rowToWindow(
    row: Record<string, unknown>,
    today: string,
  ): StageWindow {
    const status = (row.status as StageWindowStatus) ?? "planned";
    const weekEndDate = row.week_end_date as string;
    return {
      id: row.id as string,
      stageIndex: Number(row.stage_index),
      graphId: (row.graph_id as string | null) ?? null,
      graphNodeId: row.graph_node_id as string,
      title: undefined,
      weekStartDate: row.week_start_date as string,
      weekEndDate,
      plannedMinutes: Number(row.planned_minutes) || 0,
      status,
      isLagging: status === "planned" && !!weekEndDate && weekEndDate < today,
    };
  }
}

export const stageWindowPlannerService = new StageWindowPlannerService();
export { StageWindowPlannerService };

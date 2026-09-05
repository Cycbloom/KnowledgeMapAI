/**
 * @schedule decision - 学习路径排课（Phase A 日历自动排课 + P1 统一计划体系）。
 *
 * 职责：以「知识点」为排期主体，把某条学习路径的待学节点按
 *   依赖(拓扑) + 预估时长 + 每日配额 + 全局日容量 → 摊排到连续日期，
 *   写入 learning_path_schedule（全局唯一键：user_id+knowledge_point_id+scheduled_date）。
 *
 * 设计要点（见 spec）：
 * - 知识点全局唯一排期：同一知识点（跨路径、跨日期）只保留一行 scheduled，
 *   后排的路径直接复用先占位的日期并把自身并入 source_path_ids。
 * - 容量感知装箱：路径节奏 = min(daily_minutes_target, 全局预算) × (1 - 复习缓冲)；
 *   硬约束 = 当日全局已排负载 + 新增 ≤ task_settings.daily_capacity_minutes，
 *   超出顺延到下一天（节点不拆分；空日上超长节点允许溢出，否则无法安置）。
 * - 里程碑(is_milestone)节点独立占一天，便于高亮。
 * - 只排日期，不排时钟。
 * - learning_paths 作为「学习窗口」记录 scheduled_start_date / scheduled_end_date。
 * - P5：小路径与大路径周窗口强联动（起始日对齐窗口周、节奏按窗口预算限速）；
 *   replanFromToday 支持滞后手动重排；backfillGraphPathSchedule 在图谱知识点
 *   变化（拓展/手动加节点）后自动补节点并补排。
 */
import { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "../../../utils/logger";
import { AppError } from "../../../middleware/errorHandler";
import { ErrorCodes } from "../../../../shared/types/errorCodes";
import {
  resolveLocalizedText,
  type LocalizedText,
} from "../../../../shared/utils/localization";
import { learningPathService } from "../../study/learningPathService";
import { topologicalSortNodes } from "../../study/learningPathAlgorithms";
import { capacityService } from "./capacityService";
import type { LearningPathNode } from "../../study/learningPathTypes";

/** 单个节点排期结果 */
export interface ScheduledNode {
  nodeId: string;
  knowledgePointId: string;
  scheduledDate: string;
  estimatedTime: number;
  isMilestone: boolean;
  /** 是否复用/合并已有排期（同知识点已被任何路径排期，或同知识点同日冲突） */
  merged: boolean;
}

export interface PathScheduleResult {
  pathId: string;
  scheduled: ScheduledNode[];
  startDate?: string;
  endDate?: string;
}

/** 统一 YYYY-MM-DD 本地日期字符串，避免 UTC 偏移导致次日错位 */
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

class PathSchedulerService {
  /**
   * 为指定学习路径排课（全自动）。结果写入 learning_path_schedule 并回写学习窗口起止日。
   * 幂等：重复调用时，知识点已有排期（含本路径此前排的）直接复用原日期，不重复排。
   */
  async planPath(
    supabase: SupabaseClient,
    userId: string,
    pathId: string,
    options?: { start_date?: string },
  ): Promise<PathScheduleResult> {
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
    if (path.path_type === "cross_graph") {
      throw new AppError(
        "learningPath.api.errors.crossGraphUseStageWindows",
        400,
        ErrorCodes.VALIDATION_ERROR,
      );
    }

    const nodes = (path.nodes ?? []).filter(
      (n): n is LearningPathNode => !!n.knowledge_point_id,
    );
    const pendingNodes = nodes.filter(
      (n) => n.status === "pending" || n.status === "in_progress",
    );
    if (pendingNodes.length === 0) {
      return { pathId, scheduled: [] };
    }

    // 拓扑排序：前置依赖 + order_index
    const ordered = topologicalSortNodes(pendingNodes);

    // P1 全局容量：预算 + 复习缓冲 + 路径配额（节奏）
    const { dailyCapacityMinutes, reviewBufferRatio } =
      await capacityService.getCapacitySettings(supabase, userId);
    const dailyTarget = path.daily_minutes_target || 180;
    const pathQuota = Math.min(dailyTarget, dailyCapacityMinutes);
    let paceCap = Math.max(
      1,
      Math.round(pathQuota * (1 - reviewBufferRatio)),
    );
    let startDate = options?.start_date
      ? new Date(`${options.start_date}T00:00:00`)
      : new Date();
    startDate.setHours(0, 0, 0, 0);

    // P5 周窗口强联动：小路径排课对齐所属图谱在大路径中的活跃周窗口——
    // 起始日落到窗口周内，节奏按窗口预算摊到每天限速；超出窗口周末自然溢出（不硬截断）
    const window = await this.resolveWindowConstraint(
      supabase,
      userId,
      path.source_graph_id,
    );
    if (window) {
      const windowStart = new Date(`${window.weekStartDate}T00:00:00`);
      if (!Number.isNaN(windowStart.getTime()) && windowStart > startDate) {
        startDate = windowStart;
      }
      const windowDayCap = Math.max(
        1,
        Math.ceil(window.plannedMinutes / window.windowDays),
      );
      paceCap = Math.min(paceCap, windowDayCap);
    }

    // 全局日负载（startDate 起，含其它路径与本路径此前排期），装箱过程中同步累计
    const dayLoad = await capacityService.getDayLoad(
      supabase,
      userId,
      toDateString(startDate),
    );

    // 知识点全局唯一排期预取：这些知识点已被任何路径排期的行（任意日期）
    const kpIds = Array.from(
      new Set(ordered.map((n) => n.knowledge_point_id as string)),
    );
    const existingByKp = await this.fetchExistingByKp(supabase, userId, kpIds);

    // 1) 生成每日分配
    const assigned: Array<{
      node: LearningPathNode;
      dateStr: string;
      existingId?: string;
      existingSources?: string[];
    }> = [];
    let cursor = startDate;
    let dayUsed = 0;

    for (const node of ordered) {
      const kpId = node.knowledge_point_id as string;
      const existing = existingByKp.get(kpId);
      if (existing) {
        // 全局唯一排期：该知识点已有排期 → 复用其日期（不新增占用），
        // 游标推进到该日之后，保证后续节点不早于它（拓扑序）
        assigned.push({
          node,
          dateStr: existing.date,
          existingId: existing.id,
          existingSources: existing.sources,
        });
        const d = new Date(`${existing.date}T00:00:00`);
        if (!Number.isNaN(d.getTime()) && d > cursor) {
          cursor = d;
          dayUsed = 0;
        }
        continue;
      }

      const time = node.estimated_time || 30;
      if (node.is_milestone) {
        // 里程碑独占一天：若当天已有普通节点则顺延到次日
        if (dayUsed > 0) {
          cursor = addDays(cursor, 1);
          dayUsed = 0;
        }
        const dateStr = toDateString(cursor);
        assigned.push({ node, dateStr });
        dayLoad.set(dateStr, (dayLoad.get(dateStr) ?? 0) + time);
        cursor = addDays(cursor, 1);
        dayUsed = 0;
        continue;
      }
      // 普通节点：路径节奏 + 全局日预算双重检查，超出则顺延；
      // 空日（本路径未排）上节点不拆分——全局放不下且节点本身≥全局预算时允许溢出
      for (;;) {
        const dateStr = toDateString(cursor);
        const load = dayLoad.get(dateStr) ?? 0;
        if (dayUsed === 0) {
          if (
            load + time <= dailyCapacityMinutes ||
            time >= dailyCapacityMinutes
          ) {
            break;
          }
        } else if (
          dayUsed + time <= paceCap &&
          load + time <= dailyCapacityMinutes
        ) {
          break;
        }
        cursor = addDays(cursor, 1);
        dayUsed = 0;
      }
      const dateStr = toDateString(cursor);
      assigned.push({ node, dateStr });
      dayUsed += time;
      dayLoad.set(dateStr, (dayLoad.get(dateStr) ?? 0) + time);
    }

    if (assigned.length === 0) {
      return { pathId, scheduled: [] };
    }

    // 2) 落库：知识点已排期的行归并来源；其余逐条 upsert（并发下由唯一键兜底）
    const scheduled: ScheduledNode[] = [];
    const toInsert: Array<{
      user_id: string;
      knowledge_point_id: string;
      scheduled_date: string;
      path_id: string;
      source_path_ids: string[];
      estimated_time: number;
      status: string;
    }> = [];
    const toMergeSource: Array<{ id: string; source_path_ids: string[] }> = [];
    const mergedRowIds = new Set<string>();

    for (const a of assigned) {
      const kpId = a.node.knowledge_point_id as string;
      const estimatedTime = a.node.estimated_time || 30;
      if (a.existingId) {
        const sources = a.existingSources ?? [];
        if (!mergedRowIds.has(a.existingId) && !sources.includes(pathId)) {
          mergedRowIds.add(a.existingId);
          toMergeSource.push({
            id: a.existingId,
            source_path_ids: [...sources, pathId],
          });
        }
        scheduled.push({
          nodeId: a.node.id,
          knowledgePointId: kpId,
          scheduledDate: a.dateStr,
          estimatedTime,
          isMilestone: a.node.is_milestone,
          merged: true,
        });
        continue;
      }
      toInsert.push({
        user_id: userId,
        knowledge_point_id: kpId,
        scheduled_date: a.dateStr,
        path_id: pathId,
        source_path_ids: [pathId],
        estimated_time: estimatedTime,
        status: "scheduled",
      });
      scheduled.push({
        nodeId: a.node.id,
        knowledgePointId: kpId,
        scheduledDate: a.dateStr,
        estimatedTime,
        isMilestone: a.node.is_milestone,
        merged: false,
      });
    }

    if (toInsert.length > 0) {
      // 同一天并发多条相同 (kp, date) 可能触发唯一键冲突，逐条 upsert 更稳妥
      for (const row of toInsert) {
        const { error } = await supabase
          .from("learning_path_schedule")
          .upsert(row, {
            onConflict: "user_id,knowledge_point_id,scheduled_date",
          });
        if (error) {
          logger.warn("[PathScheduler] upsert schedule failed", {
            userId,
            knowledgePointId: row.knowledge_point_id,
            scheduledDate: row.scheduled_date,
            error: error.message,
          });
        }
      }
    }
    if (toMergeSource.length > 0) {
      for (const m of toMergeSource) {
        const { error } = await supabase
          .from("learning_path_schedule")
          .update({ source_path_ids: m.source_path_ids })
          .eq("id", m.id);
        if (error) {
          logger.warn("[PathScheduler] merge source paths failed", {
            id: m.id,
            error: error.message,
          });
        }
      }
    }

    // 3) 回写学习窗口起止日（learning_paths 即窗口）
    const dayStrs = assigned.map((a) => a.dateStr).sort();
    const start = dayStrs[0];
    const end = dayStrs[dayStrs.length - 1];
    if (start && end) {
      const { error: windowError } = await supabase
        .from("learning_paths")
        .update({
          scheduled_start_date: start,
          scheduled_end_date: end,
        })
        .eq("id", pathId)
        .eq("user_id", userId);
      if (windowError) {
        logger.warn("[PathScheduler] update learning window failed", {
          pathId,
          error: windowError.message,
        });
      }
    }

    return { pathId, scheduled, startDate: start, endDate: end };
  }

  /**
   * 从今天重排（P5 滞后恢复，手动"从今天重排"按钮）：计划滞后时把未完成节点重新装箱。
   *
   * - 清除本路径参与的全部 scheduled 排期行的本路径归属：独占行删除、共享行仅把本路径
   *   从 source_path_ids 移除（保留行，归属先占位路径）。含逾期行——逾期 scheduled 行
   *   会把知识点锚在过去，一并清除后才能从今天起排。
   * - completed/skipped 行不动（历史事实）。
   * - 共享行保留原日期：知识点全局唯一排期归"最早占位方"所有，本路径复用其日期；
   *   需要移动共享知识点时用日历拖拽（reschedule 会联动所有来源路径）。
   * - 重新装箱走 planPath（含周窗口联动），start_date 默认今天。
   */
  async replanFromToday(
    supabase: SupabaseClient,
    userId: string,
    pathId: string,
    options?: { start_date?: string },
  ): Promise<PathScheduleResult & { clearedRows: number }> {
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
    if (path.path_type === "cross_graph") {
      throw new AppError(
        "learningPath.api.errors.crossGraphUseStageWindows",
        400,
        ErrorCodes.VALIDATION_ERROR,
      );
    }

    const today = toDateString(new Date());
    const startDate =
      options?.start_date && options.start_date > today
        ? options.start_date
        : today;

    // source_path_ids 始终包含归属路径（planPath 写入 [pathId]），contains 即可覆盖独占+共享
    const { data: rows, error } = await supabase
      .from("learning_path_schedule")
      .select("id, source_path_ids")
      .eq("user_id", userId)
      .eq("status", "scheduled")
      .contains("source_path_ids", [pathId]);
    if (error) {
      logger.warn("[PathScheduler] replan fetch schedule failed", {
        pathId,
        error: error.message,
      });
      throw new AppError(
        "learningPath.api.errors.updateFailed",
        500,
        ErrorCodes.SYSTEM_INTERNAL_ERROR,
      );
    }

    let clearedRows = 0;
    for (const row of rows ?? []) {
      const sources = ((row.source_path_ids as string[] | null) ?? []).filter(
        (id) => id !== pathId,
      );
      if (sources.length === 0) {
        const { error: deleteError } = await supabase
          .from("learning_path_schedule")
          .delete()
          .eq("id", row.id)
          .eq("user_id", userId);
        if (deleteError) {
          logger.warn("[PathScheduler] replan delete row failed", {
            id: row.id,
            error: deleteError.message,
          });
          continue;
        }
        clearedRows++;
      } else {
        const { error: updateError } = await supabase
          .from("learning_path_schedule")
          .update({ source_path_ids: sources })
          .eq("id", row.id);
        if (updateError) {
          logger.warn("[PathScheduler] replan detach row failed", {
            id: row.id,
            error: updateError.message,
          });
          continue;
        }
        clearedRows++;
      }
    }

    const result = await this.planPath(supabase, userId, pathId, {
      start_date: startDate,
    });
    return { ...result, clearedRows };
  }

  /**
   * 图谱知识点变化后的排期补齐（P5）：深度/宽度拓展或手动加节点后自动补排。
   *
   * 1) 找该图谱 active 的 single_graph 路径（无则 no-op——路径尚未诞生，
   *    由"保存即排"钩子负责首排）；
   * 2) 把图谱中尚未入路径的知识点追加为路径节点（order 接末尾，时长默认 30）；
   * 3) planPath 补排：已有排期的知识点复用原日期，新知识点按拓扑序装箱进剩余容量。
   */
  async backfillGraphPathSchedule(
    supabase: SupabaseClient,
    userId: string,
    graphId: string,
  ): Promise<{ pathId: string | null; addedNodes: number; scheduled: number }> {
    const { data: path, error: pathError } = await supabase
      .from("learning_paths")
      .select("id")
      .eq("user_id", userId)
      .eq("source_graph_id", graphId)
      .eq("path_type", "single_graph")
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (pathError) {
      logger.warn("[PathScheduler] backfill find path failed", {
        graphId,
        error: pathError.message,
      });
      return { pathId: null, addedNodes: 0, scheduled: 0 };
    }
    if (!path) {
      return { pathId: null, addedNodes: 0, scheduled: 0 };
    }
    const pathId = path.id as string;

    const { data: graphNodes, error: graphNodesError } = await supabase
      .from("graph_nodes")
      .select("knowledge_point_id, knowledge_points(title)")
      .eq("graph_id", graphId)
      .is("deleted_at", null)
      .eq("is_accepted", true)
      .order("created_at", { ascending: true });
    if (graphNodesError) {
      logger.warn("[PathScheduler] backfill fetch graph nodes failed", {
        graphId,
        error: graphNodesError.message,
      });
      return { pathId, addedNodes: 0, scheduled: 0 };
    }

    const kpTitleById = new Map<string, string>();
    const graphKpIds: string[] = [];
    for (const gn of graphNodes ?? []) {
      const kpId = gn.knowledge_point_id as string | null;
      if (!kpId) continue;
      graphKpIds.push(kpId);
      const kpTitle = (
        gn.knowledge_points as { title?: unknown } | null
      )?.title;
      kpTitleById.set(
        kpId,
        kpTitle ? resolveLocalizedText(kpTitle as LocalizedText) : "",
      );
    }
    if (graphKpIds.length === 0) {
      return { pathId, addedNodes: 0, scheduled: 0 };
    }

    const { data: existingNodes, error: nodesError } = await supabase
      .from("learning_path_nodes")
      .select("id, knowledge_point_id, order_index")
      .eq("path_id", pathId);
    if (nodesError) {
      logger.warn("[PathScheduler] backfill fetch path nodes failed", {
        pathId,
        error: nodesError.message,
      });
      return { pathId, addedNodes: 0, scheduled: 0 };
    }

    const existingKpIds = new Set<string>();
    let maxOrder = -1;
    for (const node of existingNodes ?? []) {
      if (node.knowledge_point_id) {
        existingKpIds.add(node.knowledge_point_id as string);
      }
      maxOrder = Math.max(maxOrder, Number(node.order_index) || 0);
    }

    const missingKpIds = graphKpIds.filter((kpId) => !existingKpIds.has(kpId));
    if (missingKpIds.length > 0) {
      const rows = missingKpIds.map((kpId, index) => ({
        path_id: pathId,
        knowledge_point_id: kpId,
        order_index: maxOrder + 1 + index,
        title: kpTitleById.get(kpId) || kpId,
        estimated_time: 30,
        is_milestone: false,
        prerequisites: [],
        status: "pending",
      }));
      const { error: insertError } = await supabase
        .from("learning_path_nodes")
        .insert(rows);
      if (insertError) {
        logger.warn("[PathScheduler] backfill insert nodes failed", {
          pathId,
          error: insertError.message,
        });
        return { pathId, addedNodes: 0, scheduled: 0 };
      }
    }

    const result = await this.planPath(supabase, userId, pathId);
    logger.info("[PathScheduler] backfill path schedule done", {
      graphId,
      pathId,
      addedNodes: missingKpIds.length,
      scheduled: result.scheduled.length,
    });
    return {
      pathId,
      addedNodes: missingKpIds.length,
      scheduled: result.scheduled.length,
    };
  }

  /**
   * 手动改期：把某条排期（知识点+日期）整体移动到 newDate。
   *
   * - 目标日期空闲：直接更新当前行 scheduled_date（先做全局日容量检查，超预算 409）。
   * - 目标日期已被同知识点占用（唯一键冲突）：合并 — 目标行 source_path_ids
   *   取并集，删除当前行（合并不新增占用，无需容量检查）。
   * - 学习窗口：对来源路径只扩不缩（newDate 超出窗口则向外扩展）。
   */
  async reschedule(
    supabase: SupabaseClient,
    userId: string,
    scheduleId: string,
    newDate: string,
  ): Promise<{ id: string; knowledgePointId: string; scheduledDate: string; merged: boolean }> {
    const { data: row, error: rowError } = await supabase
      .from("learning_path_schedule")
      .select(
        "id, knowledge_point_id, scheduled_date, estimated_time, path_id, source_path_ids",
      )
      .eq("id", scheduleId)
      .eq("user_id", userId)
      .maybeSingle();
    if (rowError || !row || !row.knowledge_point_id) {
      throw new AppError(
        "learningPath.api.errors.notFound",
        404,
        ErrorCodes.RESOURCE_NOT_FOUND,
      );
    }

    const kpId = row.knowledge_point_id as string;
    // 归并来源路径：path_id（当前路径）+ source_path_ids（多路径复用）
    const sources = Array.from(
      new Set<string>([
        ...((row.source_path_ids as string[] | null) ?? []),
        ...(typeof row.path_id === "string" ? [row.path_id] : []),
      ]),
    );

    const existing = (
      await this.fetchExisting(supabase, userId, [kpId], [newDate])
    ).get(`${kpId}|${newDate}`);

    let id = row.id;
    let merged = false;

    if (existing && existing.id !== row.id) {
      // 目标日期已被同知识点占用 → 合并来源并删除当前行
      const mergedSources = Array.from(
        new Set<string>([
          ...((existing.source_path_ids as string[] | null) ?? []),
          ...sources,
        ]),
      );
      const { error: mergeError } = await supabase
        .from("learning_path_schedule")
        .update({ source_path_ids: mergedSources })
        .eq("id", existing.id);
      if (mergeError) {
        throw new AppError(
          "learningPath.api.errors.updateFailed",
          500,
          ErrorCodes.SYSTEM_INTERNAL_ERROR,
        );
      }
      const { error: deleteError } = await supabase
        .from("learning_path_schedule")
        .delete()
        .eq("id", row.id)
        .eq("user_id", userId);
      if (deleteError) {
        throw new AppError(
          "learningPath.api.errors.updateFailed",
          500,
          ErrorCodes.SYSTEM_INTERNAL_ERROR,
        );
      }
      id = existing.id;
      merged = true;
    } else {
      // P1 全局容量检查：目标日已排负载（扣除自身旧占位）+ 本行时长 ≤ 全局预算
      const estimatedTime = Number(row.estimated_time) || 30;
      const { dailyCapacityMinutes } = await capacityService.getCapacitySettings(
        supabase,
        userId,
      );
      const load = await capacityService.getDayLoad(supabase, userId, newDate);
      const current = load.get(newDate) ?? 0;
      // 取数范围是 newDate（含）之后：被移动行落在范围内时需扣除自身旧占位
      const selfOnDate =
        (row.scheduled_date as string) >= newDate ? estimatedTime : 0;
      if (current - selfOnDate + estimatedTime > dailyCapacityMinutes) {
        throw new AppError(
          "errors.errorCodes.schedulerCapacityExceeded",
          409,
          ErrorCodes.SCHEDULER_CAPACITY_EXCEEDED,
        );
      }
      const { error: updateError } = await supabase
        .from("learning_path_schedule")
        .update({ scheduled_date: newDate })
        .eq("id", row.id)
        .eq("user_id", userId);
      if (updateError) {
        throw new AppError(
          "learningPath.api.errors.updateFailed",
          500,
          ErrorCodes.SYSTEM_INTERNAL_ERROR,
        );
      }
    }

    await this.extendWindow(supabase, userId, sources, newDate);

    return { id, knowledgePointId: kpId, scheduledDate: newDate, merged };
  }

  /**
   * P5 周窗口强联动：查该图谱在跨图大路径中的活跃周窗口。
   * 取 status 为 planned/in_progress、未结束（week_end ≥ 今天）的最早窗口，
   * 且窗口所属大路径仍为 active；无命中返回 null（按今天起排、节奏不限）。
   * planned_minutes 是该 stage 的总预估分钟数（窗口可跨多周），
   * 调用方按 planned_minutes / 窗口天数 摊到每天限速。
   */
  private async resolveWindowConstraint(
    supabase: SupabaseClient,
    userId: string,
    graphId: string | null | undefined,
  ): Promise<{
    weekStartDate: string;
    weekEndDate: string;
    plannedMinutes: number;
    windowDays: number;
  } | null> {
    if (!graphId) return null;
    const today = toDateString(new Date());
    const { data, error } = await supabase
      .from("learning_path_stage_windows")
      .select(
        "week_start_date, week_end_date, planned_minutes, learning_paths!inner(status)",
      )
      .eq("user_id", userId)
      .eq("graph_id", graphId)
      .in("status", ["planned", "in_progress"])
      .gte("week_end_date", today)
      .order("week_start_date", { ascending: true });
    if (error) {
      logger.warn("[PathScheduler] resolve window constraint failed", {
        graphId,
        error: error.message,
      });
      return null;
    }
    for (const row of data ?? []) {
      const pathStatus = (
        row.learning_paths as { status?: string } | null
      )?.status;
      if (pathStatus !== "active") continue;
      const weekStartDate = row.week_start_date as string;
      const weekEndDate = row.week_end_date as string;
      if (!weekStartDate || !weekEndDate) continue;
      const windowDays = Math.max(
        1,
        Math.round(
          (new Date(`${weekEndDate}T00:00:00`).getTime() -
            new Date(`${weekStartDate}T00:00:00`).getTime()) /
            86400000,
        ) + 1,
      );
      return {
        weekStartDate,
        weekEndDate,
        plannedMinutes: Number(row.planned_minutes) || 0,
        windowDays,
      };
    }
    return null;
  }

  /** 按来源路径查询学习窗口（learning_paths 即窗口） */
  private async fetchWindow(
    supabase: SupabaseClient,
    userId: string,
    pathIds: string[],
  ): Promise<
    Map<string, { scheduled_start_date: string | null; scheduled_end_date: string | null }>
  > {
    const map = new Map<
      string,
      { scheduled_start_date: string | null; scheduled_end_date: string | null }
    >();
    if (pathIds.length === 0) return map;
    const { data, error } = await supabase
      .from("learning_paths")
      .select("id, scheduled_start_date, scheduled_end_date")
      .eq("user_id", userId)
      .in("id", pathIds);
    if (error) {
      logger.warn("[PathScheduler] fetch learning window failed", {
        userId,
        error: error.message,
      });
      return map;
    }
    for (const r of data ?? []) {
      if (!r.id) continue;
      map.set(r.id, {
        scheduled_start_date: r.scheduled_start_date as string | null,
        scheduled_end_date: r.scheduled_end_date as string | null,
      });
    }
    return map;
  }

  /** 学习窗口只扩不缩：newDate 超出某来源路径窗口时向外扩展该路径起止日 */
  private async extendWindow(
    supabase: SupabaseClient,
    userId: string,
    pathIds: string[],
    newDate: string,
  ): Promise<void> {
    if (pathIds.length === 0) return;
    const windows = await this.fetchWindow(supabase, userId, pathIds);
    for (const [pathId, w] of windows) {
      const patch: { scheduled_start_date?: string; scheduled_end_date?: string } = {};
      if (w.scheduled_start_date && newDate < w.scheduled_start_date) {
        patch.scheduled_start_date = newDate;
      }
      if (w.scheduled_end_date && newDate > w.scheduled_end_date) {
        patch.scheduled_end_date = newDate;
      }
      if (Object.keys(patch).length === 0) continue;
      const { error } = await supabase
        .from("learning_paths")
        .update(patch)
        .eq("id", pathId)
        .eq("user_id", userId);
      if (error) {
        logger.warn("[PathScheduler] extend learning window failed", {
          pathId,
          error: error.message,
        });
      }
    }
  }

  /** 预取该用户相关知识点在相关日期内的已有排期，用于同日冲突合并（reschedule 用） */
  private async fetchExisting(
    supabase: SupabaseClient,
    userId: string,
    kpIds: string[],
    dates: string[],
  ): Promise<Map<string, { id: string; source_path_ids: string[] | null }>> {
    const map = new Map<string, { id: string; source_path_ids: string[] | null }>();
    if (kpIds.length === 0 || dates.length === 0) return map;

    const { data, error } = await supabase
      .from("learning_path_schedule")
      .select("id, knowledge_point_id, scheduled_date, source_path_ids")
      .eq("user_id", userId)
      .in("knowledge_point_id", kpIds)
      .in("scheduled_date", dates);

    if (error) {
      logger.warn("[PathScheduler] fetch existing schedule failed", {
        userId,
        error: error.message,
      });
      return map;
    }
    for (const row of data ?? []) {
      if (!row.knowledge_point_id || !row.scheduled_date) continue;
      map.set(`${row.knowledge_point_id}|${row.scheduled_date}`, {
        id: row.id,
        source_path_ids: row.source_path_ids as string[] | null,
      });
    }
    return map;
  }

  /**
   * 知识点全局唯一排期预取：这些知识点当前的全部 scheduled 行（任意日期）。
   * 同一知识点存在多行时取最早日期（学得越早越贴合先占位语义）。
   */
  private async fetchExistingByKp(
    supabase: SupabaseClient,
    userId: string,
    kpIds: string[],
  ): Promise<Map<string, { id: string; date: string; sources: string[] }>> {
    const map = new Map<string, { id: string; date: string; sources: string[] }>();
    if (kpIds.length === 0) return map;

    const { data, error } = await supabase
      .from("learning_path_schedule")
      .select("id, knowledge_point_id, scheduled_date, source_path_ids")
      .eq("user_id", userId)
      .eq("status", "scheduled")
      .in("knowledge_point_id", kpIds);

    if (error) {
      logger.warn("[PathScheduler] fetch existing schedule by kp failed", {
        userId,
        error: error.message,
      });
      return map;
    }
    for (const row of data ?? []) {
      const kpId = row.knowledge_point_id as string | null;
      const date = row.scheduled_date as string | null;
      if (!kpId || !date) continue;
      const current = map.get(kpId);
      if (!current || date < current.date) {
        map.set(kpId, {
          id: row.id,
          date,
          sources: (row.source_path_ids as string[] | null) ?? [],
        });
      }
    }
    return map;
  }
}

export const pathSchedulerService = new PathSchedulerService();
export { PathSchedulerService };

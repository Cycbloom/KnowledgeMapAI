/**
 * @schedule decision - 学习路径排课（Phase A 日历自动排课）。
 *
 * 职责：以「知识点」为排期主体，把某条学习路径的待学节点按
 *   依赖(拓扑) + 预估时长 + 每日目标时长 → 摊排到连续日期，
 *   写入 learning_path_schedule（全局唯一键：user_id+knowledge_point_id+scheduled_date）。
 *
 * 设计要点（见 spec）：
 * - 多路径复用同一知识点时，同一天只落一条排期（唯一键强制），来源并入 source_path_ids。
 * - 里程碑(is_milestone)节点独立占一天，便于高亮。
 * - 只排日期，不排时钟。
 * - learning_paths 作为「学习窗口」记录 scheduled_start_date / scheduled_end_date。
 */
import { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "../../../utils/logger";
import { AppError } from "../../../middleware/errorHandler";
import { ErrorCodes } from "../../../../shared/types/errorCodes";
import { learningPathService } from "../../study/learningPathService";
import { topologicalSortNodes } from "../../study/learningPathAlgorithms";
import type { LearningPathNode } from "../../study/learningPathTypes";

/** 单个节点排期结果 */
export interface ScheduledNode {
  nodeId: string;
  knowledgePointId: string;
  scheduledDate: string;
  estimatedTime: number;
  isMilestone: boolean;
  /** 是否因「同知识点同日已被其它路径排期」而合并（复用已有排期） */
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
   * 幂等：重复调用对已排期(同知识点同日期)不新建，仅归并来源路径。
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

    const dailyTarget = path.daily_minutes_target || 30;
    const startDate = options?.start_date
      ? new Date(`${options.start_date}T00:00:00`)
      : new Date();
    startDate.setHours(0, 0, 0, 0);

    // 1) 生成每日分配
    const assigned: Array<{
      node: LearningPathNode;
      dateStr: string;
    }> = [];
    let cursor = startDate;
    let dayUsed = 0;

    for (const node of ordered) {
      const time = node.estimated_time || 30;
      if (node.is_milestone) {
        // 里程碑独占一天：若当天已有普通节点则顺延到次日
        if (dayUsed > 0) {
          cursor = addDays(cursor, 1);
          dayUsed = 0;
        }
        assigned.push({ node, dateStr: toDateString(cursor) });
        cursor = addDays(cursor, 1);
        dayUsed = 0;
        continue;
      }
      // 普通节点：填满每日目标，超出则顺延
      if (dayUsed > 0 && dayUsed + time > dailyTarget) {
        cursor = addDays(cursor, 1);
        dayUsed = 0;
      }
      assigned.push({ node, dateStr: toDateString(cursor) });
      dayUsed += time;
    }

    if (assigned.length === 0) {
      return { pathId, scheduled: [] };
    }

    // 2) 全局去重合并：预取该用户相关知识点的已有排期（跨路径）
    const kpIds = Array.from(
      new Set(assigned.map((a) => a.node.knowledge_point_id as string)),
    );
    const dates = Array.from(new Set(assigned.map((a) => a.dateStr)));
    const existByKey = await this.fetchExisting(
      supabase,
      userId,
      kpIds,
      dates,
    );

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

    for (const a of assigned) {
      const kpId = a.node.knowledge_point_id as string;
      const key = `${kpId}|${a.dateStr}`;
      const existing = existByKey.get(key);
      if (existing) {
        const sources = existing.source_path_ids ?? [];
        if (!sources.includes(pathId)) {
          toMergeSource.push({
            id: existing.id,
            source_path_ids: [...sources, pathId],
          });
        }
        scheduled.push({
          nodeId: a.node.id,
          knowledgePointId: kpId,
          scheduledDate: a.dateStr,
          estimatedTime: a.node.estimated_time || 30,
          isMilestone: a.node.is_milestone,
          merged: true,
        });
      } else {
        toInsert.push({
          user_id: userId,
          knowledge_point_id: kpId,
          scheduled_date: a.dateStr,
          path_id: pathId,
          source_path_ids: [pathId],
          estimated_time: a.node.estimated_time || 30,
          status: "scheduled",
        });
        scheduled.push({
          nodeId: a.node.id,
          knowledgePointId: kpId,
          scheduledDate: a.dateStr,
          estimatedTime: a.node.estimated_time || 30,
          isMilestone: a.node.is_milestone,
          merged: false,
        });
      }
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

  /** 预取该用户相关知识点在相关日期内的已有排期，用于跨路径去重合并 */
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
}

export const pathSchedulerService = new PathSchedulerService();
export { PathSchedulerService };
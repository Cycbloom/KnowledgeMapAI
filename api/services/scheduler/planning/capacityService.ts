/**
 * @schedule decision - 全局日容量与路径配额（统一计划体系 P1）。
 *
 * 职责：
 * - 读取全局每日学习预算 task_settings.daily_capacity_minutes（默认 60 分钟）
 *   与复习缓冲比例 task_settings.review_buffer_ratio（默认 0.2）。
 * - 在活跃路径间分配每日配额（priority DESC → target_date ASC → created_at ASC）。
 * - 按日聚合全局已排负载（learning_path_schedule 中 status='scheduled' 的分钟数），
 *   供排课装箱与手动改期做「当日总量 ≤ 全局预算」检查。
 *
 * 约束关系：配额是各路径的「节奏」上限，全局日负载检查是硬约束；
 * 两者都超时排课顺延到下一天（不拆分节点、不饿死低优先级路径）。
 */
import { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "../../../utils/logger";

export const DEFAULT_DAILY_CAPACITY_MINUTES = 240;
export const DEFAULT_REVIEW_BUFFER_RATIO = 0.2;
/** 配额下限：预算被高优先级路径占满时，低优先级路径仍保留的可排分钟数（硬约束仍由日负载检查兜底） */
export const MIN_PATH_QUOTA_MINUTES = 10;

export interface CapacitySettings {
  dailyCapacityMinutes: number;
  reviewBufferRatio: number;
}

export interface QuotaPathInput {
  id: string;
  daily_minutes_target?: number | null;
  priority?: number | null;
  target_date?: string | null;
  created_at?: string | null;
}

class CapacityService {
  /** 读取全局容量设置；task_settings 缺失或未配置时回退默认值 */
  async getCapacitySettings(
    supabase: SupabaseClient,
    userId: string,
  ): Promise<CapacitySettings> {
    const fallback: CapacitySettings = {
      dailyCapacityMinutes: DEFAULT_DAILY_CAPACITY_MINUTES,
      reviewBufferRatio: DEFAULT_REVIEW_BUFFER_RATIO,
    };
    try {
      const { data, error } = await supabase
        .from("task_settings")
        .select("daily_capacity_minutes, review_buffer_ratio")
        .eq("user_id", userId)
        .maybeSingle();
      if (error || !data) return fallback;
      const capacity = Number(data.daily_capacity_minutes);
      const ratio = Number(data.review_buffer_ratio);
      return {
        dailyCapacityMinutes:
          Number.isFinite(capacity) && capacity > 0
            ? Math.floor(capacity)
            : fallback.dailyCapacityMinutes,
        reviewBufferRatio:
          Number.isFinite(ratio) && ratio >= 0 && ratio <= 0.8
            ? ratio
            : fallback.reviewBufferRatio,
      };
    } catch (err) {
      logger.warn("[Capacity] read task_settings failed, use defaults", {
        userId,
        err,
      });
      return fallback;
    }
  }

  /**
   * 按日聚合全局已排负载（分钟）。只统计 status='scheduled' 的排期，
   * 返回 fromDate（含）之后每个日期的已排分钟数。
   */
  async getDayLoad(
    supabase: SupabaseClient,
    userId: string,
    fromDate: string,
  ): Promise<Map<string, number>> {
    const load = new Map<string, number>();
    const { data, error } = await supabase
      .from("learning_path_schedule")
      .select("scheduled_date, estimated_time")
      .eq("user_id", userId)
      .eq("status", "scheduled")
      .gte("scheduled_date", fromDate);
    if (error) {
      logger.warn("[Capacity] fetch day load failed", {
        userId,
        fromDate,
        error: error.message,
      });
      return load;
    }
    for (const row of data ?? []) {
      if (!row.scheduled_date) continue;
      const minutes = Number(row.estimated_time) || 0;
      load.set(
        row.scheduled_date as string,
        (load.get(row.scheduled_date as string) ?? 0) + minutes,
      );
    }
    return load;
  }

  /**
   * 在活跃路径间分配每日配额。
   *
   * 排序：priority DESC → target_date ASC（NULL 靠后）→ created_at ASC。
   * 分配：min(daily_minutes_target, remaining)；预算占满后的路径保底
   * MIN_PATH_QUOTA_MINUTES，避免完全饿死（保底部分若撞全局硬约束，
   * 装箱时顺延到空闲日吸收）。
   */
  allocateQuotas(
    paths: QuotaPathInput[],
    dailyCapacityMinutes: number,
  ): Map<string, number> {
    const quotas = new Map<string, number>();
    const sorted = [...paths].sort((a, b) => {
      const pA = a.priority ?? 0;
      const pB = b.priority ?? 0;
      if (pA !== pB) return pB - pA;
      if (a.target_date && b.target_date && a.target_date !== b.target_date) {
        return a.target_date < b.target_date ? -1 : 1;
      }
      if (a.target_date !== b.target_date) return a.target_date ? -1 : 1;
      return (a.created_at ?? "").localeCompare(b.created_at ?? "");
    });

    let remaining = dailyCapacityMinutes;
    for (const p of sorted) {
      const target = p.daily_minutes_target && p.daily_minutes_target > 0
        ? p.daily_minutes_target
        : 180;
      const quota = Math.max(
        Math.min(target, remaining),
        Math.min(target, MIN_PATH_QUOTA_MINUTES),
      );
      quotas.set(p.id, quota);
      remaining -= quota;
    }
    return quotas;
  }
}

export const capacityService = new CapacityService();
export { CapacityService };

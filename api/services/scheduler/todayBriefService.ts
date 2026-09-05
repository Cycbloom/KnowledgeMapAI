/**
 * @schedule decision - 「今天该学什么」聚合（P4 今日卡片）。
 *
 * 聚合四类信息，供 Dashboard 今日卡片一次拉取：
 * - 今日排期（learning_path_schedule，含知识点标题与所属路径标题）
 * - 全局日容量使用情况（已排/已完成/预算、复习缓冲）
 * - 到期复习概览（今日到期数、逾期数）
 * - 大循环决策（复用 schedulerDecisionService，含本周周窗口优先）
 * 以及跨图路径的滞后周窗口提示。
 */
import { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "../../utils/logger";
import { resolveLocalizedText } from "../../../shared/utils/localization";
import { capacityService } from "./planning/capacityService";
import { stageWindowPlannerService, type StageWindow } from "./planning/stageWindowPlannerService";
import { schedulerDecisionService, type BigLoopDecision } from "./schedulerDecisionService";

function toDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export interface TodayScheduleItem {
  id: string;
  knowledgePointId: string | null;
  title: string;
  pathTitle: string | null;
  estimatedTime: number;
  status: string;
}

export interface TodayCapacity {
  dailyCapacityMinutes: number;
  scheduledMinutes: number;
  completedMinutes: number;
  reviewBufferRatio: number;
}

export interface TodayBrief {
  date: string;
  schedule: TodayScheduleItem[];
  capacity: TodayCapacity;
  reviews: { dueToday: number; overdue: number };
  bigLoop: BigLoopDecision | null;
  laggingWindows: Array<StageWindow & { pathTitle?: string }>;
}

class TodayBriefService {
  async getTodayBrief(supabase: SupabaseClient, userId: string): Promise<TodayBrief> {
    const now = new Date();
    const today = toDateString(now);

    const [schedule, capacity, reviews, bigLoop, laggingWindows] =
      await Promise.all([
        this.getTodaySchedule(supabase, userId, today),
        this.getCapacityUsage(supabase, userId, today),
        this.getReviewCounts(supabase, userId, today),
        schedulerDecisionService
          .decideBigLoop(supabase, userId, { now })
          .catch((err: unknown) => {
            logger.warn("[TodayBrief] decideBigLoop failed", {
              error: err instanceof Error ? err.message : String(err),
            });
            return null;
          }),
        stageWindowPlannerService.getLaggingWindows(supabase, userId),
      ]);

    return {
      date: today,
      schedule,
      capacity,
      reviews,
      bigLoop,
      laggingWindows,
    };
  }

  private async getTodaySchedule(
    supabase: SupabaseClient,
    userId: string,
    today: string,
  ): Promise<TodayScheduleItem[]> {
    const { data, error } = await supabase
      .from("learning_path_schedule")
      .select(
        "id, knowledge_point_id, estimated_time, status, knowledge_points(title), learning_paths(title)",
      )
      .eq("user_id", userId)
      .eq("scheduled_date", today)
      .in("status", ["scheduled", "completed"]);
    if (error) {
      logger.warn("[TodayBrief] fetch today schedule failed", {
        userId,
        error: error.message,
      });
      return [];
    }
    return (data ?? []).map(
      (row: Record<string, unknown>) => {
        const kp = row.knowledge_points as
          | { title?: string | Record<string, string> }
          | null;
        const path = row.learning_paths as { title?: string } | null;
        return {
          id: row.id as string,
          knowledgePointId: (row.knowledge_point_id as string | null) ?? null,
          title: resolveLocalizedText(kp?.title),
          pathTitle: path?.title ?? null,
          estimatedTime: Number(row.estimated_time) || 0,
          status: (row.status as string) ?? "scheduled",
        };
      },
    );
  }

  private async getCapacityUsage(
    supabase: SupabaseClient,
    userId: string,
    today: string,
  ): Promise<TodayCapacity> {
    const settings = await capacityService.getCapacitySettings(supabase, userId);
    const { data, error } = await supabase
      .from("learning_path_schedule")
      .select("estimated_time, status")
      .eq("user_id", userId)
      .eq("scheduled_date", today);
    if (error) {
      logger.warn("[TodayBrief] fetch capacity usage failed", {
        userId,
        error: error.message,
      });
      return {
        dailyCapacityMinutes: settings.dailyCapacityMinutes,
        scheduledMinutes: 0,
        completedMinutes: 0,
        reviewBufferRatio: settings.reviewBufferRatio,
      };
    }
    let scheduledMinutes = 0;
    let completedMinutes = 0;
    for (const row of (data ?? []) as Array<{
      estimated_time: number | null;
      status: string;
    }>) {
      const minutes = Number(row.estimated_time) || 0;
      if (row.status === "completed") completedMinutes += minutes;
      else if (row.status === "scheduled") scheduledMinutes += minutes;
    }
    return {
      dailyCapacityMinutes: settings.dailyCapacityMinutes,
      scheduledMinutes,
      completedMinutes,
      reviewBufferRatio: settings.reviewBufferRatio,
    };
  }

  private async getReviewCounts(
    supabase: SupabaseClient,
    userId: string,
    today: string,
  ): Promise<{ dueToday: number; overdue: number }> {
    const { data, error } = await supabase
      .from("study_cards")
      .select("next_review")
      .eq("user_id", userId)
      .lte("next_review", `${today}T23:59:59.999Z`);
    if (error) {
      logger.warn("[TodayBrief] fetch review counts failed", {
        userId,
        error: error.message,
      });
      return { dueToday: 0, overdue: 0 };
    }
    const todayStart = `${today}T00:00:00.000Z`;
    let dueToday = 0;
    let overdue = 0;
    for (const row of (data ?? []) as Array<{ next_review: string | null }>) {
      if (!row.next_review) continue;
      if (row.next_review < todayStart) overdue += 1;
      else dueToday += 1;
    }
    return { dueToday, overdue };
  }
}

export const todayBriefService = new TodayBriefService();
export { TodayBriefService };

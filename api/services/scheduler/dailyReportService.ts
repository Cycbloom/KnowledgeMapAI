import { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "../../utils/logger";

export interface DailyReport {
  date: string;
  tasksCompleted: number;
  tasksPlanned: number;
  focusMinutes: number;
  focusSessions: number;
  cardsReviewed: number;
  pendingReviews: number;
  overdueTasks: number;
  newKnowledgePoints: number;
  newNotes: number;
}

export interface WeeklyReport {
  weekStart: string;
  weekEnd: string;
  activeDays: number;
  tasksCompleted: number;
  focusMinutes: number;
  cardsReviewed: number;
  newKnowledgePoints: number;
  newNotes: number;
  currentPendingReviews: number;
  currentOverdueTasks: number;
  dailyBreakdown: DailyReport[];
}

/** 'YYYY-MM-DD' → 本地时区当天 0 点 Date */
function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

function toLocalDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDays(d: Date, days: number): Date {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + days);
  return copy;
}

/**
 * 学习日报 / 周报聚合服务。
 *
 * 按用户本地日期聚合历史学习与任务数据，供「学习报告」页面回看：
 * - 日报：单日任务完成 / 计划、专注时长、复习卡片、新增知识点 / 笔记，
 *   以及该日结束时点的待复习 / 逾期任务快照
 * - 周报：7 天窗口的汇总（活跃天数、总量指标）与逐日明细
 *
 * 仅做只读聚合，不落库、不发通知。
 */
class DailyReportService {
  async getDailyReport(
    supabase: SupabaseClient,
    userId: string,
    dateStr: string,
  ): Promise<DailyReport> {
    const dayStart = parseLocalDate(dateStr);
    const dayEnd = addDays(dayStart, 1);
    const now = new Date();
    // 快照时刻：查询历史日期用「当天结束」；未来 / 今天用当前时刻
    const snapshotTime = dayEnd.getTime() > now.getTime() ? now : dayEnd;

    const [tasksRes, focusRes, reviewedRes, kpRes, notesRes] =
      await Promise.all([
        supabase
          .from("user_tasks")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId)
          .eq("status", "completed")
          .gte("completed_at", dayStart.toISOString())
          .lt("completed_at", dayEnd.toISOString()),
        supabase
          .from("focus_sessions")
          .select("duration")
          .eq("user_id", userId)
          .gte("ended_at", dayStart.toISOString())
          .lt("ended_at", dayEnd.toISOString()),
        supabase
          .from("study_cards")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId)
          .gte("fsrs_last_review", dayStart.toISOString())
          .lt("fsrs_last_review", dayEnd.toISOString()),
        supabase
          .from("knowledge_points")
          .select("id", { count: "exact", head: true })
          .eq("owner_id", userId)
          .gte("created_at", dayStart.toISOString())
          .lt("created_at", dayEnd.toISOString()),
        supabase
          .from("notes")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId)
          .is("deleted_at", null)
          .gte("created_at", dayStart.toISOString())
          .lt("created_at", dayEnd.toISOString()),
      ]);

    // 计划任务：当天 scheduled_start 落点（含逾期补排）
    const plannedRes = await supabase
      .from("user_tasks")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .is("deleted_at", null)
      .in("status", ["pending", "in_progress", "paused", "completed"])
      .gte("scheduled_start", dayStart.toISOString())
      .lt("scheduled_start", dayEnd.toISOString());

    // 当日结束时刻的待复习 / 逾期快照
    const [pendingRes, overdueRes] = await Promise.all([
      supabase
        .from("study_cards")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .lte("next_review", snapshotTime.toISOString()),
      supabase
        .from("user_tasks")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .not("deadline", "is", null)
        .is("deleted_at", null)
        .in("status", ["pending", "in_progress", "paused"])
        .lt("deadline", snapshotTime.toISOString()),
    ]);

    const focusRows = (focusRes.data ?? []) as { duration?: number }[];
    const focusMinutes = Math.round(
      focusRows.reduce((sum, row) => sum + (row.duration ?? 0), 0) / 60,
    );

    return {
      date: dateStr,
      tasksCompleted: tasksRes.count ?? 0,
      tasksPlanned: plannedRes.count ?? 0,
      focusMinutes,
      focusSessions: focusRows.length,
      cardsReviewed: reviewedRes.count ?? 0,
      pendingReviews: pendingRes.count ?? 0,
      overdueTasks: overdueRes.count ?? 0,
      newKnowledgePoints: kpRes.count ?? 0,
      newNotes: notesRes.count ?? 0,
    };
  }

  async getWeeklyReport(
    supabase: SupabaseClient,
    userId: string,
    weekStartStr: string,
  ): Promise<WeeklyReport> {
    const weekStart = parseLocalDate(weekStartStr);
    const weekEnd = addDays(weekStart, 7);

    try {
      // 7 天窗口内逐日明细并行计算
      const days: DailyReport[] = [];
      for (let i = 0; i < 7; i++) {
        const d = addDays(weekStart, i);
        // 未来日期跳过，避免无意义聚合
        if (d.getTime() > Date.now()) break;
        days.push(await this.getDailyReport(supabase, userId, toLocalDateStr(d)));
      }

      const aggregate = (pick: (r: DailyReport) => number) =>
        days.reduce((sum, r) => sum + pick(r), 0);

      // 当前时刻的待复习 / 逾期快照
      const now = new Date();
      const [pendingRes, overdueRes] = await Promise.all([
        supabase
          .from("study_cards")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId)
          .lte("next_review", now.toISOString()),
        supabase
          .from("user_tasks")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId)
          .not("deadline", "is", null)
          .is("deleted_at", null)
          .in("status", ["pending", "in_progress", "paused"])
          .lt("deadline", now.toISOString()),
      ]);

      return {
        weekStart: weekStartStr,
        weekEnd: toLocalDateStr(weekEnd),
        activeDays: days.filter(
          (r) =>
            r.tasksCompleted > 0 ||
            r.focusMinutes > 0 ||
            r.cardsReviewed > 0 ||
            r.newKnowledgePoints > 0,
        ).length,
        tasksCompleted: aggregate((r) => r.tasksCompleted),
        focusMinutes: aggregate((r) => r.focusMinutes),
        cardsReviewed: aggregate((r) => r.cardsReviewed),
        newKnowledgePoints: aggregate((r) => r.newKnowledgePoints),
        newNotes: aggregate((r) => r.newNotes),
        currentPendingReviews: pendingRes.count ?? 0,
        currentOverdueTasks: overdueRes.count ?? 0,
        dailyBreakdown: days,
      };
    } catch (error) {
      logger.error(`[DailyReport] weekly aggregation failed for user ${userId}:`, error);
      throw error;
    }
  }
}

export const dailyReportService = new DailyReportService();

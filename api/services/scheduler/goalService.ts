import { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "../../utils/logger";

export type GoalPeriodType = "week" | "month";
export type GoalMetric =
  | "focus_minutes"
  | "tasks_completed"
  | "cards_reviewed"
  | "new_knowledge_points";

export interface LearningGoalRow {
  id: string;
  period_type: GoalPeriodType;
  metric: GoalMetric;
  target_value: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface LearningGoalWithProgress extends LearningGoalRow {
  current_value: number;
  progress_percent: number;
  period_start: string;
}

export interface GoalProgress {
  focus_minutes: number;
  tasks_completed: number;
  cards_reviewed: number;
  new_knowledge_points: number;
  period_start: string;
}

/** 周期起点（本地时区）：week → 本周一，month → 当月 1 号。 */
function periodStart(periodType: GoalPeriodType): string {
  const now = new Date();
  const start = new Date(now);
  if (periodType === "week") {
    start.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  } else {
    start.setDate(1);
  }
  start.setHours(0, 0, 0, 0);
  return start.toISOString();
}

/**
 * 个人长期学习目标服务。
 *
 * 目标按（period_type, metric）唯一，用户可设定周/月维度的：
 * 专注时长、完成任务、复习卡片、新增知识点。进度为周期起点至当前时刻
 * 的实时聚合，与日报/周报的口径一致（focus_sessions / user_tasks /
 * study_cards / knowledge_points）。
 */
class GoalService {
  async listGoals(
    supabase: SupabaseClient,
    userId: string,
  ): Promise<LearningGoalWithProgress[]> {
    const { data, error } = await supabase
      .from("learning_goals")
      .select("*")
      .eq("user_id", userId)
      .eq("active", true)
      .order("period_type", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) {
      logger.error("[GoalService] Failed to list goals:", error);
      throw error;
    }

    const rows = (data ?? []) as LearningGoalRow[];
    if (rows.length === 0) return [];

    // 周 / 月各聚合一次进度，再按目标映射
    const [weekProgress, monthProgress] = await Promise.all([
      this.getProgress(supabase, userId, "week"),
      this.getProgress(supabase, userId, "month"),
    ]);

    return rows.map((row) => {
      const progress =
        row.period_type === "week" ? weekProgress : monthProgress;
      const current = currentForMetric(progress, row.metric);
      return {
        ...row,
        current_value: current,
        progress_percent: Math.min(
          100,
          Math.round((current / row.target_value) * 100),
        ),
        period_start: progress.period_start,
      };
    });
  }

  async upsertGoal(
    supabase: SupabaseClient,
    userId: string,
    input: { periodType: GoalPeriodType; metric: GoalMetric; targetValue: number },
  ): Promise<LearningGoalRow> {
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("learning_goals")
      .upsert(
        {
          user_id: userId,
          period_type: input.periodType,
          metric: input.metric,
          target_value: input.targetValue,
          active: true,
          updated_at: now,
        },
        { onConflict: "user_id,period_type,metric" },
      )
      .select("*")
      .single();

    if (error) {
      logger.error("[GoalService] Failed to upsert goal:", error);
      throw error;
    }
    return data as LearningGoalRow;
  }

  async deleteGoal(
    supabase: SupabaseClient,
    userId: string,
    goalId: string,
  ): Promise<void> {
    const { error } = await supabase
      .from("learning_goals")
      .delete()
      .eq("id", goalId)
      .eq("user_id", userId);
    if (error) {
      logger.error("[GoalService] Failed to delete goal:", error);
      throw error;
    }
  }

  async getProgress(
    supabase: SupabaseClient,
    userId: string,
    periodType: GoalPeriodType,
  ): Promise<GoalProgress> {
    const start = periodStart(periodType);
    const now = new Date().toISOString();

    const [focusRes, tasksRes, cardsRes, kpRes] = await Promise.all([
      supabase
        .from("focus_sessions")
        .select("duration")
        .eq("user_id", userId)
        .gte("ended_at", start)
        .lte("ended_at", now),
      supabase
        .from("user_tasks")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("status", "completed")
        .gte("completed_at", start)
        .lte("completed_at", now),
      supabase
        .from("study_cards")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .gte("fsrs_last_review", start)
        .lte("fsrs_last_review", now),
      supabase
        .from("knowledge_points")
        .select("id", { count: "exact", head: true })
        .eq("owner_id", userId)
        .gte("created_at", start)
        .lte("created_at", now),
    ]);

    const focusRows = (focusRes.data ?? []) as { duration?: number }[];
    return {
      focus_minutes: Math.round(
        focusRows.reduce((sum, row) => sum + (row.duration ?? 0), 0) / 60,
      ),
      tasks_completed: tasksRes.count ?? 0,
      cards_reviewed: cardsRes.count ?? 0,
      new_knowledge_points: kpRes.count ?? 0,
      period_start: start,
    };
  }
}

function currentForMetric(
  progress: GoalProgress,
  metric: GoalMetric,
): number {
  switch (metric) {
    case "focus_minutes":
      return progress.focus_minutes;
    case "tasks_completed":
      return progress.tasks_completed;
    case "cards_reviewed":
      return progress.cards_reviewed;
    case "new_knowledge_points":
      return progress.new_knowledge_points;
  }
}

export const goalService = new GoalService();

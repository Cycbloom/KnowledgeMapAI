import type { AchievementConditionEvaluator } from "../types"
import { getSupabaseAdmin } from "../../../supabase"

const weeklyStreakEvaluator: AchievementConditionEvaluator = {
  conditionType: "weekly_streak",
  relevantEvents: [],
  async getCurrentValue(userId: string): Promise<number> {
    const { data, error } = await getSupabaseAdmin()
      .from("user_focus_stats")
      .select("weekly_streak")
      .eq("user_id", userId)
      .single()
    if (error || !data) return 0
    return data.weekly_streak ?? 0
  },
}

const monthlyStreakEvaluator: AchievementConditionEvaluator = {
  conditionType: "monthly_streak",
  relevantEvents: [],
  async getCurrentValue(userId: string): Promise<number> {
    const { data, error } = await getSupabaseAdmin()
      .from("user_focus_stats")
      .select("monthly_streak")
      .eq("user_id", userId)
      .single()
    if (error || !data) return 0
    return data.monthly_streak ?? 0
  },
}

const quarterlyStreakEvaluator: AchievementConditionEvaluator = {
  conditionType: "quarterly_streak",
  relevantEvents: [],
  async getCurrentValue(userId: string): Promise<number> {
    const { data, error } = await getSupabaseAdmin()
      .from("user_focus_stats")
      .select("quarterly_streak")
      .eq("user_id", userId)
      .single()
    if (error || !data) return 0
    return data.quarterly_streak ?? 0
  },
}

const dailyTaskStreakEvaluator: AchievementConditionEvaluator = {
  conditionType: "daily_task_streak",
  relevantEvents: [],
  async getCurrentValue(userId: string): Promise<number> {
    const { data, error } = await getSupabaseAdmin()
      .from("user_focus_stats")
      .select("daily_task_streak")
      .eq("user_id", userId)
      .single()
    if (error || !data) return 0
    return data.daily_task_streak ?? 0
  },
}

export const periodicStreakEvaluators: AchievementConditionEvaluator[] = [
  weeklyStreakEvaluator,
  monthlyStreakEvaluator,
  quarterlyStreakEvaluator,
  dailyTaskStreakEvaluator,
]

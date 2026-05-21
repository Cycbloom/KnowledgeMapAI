import type { AchievementConditionEvaluator } from "../types"
import { getSupabaseAdmin } from "../../../supabase"

const consecutiveDaysEvaluator: AchievementConditionEvaluator = {
  conditionType: "consecutive_days",
  relevantEvents: ["focus_session_ended"],
  async getCurrentValue(userId: string): Promise<number> {
    const { data, error } = await getSupabaseAdmin()
      .from("user_focus_stats")
      .select("current_streak")
      .eq("user_id", userId)
      .single()
    if (error || !data) return 0
    return data.current_streak ?? 0
  },
}

const streakDaysEvaluator: AchievementConditionEvaluator = {
  conditionType: "streak_days",
  relevantEvents: ["focus_session_ended"],
  async getCurrentValue(userId: string): Promise<number> {
    const { data, error } = await getSupabaseAdmin()
      .from("focus_sessions")
      .select("start_time")
      .eq("user_id", userId)
      .eq("completed", true)
      .order("start_time", { ascending: false })
    if (error || !data || data.length === 0) return 0

    const dates = new Set(
      data.map((row: { start_time: string }) => row.start_time.split("T")[0])
    )
    const sortedDates = Array.from(dates).sort(
      (a, b) => new Date(b).getTime() - new Date(a).getTime()
    )

    const today = new Date().toISOString().split("T")[0]
    const yesterday = new Date(Date.now() - 86400000)
      .toISOString()
      .split("T")[0]

    if (sortedDates[0] !== today && sortedDates[0] !== yesterday) {
      return 0
    }

    const checkDate = new Date()
    if (!dates.has(checkDate.toISOString().split("T")[0])) {
      checkDate.setDate(checkDate.getDate() - 1)
    }

    let streak = 0
    while (dates.has(checkDate.toISOString().split("T")[0])) {
      streak++
      checkDate.setDate(checkDate.getDate() - 1)
    }

    return streak
  },
}

export const streakEvaluators: AchievementConditionEvaluator[] = [
  consecutiveDaysEvaluator,
  streakDaysEvaluator,
]

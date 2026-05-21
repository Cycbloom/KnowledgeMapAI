import type { AchievementConditionEvaluator } from "../types"
import type { AppEvent } from "@shared/types/events"
import { getSupabaseAdmin } from "../../../supabase"

const focusSessionsEvaluator: AchievementConditionEvaluator = {
  conditionType: "focus_sessions",
  relevantEvents: ["focus_session_ended"],
  async getCurrentValue(userId: string): Promise<number> {
    const { count, error } = await getSupabaseAdmin()
      .from("focus_sessions")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("completed", true)
    if (error) return 0
    return count ?? 0
  },
  getIncrementalDelta(_event: AppEvent): number {
    return 1
  },
}

const totalFocusHoursEvaluator: AchievementConditionEvaluator = {
  conditionType: "total_focus_hours",
  relevantEvents: ["focus_session_ended"],
  async getCurrentValue(userId: string): Promise<number> {
    const { data, error } = await getSupabaseAdmin()
      .from("focus_sessions")
      .select("duration")
      .eq("user_id", userId)
      .eq("completed", true)
    if (error || !data) return 0
    const totalSeconds = data.reduce((acc, row) => acc + (row.duration ?? 0), 0)
    return Math.floor(totalSeconds / 3600)
  },
}

const focusMinutesEvaluator: AchievementConditionEvaluator = {
  conditionType: "focus_minutes",
  relevantEvents: ["focus_session_ended"],
  async getCurrentValue(userId: string): Promise<number> {
    const { data, error } = await getSupabaseAdmin()
      .from("focus_sessions")
      .select("duration")
      .eq("user_id", userId)
      .eq("completed", true)
    if (error || !data) return 0
    const totalSeconds = data.reduce((acc, row) => acc + (row.duration ?? 0), 0)
    return Math.floor(totalSeconds / 60)
  },
}

const dailyFocusHoursEvaluator: AchievementConditionEvaluator = {
  conditionType: "daily_focus_hours",
  relevantEvents: ["focus_session_ended"],
  async getCurrentValue(userId: string): Promise<number> {
    const today = new Date().toISOString().split("T")[0]
    const { data, error } = await getSupabaseAdmin()
      .from("focus_sessions")
      .select("duration")
      .eq("user_id", userId)
      .eq("completed", true)
      .gte("start_time", today)
    if (error || !data) return 0
    const totalSeconds = data.reduce((acc, row) => acc + (row.duration ?? 0), 0)
    return Math.floor(totalSeconds / 3600)
  },
}

const pomodorosCompletedEvaluator: AchievementConditionEvaluator = {
  conditionType: "pomodoros_completed",
  relevantEvents: ["focus_session_ended"],
  async getCurrentValue(userId: string): Promise<number> {
    const { data, error } = await getSupabaseAdmin()
      .from("user_focus_stats")
      .select("total_pomodoros")
      .eq("user_id", userId)
      .single()
    if (error || !data) return 0
    return data.total_pomodoros ?? 0
  },
  getIncrementalDelta(event: AppEvent): number {
    const payload = event.payload as { pomodoroCount?: number }
    return (payload?.pomodoroCount ?? 0) > 0 ? 1 : 0
  },
}

export const focusEvaluators: AchievementConditionEvaluator[] = [
  focusSessionsEvaluator,
  totalFocusHoursEvaluator,
  focusMinutesEvaluator,
  dailyFocusHoursEvaluator,
  pomodorosCompletedEvaluator,
]

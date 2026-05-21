import type { AchievementConditionEvaluator } from "../types"
import type { AppEvent } from "@shared/types/events"
import { getSupabaseAdmin } from "../../../supabase"

const tasksCompletedEvaluator: AchievementConditionEvaluator = {
  conditionType: "tasks_completed",
  relevantEvents: ["task_completed"],
  async getCurrentValue(userId: string): Promise<number> {
    const { data, error } = await getSupabaseAdmin()
      .from("user_focus_stats")
      .select("total_tasks_completed")
      .eq("user_id", userId)
      .single()
    if (error || !data) return 0
    return data.total_tasks_completed ?? 0
  },
  getIncrementalDelta(_event: AppEvent): number {
    return 1
  },
}

export const taskEvaluators: AchievementConditionEvaluator[] = [
  tasksCompletedEvaluator,
]

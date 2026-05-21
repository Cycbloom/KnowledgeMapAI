import type { AchievementConditionEvaluator } from "../types"
import type { AppEvent } from "@shared/types/events"
import { getSupabaseAdmin } from "../../../supabase"

const cardsMasteredEvaluator: AchievementConditionEvaluator = {
  conditionType: "cards_mastered",
  relevantEvents: ["review_completed"],
  async getCurrentValue(userId: string): Promise<number> {
    const { count, error } = await getSupabaseAdmin()
      .from("study_cards")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .gt("fsrs_stability", 21)
    if (error) return 0
    return count ?? 0
  },
  getIncrementalDelta(_event: AppEvent): number {
    return 1
  },
}

export const studyEvaluators: AchievementConditionEvaluator[] = [
  cardsMasteredEvaluator,
]

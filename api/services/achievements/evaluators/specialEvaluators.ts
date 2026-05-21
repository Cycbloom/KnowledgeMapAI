import type { AchievementConditionEvaluator } from "../types"

const specialConditionEvaluator: AchievementConditionEvaluator = {
  conditionType: "special_condition",
  relevantEvents: ["focus_session_ended", "task_completed"],
  async getCurrentValue(_userId: string): Promise<number> {
    return 0
  },
}

export const specialEvaluators: AchievementConditionEvaluator[] = [
  specialConditionEvaluator,
]

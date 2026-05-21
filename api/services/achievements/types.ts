import type { AppEventType, AppEvent } from "@shared/types/events"

export interface AchievementConditionEvaluator {
  conditionType: string
  relevantEvents: AppEventType[]
  getCurrentValue(userId: string): Promise<number>
  getIncrementalDelta?(event: AppEvent): number
}

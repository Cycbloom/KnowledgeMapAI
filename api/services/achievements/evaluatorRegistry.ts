import type { AchievementConditionEvaluator } from "./types"
import type { AppEventType } from "@shared/types/events"

class EvaluatorRegistry {
  private evaluators: Map<string, AchievementConditionEvaluator> = new Map()
  private eventIndex: Map<AppEventType, Set<AchievementConditionEvaluator>> = new Map()

  register(evaluator: AchievementConditionEvaluator): void {
    this.evaluators.set(evaluator.conditionType, evaluator)
    for (const event of evaluator.relevantEvents) {
      if (!this.eventIndex.has(event)) {
        this.eventIndex.set(event, new Set())
      }
      this.eventIndex.get(event)!.add(evaluator)
    }
  }

  get(conditionType: string): AchievementConditionEvaluator | undefined {
    return this.evaluators.get(conditionType)
  }

  getByEvent(eventType: AppEventType): AchievementConditionEvaluator[] {
    return Array.from(this.eventIndex.get(eventType) ?? [])
  }

  getAll(): AchievementConditionEvaluator[] {
    return Array.from(this.evaluators.values())
  }
}

export const evaluatorRegistry = new EvaluatorRegistry()

import { getSupabaseAdmin } from "../../supabase"
import { logger } from "../../utils/logger"
import { evaluatorRegistry } from "./evaluatorRegistry"
import "./evaluators"
import type { AppEventType, AppEvent, FocusSessionEndedPayload } from "@shared/types/events"
import type { Achievement, FocusSession } from "@shared/types/scheduler"
import type { UserAchievementRow, FocusSessionRow } from "@shared/types/database"

export class AchievementEngine {
  async evaluateAchievements(userId: string, eventType: AppEventType, event?: AppEvent): Promise<Achievement[]> {
    const evaluators = evaluatorRegistry.getByEvent(eventType)
    if (evaluators.length === 0) return []

    const conditionTypes = new Set(evaluators.map(e => e.conditionType))

    const { data: achievements, error } = await getSupabaseAdmin()
      .from("achievements")
      .select("*")
      .contains("trigger_events", [eventType])
      .in("condition_type", Array.from(conditionTypes))

    if (error || !achievements || achievements.length === 0) return []

    const { data: userAchievements } = await getSupabaseAdmin()
      .from("user_achievements")
      .select("achievement_id, progress")
      .eq("user_id", userId)

    const existingMap = new Map(
      (userAchievements ?? []).map(
        (ua: Pick<UserAchievementRow, 'achievement_id' | 'progress'>) => [
          ua.achievement_id,
          ua.progress as number,
        ]
      )
    )

    const unlocked: Achievement[] = []

    for (const achievement of achievements) {
      if (existingMap.has(achievement.id) && existingMap.get(achievement.id)! >= achievement.condition_value) {
        continue
      }

      const evaluator = evaluatorRegistry.get(achievement.condition_type)
      if (!evaluator) continue

      let currentValue: number

      if (event && evaluator.getIncrementalDelta) {
        const existingProgress = existingMap.get(achievement.id) ?? 0
        const delta = evaluator.getIncrementalDelta(event)
        currentValue = existingProgress + delta

        await getSupabaseAdmin()
          .from("user_achievements")
          .upsert(
            {
              user_id: userId,
              achievement_id: achievement.id,
              progress: currentValue,
              metadata: { last_event: eventType, updated_at: new Date().toISOString() },
            },
            { onConflict: "user_id,achievement_id" }
          )
      } else {
        currentValue = await evaluator.getCurrentValue(userId)

        if (existingMap.has(achievement.id)) {
          await getSupabaseAdmin()
            .from("user_achievements")
            .update({ progress: currentValue, metadata: { last_event: eventType, updated_at: new Date().toISOString() } })
            .eq("user_id", userId)
            .eq("achievement_id", achievement.id)
        } else {
          await getSupabaseAdmin()
            .from("user_achievements")
            .insert({
              user_id: userId,
              achievement_id: achievement.id,
              progress: currentValue,
              metadata: { last_event: eventType, updated_at: new Date().toISOString() },
            })
        }
      }

      if (currentValue >= achievement.condition_value) {
        const { error: unlockError } = await getSupabaseAdmin()
          .from("user_achievements")
          .upsert(
            {
              user_id: userId,
              achievement_id: achievement.id,
              progress: currentValue,
              unlocked_at: new Date().toISOString(),
              metadata: { unlocked_value: currentValue, unlocked_via: eventType },
            },
            { onConflict: "user_id,achievement_id" }
          )

        if (!unlockError) {
          unlocked.push(achievement as Achievement)
          if (achievement.xp_reward) {
            const { achievementService } = await import("../achievementService")
            await achievementService.addXp(userId, achievement.xp_reward)
          }
        }
      }
    }

    await this.updateDailyAndPeriodicTasks(userId, eventType)

    if (eventType === "focus_session_ended" && event) {
      try {
        const { achievementService } = await import("../achievementService")
        const payload = event.payload as FocusSessionEndedPayload
        const { data: session } = await getSupabaseAdmin()
          .from("focus_sessions")
          .select("*")
          .eq("id", payload.sessionId)
          .single()
        if (session) {
          await achievementService.checkSpecialAchievements(
            userId,
            session as unknown as FocusSession
          )
        }
      } catch (error) {
        logger.error("[AchievementEngine] Failed to check special achievements:", error)
      }
    }

    if (eventType === "task_completed" || eventType === "focus_session_ended") {
      try {
        const { achievementService } = await import("../achievementService")
        await achievementService.checkPerfectionist(userId).catch(() => {})
        await achievementService.checkMultitasker(userId).catch(() => {})
      } catch (error) {
        logger.error("[AchievementEngine] Failed to check perfectionist/multitasker:", error)
      }
    }

    return unlocked
  }

  private async updateDailyAndPeriodicTasks(userId: string, eventType: AppEventType): Promise<void> {
    const { achievementService } = await import("../achievementService")
    const { periodicTaskService } = await import("../scheduler/periodicTaskService")

    switch (eventType) {
      case "graph_created":
      case "node_created":
        await achievementService.updateDailyTask(userId, "create_node", 1)
        try {
          const { count: nodeCount } = await getSupabaseAdmin()
            .from("graph_nodes")
            .select("id, knowledge_graphs!inner(user_id)", { count: "exact", head: true })
            .eq("knowledge_graphs.user_id", userId)
            .is("deleted_at", null)
          await periodicTaskService.updatePeriodicTaskProgress(userId, "create", nodeCount || 0)
        } catch (error) {
          logger.error("[AchievementEngine] Failed to update periodic task progress for create:", error)
        }
        break

      case "review_completed":
        await achievementService.updateDailyTask(userId, "study_cards", 1)
        try {
          const { count: masteredCount } = await getSupabaseAdmin()
            .from("study_cards")
            .select("*", { count: "exact", head: true })
            .eq("user_id", userId)
            .gt("fsrs_stability", 21)
          await periodicTaskService.updatePeriodicTaskProgress(userId, "study", masteredCount || 0)
        } catch (error) {
          logger.error("[AchievementEngine] Failed to update periodic task progress for study:", error)
        }
        break

      case "focus_session_ended":
        try {
          const today = new Date().toISOString().split("T")[0]
          const { data: todaySessions } = await getSupabaseAdmin()
            .from("focus_sessions")
            .select("duration")
            .eq("user_id", userId)
            .eq("completed", true)
            .gte("started_at", today)
          const todayMinutes =
            (todaySessions as Pick<FocusSessionRow, 'duration'>[] | null)?.reduce(
              (acc, curr) => acc + (curr.duration || 0),
              0
            ) || 0
          await achievementService.updateDailyTaskProgress(userId, "focus_time", todayMinutes)

          const { data: allSessions } = await getSupabaseAdmin()
            .from("focus_sessions")
            .select("duration")
            .eq("user_id", userId)
            .eq("completed", true)
          const totalMinutes =
            (allSessions as Pick<FocusSessionRow, 'duration'>[] | null)?.reduce(
              (acc, curr) => acc + (curr.duration || 0),
              0
            ) || 0
          await periodicTaskService.updatePeriodicTaskProgress(userId, "focus", totalMinutes)

          await achievementService.updateStudyStreak(userId)
        } catch (error) {
          logger.error("[AchievementEngine] Failed to update focus stats:", error)
        }
        break

      case "task_completed":
        break
    }
  }

  async calibrateAllProgress(userId: string): Promise<void> {
    const { data: achievements } = await getSupabaseAdmin()
      .from("achievements")
      .select("*")

    if (!achievements) return

    for (const achievement of achievements) {
      const evaluator = evaluatorRegistry.get(achievement.condition_type)
      if (!evaluator || evaluator.conditionType === "special_condition") continue

      try {
        const currentValue = await evaluator.getCurrentValue(userId)

        await getSupabaseAdmin()
          .from("user_achievements")
          .upsert(
            {
              user_id: userId,
              achievement_id: achievement.id,
              progress: currentValue,
              unlocked_at: currentValue >= achievement.condition_value ? new Date().toISOString() : undefined,
              metadata: { calibrated_at: new Date().toISOString() },
            },
            { onConflict: "user_id,achievement_id" }
          )
      } catch (error) {
        logger.error(`[AchievementEngine] Calibration failed for ${achievement.code}:`, error)
      }
    }
  }
}

export const achievementEngine = new AchievementEngine()

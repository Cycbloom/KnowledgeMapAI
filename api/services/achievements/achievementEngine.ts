import { getSupabaseAdmin } from "../../supabase"
import { logger } from "../../utils/logger"
import { evaluatorRegistry } from "./evaluatorRegistry"
import { transactionExecutor } from "../../database/transactionExecutor"
import "./evaluators"
import type { AppEventType, AppEvent, FocusSessionEndedPayload } from "@shared/types/events"
import type { Achievement, FocusSession } from "@shared/types/scheduler"
import type { UserAchievementRow, FocusSessionRow } from "@shared/types/database"
import { notDeleted } from '../common/softDeleteHelper';

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

    // Track whether core evaluation succeeded to avoid running side effects on failed state
    let evaluationSucceeded = false

    // Transactional path
    if (transactionExecutor.isAvailable()) {
      try {
        const unlockedIds = await transactionExecutor.executeInTransaction(async (client) => {
          const now = new Date().toISOString()
          const newlyUnlockedIds: string[] = []

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

              await client.query(
                `INSERT INTO user_achievements (user_id, achievement_id, progress, metadata)
                 VALUES ($1, $2, $3, $4)
                 ON CONFLICT (user_id, achievement_id)
                 DO UPDATE SET progress = $3, metadata = $4`,
                [userId, achievement.id, currentValue, JSON.stringify({ last_event: eventType, updated_at: now })],
              )
            } else {
              currentValue = await evaluator.getCurrentValue(userId)

              if (existingMap.has(achievement.id)) {
                await client.query(
                  `UPDATE user_achievements SET progress = $1, metadata = $2 WHERE user_id = $3 AND achievement_id = $4`,
                  [currentValue, JSON.stringify({ last_event: eventType, updated_at: now }), userId, achievement.id],
                )
              } else {
                await client.query(
                  `INSERT INTO user_achievements (user_id, achievement_id, progress, metadata) VALUES ($1, $2, $3, $4)`,
                  [userId, achievement.id, currentValue, JSON.stringify({ last_event: eventType, updated_at: now })],
                )
              }
            }

            if (currentValue >= achievement.condition_value) {
              await client.query(
                `INSERT INTO user_achievements (user_id, achievement_id, progress, unlocked_at, metadata)
                 VALUES ($1, $2, $3, $4, $5)
                 ON CONFLICT (user_id, achievement_id)
                 DO UPDATE SET progress = $3, unlocked_at = $4, metadata = $5`,
                [
                  userId,
                  achievement.id,
                  currentValue,
                  now,
                  JSON.stringify({ unlocked_value: currentValue, unlocked_via: eventType }),
                ],
              )

              newlyUnlockedIds.push(achievement.id)

              // Add XP within transaction
              if (achievement.xp_reward) {
                const { rows: userRows } = await client.query(
                  `SELECT xp, level FROM users WHERE id = $1`,
                  [userId],
                )

                if (userRows.length > 0) {
                  let { xp, level } = userRows[0]
                  xp = (xp || 0) + achievement.xp_reward

                  let nextLevelThreshold = level * 500
                  while (xp >= nextLevelThreshold) {
                    xp -= nextLevelThreshold
                    level++
                    nextLevelThreshold = level * 500
                  }

                  await client.query(
                    `UPDATE users SET xp = $1, level = $2 WHERE id = $3`,
                    [xp, level, userId],
                  )
                }
              }
            }
          }

          return newlyUnlockedIds
        })

        // Build unlocked list from IDs
        for (const id of unlockedIds) {
          const ach = achievements.find(a => a.id === id)
          if (ach) unlocked.push(ach as Achievement)
        }

        evaluationSucceeded = true
      } catch (txError) {
        logger.warn('Transaction failed in evaluateAchievements, falling back to non-transactional operations', { error: txError })

        // Non-transactional fallback
        await this.evaluateAchievementsNonTransactional(userId, eventType, event, achievements, existingMap, unlocked)
        evaluationSucceeded = true
      }
    } else {
      logger.warn('TransactionExecutor not available, using non-transactional path for evaluateAchievements')

      // Non-transactional fallback
      await this.evaluateAchievementsNonTransactional(userId, eventType, event, achievements, existingMap, unlocked)
      evaluationSucceeded = true
    }

    // Only run side effects after successful evaluation (transactional or fallback)
    if (evaluationSucceeded) {
      await this.runPostEvaluationSideEffects(userId, eventType, event)
    }

    return unlocked
  }

  private async runPostEvaluationSideEffects(
    userId: string,
    eventType: AppEventType,
    event?: AppEvent,
  ): Promise<void> {
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
  }

  private async evaluateAchievementsNonTransactional(
    userId: string,
    eventType: AppEventType,
    event: AppEvent | undefined,
    achievements: { id: string; condition_type: string; condition_value: number; xp_reward: number; [key: string]: unknown }[],
    existingMap: Map<string, number>,
    unlocked: Achievement[],
  ): Promise<void> {
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
          unlocked.push(achievement as unknown as Achievement)
          if (achievement.xp_reward) {
            const { achievementService } = await import("../achievementService")
            await achievementService.addXp(userId, achievement.xp_reward)
          }
        }
      }
    }
  }

  private async updateDailyAndPeriodicTasks(userId: string, eventType: AppEventType): Promise<void> {
    const { achievementService } = await import("../achievementService")
    const { periodicTaskService } = await import("../scheduler/periodicTaskService")

    switch (eventType) {
      case "graph_created":
      case "node_created":
        await achievementService.updateDailyTask(userId, "create_node", 1)
        try {
          const { count: nodeCount } = await notDeleted(getSupabaseAdmin()
            .from("graph_nodes")
            .select("id, knowledge_graphs!inner(user_id)", { count: "exact", head: true })
            .eq("knowledge_graphs.user_id", userId)
            )
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

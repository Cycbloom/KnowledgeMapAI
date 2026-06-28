import { getSupabaseAdmin } from '../supabase';
import { logger } from '../utils/logger';
import { periodicTaskService } from './scheduler/periodicTaskService';
import { focusService } from './scheduler/focusService';
import { transactionExecutor } from '../database/transactionExecutor';
import { notDeleted } from './common/softDeleteHelper';
import type {
  Achievement,
  UserAchievement,
  AchievementCheckResult,
  FocusSession,
} from '@shared/types/scheduler';
import type {
  AchievementRow,
  UserAchievementRow,
  PeriodicTaskRow,
  FocusSessionRow,
  UserTaskRow,
} from '@shared/types/database';

export class AchievementService {
  async initDailyTasks(userId: string): Promise<void> {
    const today = new Date().toISOString().split('T')[0];

    const { count, error } = await getSupabaseAdmin()
      .from('periodic_tasks')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('period_type', 'daily')
      .eq('period_start', today);

    if (error || (count && count > 0)) return;

    const tasks = [
      { user_id: userId, period_type: 'daily' as const, period_start: today, period_end: today, task_type: 'login', target: 1, xp_reward: 20 },
      { user_id: userId, period_type: 'daily' as const, period_start: today, period_end: today, task_type: 'study_cards', target: 10, xp_reward: 50 },
      { user_id: userId, period_type: 'daily' as const, period_start: today, period_end: today, task_type: 'focus_time', target: 25, xp_reward: 50 },
      { user_id: userId, period_type: 'daily' as const, period_start: today, period_end: today, task_type: 'create_node', target: 1, xp_reward: 30 }
    ];

    await getSupabaseAdmin().from('periodic_tasks').insert(tasks);
  }

  async getDailyTasks(userId: string): Promise<PeriodicTaskRow[]> {
    await this.initDailyTasks(userId);

    const today = new Date().toISOString().split('T')[0];
    const { data } = await getSupabaseAdmin()
      .from('periodic_tasks')
      .select('*')
      .eq('user_id', userId)
      .eq('period_type', 'daily')
      .eq('period_start', today)
      .order('created_at');

    return (data as PeriodicTaskRow[]) || [];
  }

  async updateDailyTask(userId: string, type: string, amount: number = 1): Promise<void> {
    const today = new Date().toISOString().split('T')[0];

    const { data: task } = await getSupabaseAdmin()
      .from('periodic_tasks')
      .select('*')
      .eq('user_id', userId)
      .eq('period_type', 'daily')
      .eq('period_start', today)
      .eq('task_type', type)
      .single();

    if (!task || task.status !== 'pending') return;

    const newProgress = Math.min(task.progress + amount, task.target);
    const updates: Partial<PeriodicTaskRow> & { completed_at?: string } = { progress: newProgress };

    if (newProgress >= task.target) {
      updates.status = 'completed';
      updates.completed_at = new Date().toISOString();
    }

    await getSupabaseAdmin()
      .from('periodic_tasks')
      .update(updates)
      .eq('id', task.id);

    if (updates.status === 'completed') {
      await this.addXp(userId, task.xp_reward);
      this.checkPerfectionist(userId).catch(() => {});
      this.checkMultitasker(userId).catch(() => {});
    }
  }

  async getAchievements(userId: string): Promise<Achievement[]> {
    const { data: allAchievements, error: fetchError } = await getSupabaseAdmin()
      .from('achievements')
      .select('*')
      .order('condition_value', { ascending: true });

    if (fetchError) throw fetchError;

    const { data: userAchievements, error: userError } = await getSupabaseAdmin()
      .from('user_achievements')
      .select('achievement_id, unlocked_at')
      .eq('user_id', userId);

    if (userError) throw userError;

    const unlockedMap = new Map(
      (userAchievements as Pick<UserAchievementRow, 'achievement_id' | 'unlocked_at'>[]).map(
        (ua) => [ua.achievement_id, ua.unlocked_at]
      )
    );

    return (allAchievements as AchievementRow[]).map((ach) => ({
      ...ach,
      unlocked_at: unlockedMap.get(ach.id) || null
    }));
  }

  /** @deprecated Use achievementEngine.evaluateAchievements() instead */
  async checkAndUnlock(userId: string, type: string, currentValue: number): Promise<Achievement[]> {
    const { data: candidates, error: candidateError } = await getSupabaseAdmin()
      .from('achievements')
      .select('*')
      .eq('condition_type', type)
      .lte('condition_value', currentValue);

    if (candidateError) throw candidateError;
    if (!candidates || candidates.length === 0) return [];

    const candidatesTyped = candidates as AchievementRow[];

    const { data: unlocked, error: unlockedError } = await getSupabaseAdmin()
      .from('user_achievements')
      .select('achievement_id')
      .eq('user_id', userId)
      .in('achievement_id', candidatesTyped.map((c) => c.id));

    if (unlockedError) throw unlockedError;

    const unlockedIds = new Set(
      (unlocked as Pick<UserAchievementRow, 'achievement_id'>[]).map((u) => u.achievement_id)
    );
    const newUnlocks = candidatesTyped.filter((c) => !unlockedIds.has(c.id));

    if (newUnlocks.length === 0) return [];

    // Transactional path
    if (transactionExecutor.isAvailable()) {
      try {
        await transactionExecutor.executeInTransaction(async (client) => {
          const now = new Date().toISOString();

          // INSERT user_achievements
          for (const ach of newUnlocks) {
            await client.query(
              `INSERT INTO user_achievements (user_id, achievement_id, unlocked_at) VALUES ($1, $2, $3)`,
              [userId, ach.id, now],
            );
          }

          // UPDATE users xp
          let totalXp = 0;
          for (const ach of newUnlocks) {
            totalXp += ach.xp_reward;
          }

          if (totalXp > 0) {
            const { rows: userRows } = await client.query(
              `SELECT xp, level FROM users WHERE id = $1`,
              [userId],
            );

            if (userRows.length > 0) {
              let { xp, level } = userRows[0];
              xp = (xp || 0) + totalXp;

              let nextLevelThreshold = level * 500;
              while (xp >= nextLevelThreshold) {
                xp -= nextLevelThreshold;
                level++;
                nextLevelThreshold = level * 500;
              }

              await client.query(
                `UPDATE users SET xp = $1, level = $2 WHERE id = $3`,
                [xp, level, userId],
              );
            }
          }
        });

        return newUnlocks;
      } catch (txError) {
        logger.warn('Transaction failed in checkAndUnlock, falling back to non-transactional operations', { error: txError });
      }
    } else {
      logger.warn('TransactionExecutor not available, using non-transactional path for checkAndUnlock');
    }

    // Non-transactional fallback
    const unlocksToInsert = newUnlocks.map((ach) => ({
      user_id: userId,
      achievement_id: ach.id,
      unlocked_at: new Date().toISOString()
    }));

    const { error: insertError } = await getSupabaseAdmin()
      .from('user_achievements')
      .insert(unlocksToInsert);

    if (insertError) throw insertError;

    let totalXp = 0;
    for (const ach of newUnlocks) {
      totalXp += ach.xp_reward;
    }

    if (totalXp > 0) {
      await this.addXp(userId, totalXp);
    }

    return newUnlocks;
  }

  async addXp(userId: string, amount: number): Promise<{ newLevel: number, newXp: number, levelUp: boolean }> {
    const { data: user, error: userError } = await getSupabaseAdmin()
      .from('users')
      .select('xp, level')
      .eq('id', userId)
      .single();

    if (userError) throw userError;

    let { xp, level } = user;
    xp = (xp || 0) + amount;

    let levelUp = false;
    let nextLevelThreshold = level * 500;

    while (xp >= nextLevelThreshold) {
      xp -= nextLevelThreshold;
      level++;
      levelUp = true;
      nextLevelThreshold = level * 500;
    }

    const { error: updateError } = await getSupabaseAdmin()
      .from('users')
      .update({ xp, level })
      .eq('id', userId);

    if (updateError) throw updateError;

    return { newLevel: level, newXp: xp, levelUp };
  }

  /** @deprecated Use event-driven approach via achievementEngine */
  async updateStudyStreak(userId: string): Promise<void> {
    const { data: sessions, error } = await getSupabaseAdmin()
      .from('focus_sessions')
      .select('started_at')
      .eq('user_id', userId)
      .eq('completed', true)
      .order('started_at', { ascending: false });

    if (error || !sessions) return;

    const sessionsTyped = sessions as Pick<FocusSessionRow, 'started_at'>[];
    const dates = new Set(sessionsTyped.map((s) => s.started_at.split('T')[0]));
    const sortedDates = Array.from(dates).sort(
      (a, b) => new Date(b).getTime() - new Date(a).getTime()
    );

    if (sortedDates.length === 0) return;

    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    if (sortedDates[0] !== today && sortedDates[0] !== yesterday) {
      return;
    }

    let streak = 0;
    const currentDate = new Date();
    const dateString = (d: Date) => d.toISOString().split('T')[0];

    if (!dates.has(dateString(currentDate)) && !dates.has(dateString(new Date(Date.now() - 86400000)))) {
      streak = 0;
    } else {
      const checkDate = new Date();
      if (!dates.has(dateString(checkDate))) {
        checkDate.setDate(checkDate.getDate() - 1);
      }

      while (dates.has(dateString(checkDate))) {
        streak++;
        checkDate.setDate(checkDate.getDate() - 1);
      }
    }

    await this.checkAndUnlock(userId, 'streak_days', streak);
  }

  /** @deprecated Use event-driven approach via achievementEngine */
  async updateFocusStats(userId: string): Promise<void> {
    const { error: _error } = await getSupabaseAdmin()
      .from('focus_sessions')
      .select('duration')
      .eq('user_id', userId)
      .eq('completed', true)
      .gte('started_at', new Date().toISOString().split('T')[0]);

    const today = new Date().toISOString().split('T')[0];
    const todaySessions = await getSupabaseAdmin()
      .from('focus_sessions')
      .select('duration')
      .eq('user_id', userId)
      .eq('completed', true)
      .gte('started_at', today);

    const todayMinutes =
      (todaySessions?.data as Pick<FocusSessionRow, 'duration'>[] | null)?.reduce(
        (acc, curr) => acc + (curr.duration || 0),
        0
      ) || 0;

    await this.updateDailyTaskProgress(userId, 'focus_time', todayMinutes);

    const { data: allSessions } = await getSupabaseAdmin()
      .from('focus_sessions')
      .select('duration')
      .eq('user_id', userId)
      .eq('completed', true);

    const totalMinutes = allSessions?.reduce((acc: number, curr: Pick<FocusSessionRow, 'duration'>) => acc + (curr.duration || 0), 0) || 0;
    await this.checkAndUnlock(userId, 'focus_minutes', totalMinutes);

    await periodicTaskService.updatePeriodicTaskProgress(userId, 'focus', totalMinutes);

    await this.updateStudyStreak(userId);
  }

  async updateDailyTaskProgress(userId: string, type: string, currentTotal: number): Promise<void> {
    const today = new Date().toISOString().split('T')[0];
    const { data: task } = await getSupabaseAdmin()
      .from('periodic_tasks')
      .select('*')
      .eq('user_id', userId)
      .eq('period_type', 'daily')
      .eq('period_start', today)
      .eq('task_type', type)
      .single();

    if (!task || task.status !== 'pending') return;

    if (currentTotal >= task.target) {
      await getSupabaseAdmin()
        .from('periodic_tasks')
        .update({ status: 'completed', progress: task.target, completed_at: new Date().toISOString() })
        .eq('id', task.id);
      await this.addXp(userId, task.xp_reward);
    } else {
      await getSupabaseAdmin()
        .from('periodic_tasks')
        .update({ progress: currentTotal })
        .eq('id', task.id);
    }
  }

  /** @deprecated Use event-driven approach via achievementEngine */
  async updateMasteredStats(userId: string): Promise<void> {
    const { count, error } = await getSupabaseAdmin()
      .from('study_cards')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gt('fsrs_stability', 21);

    if (!error) {
      await this.checkAndUnlock(userId, 'cards_mastered', count || 0);
      await periodicTaskService.updatePeriodicTaskProgress(userId, 'study', count || 0);
    }

    await this.updateDailyTask(userId, 'study_cards', 1);
  }

  /** @deprecated Use event-driven approach via achievementEngine */
  async updateCreationStats(userId: string): Promise<void> {
    const { count: graphCount, error: graphError } = await getSupabaseAdmin()
      .from('graphs')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    if (!graphError) {
      await this.checkAndUnlock(userId, 'graphs_created', graphCount || 0);
    }

    await this.updateDailyTask(userId, 'create_node', 1);

    const { count: nodeCount, error: nodeError } = await notDeleted(getSupabaseAdmin()
      .from('graph_nodes')
      .select('id, knowledge_graphs!inner(user_id)', { count: 'exact', head: true })
      .eq('knowledge_graphs.user_id', userId)
      );

    if (!nodeError) {
      await this.checkAndUnlock(userId, 'nodes_created', nodeCount || 0);
      await periodicTaskService.updatePeriodicTaskProgress(userId, 'create', nodeCount || 0);
    }
  }

  async getAllAchievements(): Promise<Achievement[]> {
    const { data, error } = await getSupabaseAdmin()
      .from('achievements')
      .select('*')
      .order('category')
      .order('condition_value');

    if (error) throw new Error(`Failed to fetch achievements: ${error.message}`);
    return data as Achievement[];
  }

  async getUserAchievements(userId: string): Promise<(UserAchievement & { achievement: Achievement })[]> {
    const { data, error } = await getSupabaseAdmin()
      .from('user_achievements')
      .select('*, achievement:achievements(*)')
      .eq('user_id', userId)
      .order('unlocked_at', { ascending: false });

    if (error) throw new Error(`Failed to fetch user achievements: ${error.message}`);
    return data as (UserAchievement & { achievement: Achievement })[];
  }

  /** @deprecated Use achievementEngine.evaluateAchievements() instead */
  async checkAndUnlockAchievements(userId: string): Promise<AchievementCheckResult> {
    const stats = await focusService.getUserFocusStats(getSupabaseAdmin(), userId);
    const allAchievements = await this.getAllAchievements();
    const userAchievements = await this.getUserAchievements(userId);
    const unlockedCodes = new Set(userAchievements.map(ua => ua.achievement.code));

    const unlocked: Achievement[] = [];
    const progress: AchievementCheckResult['progress'] = [];

    for (const achievement of allAchievements) {
      if (unlockedCodes.has(achievement.code)) continue;

      let current = 0;
      switch (achievement.condition_type) {
        case 'focus_sessions':
          current = stats.total_sessions;
          break;
        case 'total_focus_hours':
          current = Math.floor(stats.total_focus_seconds / 3600);
          break;
        case 'consecutive_days':
          current = stats.current_streak;
          break;
        case 'tasks_completed':
          current = stats.total_tasks_completed;
          break;
        case 'pomodoros_completed':
          current = stats.total_pomodoros;
          break;
        case 'daily_focus_hours': {
          const todayStats = await focusService.getDailyFocusStats(getSupabaseAdmin(), userId);
          current = Math.floor(todayStats.total_duration / 3600);
          break;
        }
        case 'streak_days': {
          const { data: streakSessions } = await getSupabaseAdmin()
            .from('focus_sessions')
            .select('started_at')
            .eq('user_id', userId)
            .eq('completed', true)
            .order('started_at', { ascending: false });
          if (streakSessions && streakSessions.length > 0) {
            const streakSessionsTyped = streakSessions as Pick<FocusSessionRow, 'started_at'>[];
            const streakDates = new Set(streakSessionsTyped.map((s) => s.started_at.split('T')[0]));
            const sortedStreakDates = Array.from(streakDates).sort(
              (a, b) => new Date(b).getTime() - new Date(a).getTime()
            );
            const todayStr = new Date().toISOString().split('T')[0];
            const yesterdayStr = new Date(Date.now() - 86400000).toISOString().split('T')[0];
            if (sortedStreakDates[0] === todayStr || sortedStreakDates[0] === yesterdayStr) {
              const checkDate = new Date();
              if (!streakDates.has(checkDate.toISOString().split('T')[0])) {
                checkDate.setDate(checkDate.getDate() - 1);
              }
              let streakCount = 0;
              while (streakDates.has(checkDate.toISOString().split('T')[0])) {
                streakCount++;
                checkDate.setDate(checkDate.getDate() - 1);
              }
              current = streakCount;
            }
          }
          break;
        }
        case 'focus_minutes':
          current = Math.floor(stats.total_focus_seconds / 60);
          break;
        case 'cards_mastered': {
          const { count: masteredCount } = await getSupabaseAdmin()
            .from('study_cards')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId)
            .gt('fsrs_stability', 21);
          current = masteredCount || 0;
          break;
        }
        case 'graphs_created': {
          const { count: graphCount } = await notDeleted(getSupabaseAdmin()
            .from('knowledge_graphs')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId)
            );
          current = graphCount || 0;
          break;
        }
        case 'nodes_created': {
          const { count: nodeCount } = await notDeleted(getSupabaseAdmin()
            .from('graph_nodes')
            .select('id, knowledge_graphs!inner(user_id)', { count: 'exact', head: true })
            .eq('knowledge_graphs.user_id', userId)
            );
          current = nodeCount || 0;
          break;
        }
        case 'weekly_streak':
        case 'monthly_streak':
        case 'quarterly_streak':
        case 'daily_task_streak': {
          const { data: focusStatsRow } = await getSupabaseAdmin()
            .from('user_focus_stats')
            .select('weekly_streak, monthly_streak, quarterly_streak, daily_task_streak')
            .eq('user_id', userId)
            .single();
          if (focusStatsRow) {
            switch (achievement.condition_type) {
              case 'weekly_streak':
                current = focusStatsRow.weekly_streak || 0;
                break;
              case 'monthly_streak':
                current = focusStatsRow.monthly_streak || 0;
                break;
              case 'quarterly_streak':
                current = focusStatsRow.quarterly_streak || 0;
                break;
              case 'daily_task_streak':
                current = focusStatsRow.daily_task_streak || 0;
                break;
            }
          }
          break;
        }
        case 'special_condition':
          continue;
        default:
          logger.warn('Unrecognized achievement condition_type', { condition_type: achievement.condition_type, achievement_code: achievement.code });
          continue;
      }

      const percentage = Math.min(100, Math.round((current / achievement.condition_value) * 100));

      if (current >= achievement.condition_value) {
        const { error: insertError } = await getSupabaseAdmin()
          .from('user_achievements')
          .insert({
            user_id: userId,
            achievement_id: achievement.id,
            progress: 100,
            metadata: { unlocked_value: current },
          });

        if (!insertError) {
          unlocked.push(achievement);
        }
      } else {
        progress.push({
          achievement,
          current,
          target: achievement.condition_value,
          percentage,
        });
      }
    }

    return { unlocked, progress };
  }

  async checkPerfectionist(userId: string): Promise<void> {
    const today = new Date().toISOString().split('T')[0];
    const { data: tasks } = await getSupabaseAdmin()
      .from('periodic_tasks')
      .select('status')
      .eq('user_id', userId)
      .eq('period_type', 'daily')
      .eq('period_start', today);

    if (!tasks || tasks.length === 0) return;

    const allCompleted = tasks.every((t: Pick<PeriodicTaskRow, 'status'>) => t.status === 'completed');
    if (!allCompleted) return;

    const achievement = await this.unlockSpecialAchievement(userId, 'perfectionist');
    if (achievement && achievement.xp_reward) {
      await this.addXp(userId, achievement.xp_reward);
    }
  }

  async checkMultitasker(userId: string): Promise<void> {
    const today = new Date().toISOString().split('T')[0];
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
    const { data: tasks } = await getSupabaseAdmin()
      .from('user_tasks')
      .select('task_type')
      .eq('user_id', userId)
      .gte('completed_at', today)
      .lt('completed_at', tomorrow);

    if (!tasks) return;

    const tasksTyped = tasks as Pick<UserTaskRow, 'task_type'>[];
    const distinctTypes = new Set(tasksTyped.map((t) => t.task_type));
    if (distinctTypes.size >= 5) {
      await this.unlockSpecialAchievement(userId, 'multitasker');
    }
  }

  async checkSpecialAchievements(userId: string, session: FocusSession): Promise<Achievement[]> {
    const unlocked: Achievement[] = [];
    const userAchievements = await this.getUserAchievements(userId);
    const unlockedCodes = new Set(userAchievements.map(ua => ua.achievement.code));

    const sessionHour = new Date(session.started_at).getHours();

    if (!unlockedCodes.has('night_owl') && sessionHour >= 0 && sessionHour < 5) {
      const achievement = await this.unlockSpecialAchievement(userId, 'night_owl');
      if (achievement) unlocked.push(achievement);
    }

    if (!unlockedCodes.has('early_bird') && sessionHour >= 5 && sessionHour < 7) {
      const achievement = await this.unlockSpecialAchievement(userId, 'early_bird');
      if (achievement) unlocked.push(achievement);
    }

    const dayOfWeek = new Date(session.started_at).getDay();
    if (!unlockedCodes.has('weekend_warrior') && (dayOfWeek === 0 || dayOfWeek === 6)) {
      const dailyStats = await focusService.getDailyFocusStats(getSupabaseAdmin(), userId);
      if (dailyStats.total_duration >= 4 * 3600) {
        const achievement = await this.unlockSpecialAchievement(userId, 'weekend_warrior');
        if (achievement) unlocked.push(achievement);
      }
    }

    return unlocked;
  }

  private async unlockSpecialAchievement(userId: string, code: string): Promise<Achievement | null> {
    const { data: achievement, error: achievementError } = await getSupabaseAdmin()
      .from('achievements')
      .select('*')
      .eq('code', code)
      .single();

    if (achievementError || !achievement) return null;

    const { error: insertError } = await getSupabaseAdmin()
      .from('user_achievements')
      .insert({
        user_id: userId,
        achievement_id: achievement.id,
        progress: 100,
        metadata: { unlocked_at: new Date().toISOString() },
      });

    if (insertError) return null;
    return achievement as Achievement;
  }
}

export const achievementService = new AchievementService();

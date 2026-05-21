import { getSupabaseAdmin } from '../supabase';
import { periodicTaskService } from './scheduler/periodicTaskService';
import { focusService } from './scheduler/focusService';
import type {
  Achievement,
  UserAchievement,
  AchievementCheckResult,
  FocusSession,
} from '@shared/types/scheduler';

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

  async getDailyTasks(userId: string): Promise<any[]> {
    await this.initDailyTasks(userId);

    const today = new Date().toISOString().split('T')[0];
    const { data } = await getSupabaseAdmin()
      .from('periodic_tasks')
      .select('*')
      .eq('user_id', userId)
      .eq('period_type', 'daily')
      .eq('period_start', today)
      .order('created_at');

    return data || [];
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
    const updates: any = { progress: newProgress };

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

    const unlockedMap = new Map(userAchievements.map((ua: any) => [ua.achievement_id, ua.unlocked_at]));

    return allAchievements.map((ach: any) => ({
      ...ach,
      unlocked_at: unlockedMap.get(ach.id) || null
    }));
  }

  async checkAndUnlock(userId: string, type: string, currentValue: number): Promise<Achievement[]> {
    const { data: candidates, error: candidateError } = await getSupabaseAdmin()
      .from('achievements')
      .select('*')
      .eq('condition_type', type)
      .lte('condition_value', currentValue);

    if (candidateError) throw candidateError;
    if (!candidates || candidates.length === 0) return [];

    const { data: unlocked, error: unlockedError } = await getSupabaseAdmin()
      .from('user_achievements')
      .select('achievement_id')
      .eq('user_id', userId)
      .in('achievement_id', candidates.map((c: any) => c.id));

    if (unlockedError) throw unlockedError;

    const unlockedIds = new Set(unlocked.map((u: any) => u.achievement_id));
    const newUnlocks = candidates.filter((c: any) => !unlockedIds.has(c.id));

    if (newUnlocks.length === 0) return [];

    const unlocksToInsert = newUnlocks.map((ach: any) => ({
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

  async updateStudyStreak(userId: string): Promise<void> {
    const { data: sessions, error } = await getSupabaseAdmin()
      .from('focus_sessions')
      .select('start_time')
      .eq('user_id', userId)
      .eq('completed', true)
      .order('start_time', { ascending: false });

    if (error || !sessions) return;

    const dates = new Set(sessions.map((s: any) => s.start_time.split('T')[0]));
    const sortedDates = Array.from(dates).sort((a: any, b: any) => new Date(b).getTime() - new Date(a).getTime());

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

  async updateFocusStats(userId: string): Promise<void> {
    const { error: _error } = await getSupabaseAdmin()
      .from('focus_sessions')
      .select('duration')
      .eq('user_id', userId)
      .eq('completed', true)
      .gte('start_time', new Date().toISOString().split('T')[0]);

    const today = new Date().toISOString().split('T')[0];
    const { data: todaySessions } = await getSupabaseAdmin()
      .from('focus_sessions')
      .select('duration')
      .eq('user_id', userId)
      .eq('completed', true)
      .gte('start_time', today);

    const todayMinutes = todaySessions?.reduce((acc: number, curr: any) => acc + curr.duration, 0) || 0;

    await this.updateDailyTaskProgress(userId, 'focus_time', todayMinutes);

    const { data: allSessions } = await getSupabaseAdmin()
      .from('focus_sessions')
      .select('duration')
      .eq('user_id', userId)
      .eq('completed', true);

    const totalMinutes = allSessions?.reduce((acc: number, curr: any) => acc + curr.duration, 0) || 0;
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

  async updateCreationStats(userId: string): Promise<void> {
    const { count: graphCount, error: graphError } = await getSupabaseAdmin()
      .from('graphs')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    if (!graphError) {
      await this.checkAndUnlock(userId, 'graphs_created', graphCount || 0);
    }

    await this.updateDailyTask(userId, 'create_node', 1);

    const { count: nodeCount, error: nodeError } = await getSupabaseAdmin()
      .from('graph_nodes')
      .select('id, knowledge_graphs!inner(user_id)', { count: 'exact', head: true })
      .eq('knowledge_graphs.user_id', userId)
      .is('deleted_at', null);

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
        default:
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

import { supabaseAdmin } from '../../supabase';
import { SupabaseClient } from '@supabase/supabase-js';
import { AppError } from '../../middleware/errorHandler';
import { ErrorCodes } from '../../../shared/types/errorCodes';
import { logger } from '../../utils/logger';

export interface PeriodicTask {
  id: string;
  user_id: string;
  period_type: 'weekly' | 'monthly' | 'quarterly';
  period_start: string;
  period_end: string;
  task_type: 'focus' | 'study' | 'create' | 'tasks';
  target: number;
  progress: number;
  status: 'pending' | 'completed';
  xp_reward: number;
  pass_points: number;
  created_at: string;
  updated_at: string;
}

export interface PeriodicPass {
  id: string;
  user_id: string;
  period_type: 'weekly' | 'monthly' | 'quarterly';
  period_start: string;
  period_end: string;
  total_points: number;
  current_level: number;
  created_at: string;
  updated_at: string;
}

export interface PassReward {
  id: string;
  period_type: 'weekly' | 'monthly' | 'quarterly';
  level: number;
  points_required: number;
  reward_type: 'xp' | 'achievement' | 'badge';
  reward_value: number | null;
  achievement_code: string | null;
  name: string;
  description: string | null;
  icon: string;
}

export interface UserPassProgress {
  id: string;
  user_id: string;
  pass_id: string;
  level: number;
  claimed: boolean;
  claimed_at: string | null;
}

const PERIODIC_TASK_CONFIGS = {
  weekly: {
    focus: { target: 600, xp_reward: 100, pass_points: 10 },
    study: { target: 100, xp_reward: 80, pass_points: 10 },
    create: { target: 10, xp_reward: 60, pass_points: 10 },
    tasks: { target: 15, xp_reward: 80, pass_points: 10 },
  },
  monthly: {
    focus: { target: 2400, xp_reward: 300, pass_points: 20 },
    study: { target: 400, xp_reward: 200, pass_points: 20 },
    create: { target: 50, xp_reward: 150, pass_points: 20 },
    tasks: { target: 60, xp_reward: 200, pass_points: 20 },
  },
  quarterly: {
    focus: { target: 7200, xp_reward: 800, pass_points: 40 },
    study: { target: 1200, xp_reward: 500, pass_points: 40 },
    create: { target: 150, xp_reward: 400, pass_points: 40 },
    tasks: { target: 180, xp_reward: 500, pass_points: 40 },
  },
};

function getPeriodDates(periodType: 'weekly' | 'monthly' | 'quarterly'): { start: string; end: string } {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  switch (periodType) {
    case 'weekly': {
      const dayOfWeek = today.getDay();
      const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      const start = new Date(today);
      start.setDate(today.getDate() - diff);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      return {
        start: start.toISOString().split('T')[0],
        end: end.toISOString().split('T')[0],
      };
    }
    case 'monthly': {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      return {
        start: start.toISOString().split('T')[0],
        end: end.toISOString().split('T')[0],
      };
    }
    case 'quarterly': {
      const quarter = Math.floor(today.getMonth() / 3);
      const start = new Date(today.getFullYear(), quarter * 3, 1);
      const end = new Date(today.getFullYear(), quarter * 3 + 3, 0);
      return {
        start: start.toISOString().split('T')[0],
        end: end.toISOString().split('T')[0],
      };
    }
  }
}

export class PeriodicTaskService {
  async initPeriodicTasks(userId: string): Promise<void> {
    const periodTypes: ('weekly' | 'monthly' | 'quarterly')[] = ['weekly', 'monthly', 'quarterly'];

    for (const periodType of periodTypes) {
      const { start, end } = getPeriodDates(periodType);

      const { count, error: countError } = await supabaseAdmin
        .from('periodic_tasks')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('period_type', periodType)
        .eq('period_start', start);

      if (countError || (count && count > 0)) continue;

      const config = PERIODIC_TASK_CONFIGS[periodType];
      const tasks = [
        {
          user_id: userId,
          period_type: periodType,
          period_start: start,
          period_end: end,
          task_type: 'focus',
          target: config.focus.target,
          xp_reward: config.focus.xp_reward,
          pass_points: config.focus.pass_points,
        },
        {
          user_id: userId,
          period_type: periodType,
          period_start: start,
          period_end: end,
          task_type: 'study',
          target: config.study.target,
          xp_reward: config.study.xp_reward,
          pass_points: config.study.pass_points,
        },
        {
          user_id: userId,
          period_type: periodType,
          period_start: start,
          period_end: end,
          task_type: 'create',
          target: config.create.target,
          xp_reward: config.create.xp_reward,
          pass_points: config.create.pass_points,
        },
        {
          user_id: userId,
          period_type: periodType,
          period_start: start,
          period_end: end,
          task_type: 'tasks',
          target: config.tasks.target,
          xp_reward: config.tasks.xp_reward,
          pass_points: config.tasks.pass_points,
        },
      ];

      await supabaseAdmin.from('periodic_tasks').upsert(tasks, {
        onConflict: 'user_id,period_type,period_start,task_type',
        ignoreDuplicates: true,
      });

      await this.initPass(userId, periodType, start, end);
    }
  }

  async initPass(userId: string, periodType: 'weekly' | 'monthly' | 'quarterly', start: string, end: string): Promise<void> {
    const { error } = await supabaseAdmin
      .from('periodic_passes')
      .insert({
        user_id: userId,
        period_type: periodType,
        period_start: start,
        period_end: end,
        total_points: 0,
        current_level: 0,
      });

    if (error && !error.message.includes('duplicate')) {
      logger.error('Error initializing pass:', error);
    }
  }

  async getPeriodicTasks(userId: string): Promise<PeriodicTask[]> {
    await this.initPeriodicTasks(userId);

    const { data, error } = await supabaseAdmin
      .from('periodic_tasks')
      .select('*')
      .eq('user_id', userId)
      .order('period_type')
      .order('task_type');

    if (error) throw new AppError(ErrorCodes.SCHEDULER_TASK_EXECUTION_FAILED, { details: { originalError: error.message } });
    return data || [];
  }

  async updatePeriodicTaskProgress(
    userId: string,
    taskType: 'focus' | 'study' | 'create' | 'tasks',
    currentValue: number
  ): Promise<PeriodicTask[]> {
    const periodTypes: ('weekly' | 'monthly' | 'quarterly')[] = ['weekly', 'monthly', 'quarterly'];
    const completedTasks: PeriodicTask[] = [];

    for (const periodType of periodTypes) {
      const { start } = getPeriodDates(periodType);

      const { data: task } = await supabaseAdmin
        .from('periodic_tasks')
        .select('*')
        .eq('user_id', userId)
        .eq('period_type', periodType)
        .eq('task_type', taskType)
        .eq('period_start', start)
        .single();

      if (!task || task.status === 'completed') continue;

      const newProgress = Math.min(currentValue, task.target);
      const updates: any = { progress: newProgress };

      if (newProgress >= task.target) {
        updates.status = 'completed';

        const { data: currentPass } = await supabaseAdmin
          .from('periodic_passes')
          .select('total_points')
          .eq('user_id', userId)
          .eq('period_type', periodType)
          .eq('period_start', start)
          .single();

        if (currentPass) {
          await supabaseAdmin
            .from('periodic_passes')
            .update({ total_points: currentPass.total_points + task.pass_points })
            .eq('user_id', userId)
            .eq('period_type', periodType)
            .eq('period_start', start);
        }

        completedTasks.push(task);
      }

      await supabaseAdmin
        .from('periodic_tasks')
        .update(updates)
        .eq('id', task.id);
    }

    return completedTasks;
  }

  async getPassProgress(userId: string): Promise<{
    weekly: PeriodicPass | null;
    monthly: PeriodicPass | null;
    quarterly: PeriodicPass | null;
    rewards: PassReward[];
    userProgress: UserPassProgress[];
  }> {
    await this.initPeriodicTasks(userId);

    const result: any = {
      weekly: null,
      monthly: null,
      quarterly: null,
      rewards: [],
      userProgress: [],
    };

    for (const periodType of ['weekly', 'monthly', 'quarterly'] as const) {
      const { start } = getPeriodDates(periodType);

      const { data: pass } = await supabaseAdmin
        .from('periodic_passes')
        .select('*')
        .eq('user_id', userId)
        .eq('period_type', periodType)
        .eq('period_start', start)
        .single();

      result[periodType] = pass;
    }

    const { data: rewards } = await supabaseAdmin
      .from('pass_rewards')
      .select('*')
      .order('period_type')
      .order('level');

    result.rewards = rewards || [];

    const passIds = [result.weekly?.id, result.monthly?.id, result.quarterly?.id].filter(Boolean);

    if (passIds.length > 0) {
      const { data: progress } = await supabaseAdmin
        .from('user_pass_progress')
        .select('*')
        .in('pass_id', passIds);

      result.userProgress = progress || [];
    }

    return result;
  }

  async claimPassReward(
    userId: string,
    passId: string,
    level: number
  ): Promise<{ success: boolean; reward: PassReward | null; message: string }> {
    const { data: pass } = await supabaseAdmin
      .from('periodic_passes')
      .select('*')
      .eq('id', passId)
      .eq('user_id', userId)
      .single();

    if (!pass) {
      return { success: false, reward: null, message: '通行证不存在' };
    }

    const { data: reward } = await supabaseAdmin
      .from('pass_rewards')
      .select('*')
      .eq('period_type', pass.period_type)
      .eq('level', level)
      .single();

    if (!reward) {
      return { success: false, reward: null, message: '奖励不存在' };
    }

    if (pass.total_points < reward.points_required) {
      return { success: false, reward: null, message: '积分不足' };
    }

    const { data: existingProgress } = await supabaseAdmin
      .from('user_pass_progress')
      .select('*')
      .eq('pass_id', passId)
      .eq('level', level)
      .single();

    if (existingProgress?.claimed) {
      return { success: false, reward: null, message: '奖励已领取' };
    }

    await supabaseAdmin
      .from('user_pass_progress')
      .upsert({
        user_id: userId,
        pass_id: passId,
        level,
        claimed: true,
        claimed_at: new Date().toISOString(),
      }, { onConflict: 'user_id,pass_id,level' });

    if (reward.reward_type === 'xp' && reward.reward_value) {
      const { data: user } = await supabaseAdmin
        .from('users')
        .select('xp, level')
        .eq('id', userId)
        .single();

      if (user) {
        let xp = (user.xp || 0) + reward.reward_value;
        let level = user.level;
        let nextLevelThreshold = level * 500;

        while (xp >= nextLevelThreshold) {
          xp -= nextLevelThreshold;
          level++;
          nextLevelThreshold = level * 500;
        }

        await supabaseAdmin
          .from('users')
          .update({ xp, level })
          .eq('id', userId);
      }
    }

    if (pass.current_level < level) {
      await supabaseAdmin
        .from('periodic_passes')
        .update({ current_level: level })
        .eq('id', passId);
    }

    return { success: true, reward, message: '奖励领取成功' };
  }

  async checkDailyTaskStreak(userId: string): Promise<{ streak: number; bonusAwarded: number }> {
    const today = new Date().toISOString().split('T')[0];

    const { data: dailyTasks } = await supabaseAdmin
      .from('daily_tasks')
      .select('*')
      .eq('user_id', userId)
      .eq('task_date', today);

    if (!dailyTasks || dailyTasks.length === 0) {
      return { streak: 0, bonusAwarded: 0 };
    }

    const allCompleted = dailyTasks.every((t: any) => t.status === 'completed');
    if (!allCompleted) {
      return { streak: 0, bonusAwarded: 0 };
    }

    const { data: stats } = await supabaseAdmin
      .from('user_focus_stats')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (!stats) {
      await supabaseAdmin
        .from('user_focus_stats')
        .insert({
          user_id: userId,
          daily_task_streak: 1,
          last_daily_completion: today,
        });
      return { streak: 1, bonusAwarded: 0 };
    }

    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    let newStreak = 1;

    if (stats.last_daily_completion === yesterday) {
      newStreak = (stats.daily_task_streak || 0) + 1;
    }

    let bonusAwarded = 0;
    const streakMilestones: Record<number, number> = {
      7: 50,
      14: 100,
      30: 300,
      60: 600,
      100: 1000,
    };

    if (streakMilestones[newStreak]) {
      bonusAwarded = streakMilestones[newStreak];
      await this.awardXp(userId, bonusAwarded);
      await this.checkAndUnlockAchievement(userId, 'daily_task_streak', newStreak);
    }

    await supabaseAdmin
      .from('user_focus_stats')
      .update({
        daily_task_streak: newStreak,
        last_daily_completion: today,
      })
      .eq('user_id', userId);

    return { streak: newStreak, bonusAwarded };
  }

  async checkPeriodicStreak(userId: string): Promise<void> {
    const periodTypes: ('weekly' | 'monthly' | 'quarterly')[] = ['weekly', 'monthly', 'quarterly'];

    for (const periodType of periodTypes) {
      const { start, end } = getPeriodDates(periodType);
      const today = new Date().toISOString().split('T')[0];

      if (today !== end) continue;

      const { data: tasks } = await supabaseAdmin
        .from('periodic_tasks')
        .select('*')
        .eq('user_id', userId)
        .eq('period_type', periodType)
        .eq('period_start', start);

      if (!tasks || tasks.length === 0) continue;

      const allCompleted = tasks.every((t: any) => t.status === 'completed');

      const { data: stats } = await supabaseAdmin
        .from('user_focus_stats')
        .select('*')
        .eq('user_id', userId)
        .single();

      const streakColumn = `${periodType}_streak` as keyof typeof stats;

      if (allCompleted) {
        const newStreak = ((stats?.[streakColumn] as number) || 0) + 1;

        await supabaseAdmin
          .from('user_focus_stats')
          .update({ [streakColumn]: newStreak })
          .eq('user_id', userId);

        await this.checkAndUnlockAchievement(userId, `${periodType}_streak` as any, newStreak);
      } else {
        await supabaseAdmin
          .from('user_focus_stats')
          .update({ [streakColumn]: 0 })
          .eq('user_id', userId);
      }
    }
  }

  private async awardXp(userId: string, amount: number): Promise<void> {
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('xp, level')
      .eq('id', userId)
      .single();

    if (!user) return;

    let xp = (user.xp || 0) + amount;
    let level = user.level;
    let nextLevelThreshold = level * 500;

    while (xp >= nextLevelThreshold) {
      xp -= nextLevelThreshold;
      level++;
      nextLevelThreshold = level * 500;
    }

    await supabaseAdmin
      .from('users')
      .update({ xp, level })
      .eq('id', userId);
  }

  private async checkAndUnlockAchievement(userId: string, conditionType: string, value: number): Promise<void> {
    const { data: achievements } = await supabaseAdmin
      .from('achievements')
      .select('*')
      .eq('condition_type', conditionType)
      .lte('condition_value', value);

    if (!achievements || achievements.length === 0) return;

    const { data: unlocked } = await supabaseAdmin
      .from('user_achievements')
      .select('achievement_id')
      .eq('user_id', userId)
      .in('achievement_id', achievements.map((a: any) => a.id));

    const unlockedIds = new Set(unlocked?.map((u: any) => u.achievement_id) || []);
    const newUnlocks = achievements.filter((a: any) => !unlockedIds.has(a.id));

    for (const achievement of newUnlocks) {
      await supabaseAdmin
        .from('user_achievements')
        .insert({
          user_id: userId,
          achievement_id: achievement.id,
          unlocked_at: new Date().toISOString(),
        });

      if (achievement.xp_reward) {
        await this.awardXp(userId, achievement.xp_reward);
      }
    }
  }

  async aggregateAllProgress(supabase: SupabaseClient): Promise<void> {
    const periodTypes: ('weekly' | 'monthly' | 'quarterly')[] = ['weekly', 'monthly', 'quarterly'];

    const { data: users, error } = await supabase
      .from('users')
      .select('id');

    if (error || !users) {
      logger.error('[PeriodicTaskService] Failed to fetch users for aggregation:', error);
      return;
    }

    for (const user of users) {
      try {
        for (const periodType of periodTypes) {
          const { start } = getPeriodDates(periodType);

          const { data: tasks } = await supabase
            .from('periodic_tasks')
            .select('id, task_type, target, progress, status, pass_points')
            .eq('user_id', user.id)
            .eq('period_type', periodType)
            .eq('period_start', start);

          if (!tasks) continue;

          for (const task of tasks) {
            if (task.status === 'completed') continue;

            let currentValue = task.progress;

            switch (task.task_type) {
              case 'focus': {
                const { data: focusStats } = await supabase
                  .from('focus_sessions')
                  .select('duration')
                  .eq('user_id', user.id)
                  .gte('started_at', `${start}T00:00:00`)
                  .is('ended_at', null)
                  .limit(1);

                if (focusStats && focusStats.length > 0) {
                  const totalMinutes = focusStats.reduce((sum: number, s: { duration?: number }) => sum + (s.duration ?? 0), 0) / 60;
                  currentValue = Math.round(totalMinutes);
                }
                break;
              }
              case 'study': {
                const { count: studyCount } = await supabase
                  .from('study_cards')
                  .select('*', { count: 'exact', head: true })
                  .eq('user_id', user.id)
                  .gte('created_at', `${start}T00:00:00`);
                currentValue = studyCount ?? 0;
                break;
              }
              case 'create': {
                const { count: createCount } = await supabase
                  .from('knowledge_points')
                  .select('*', { count: 'exact', head: true })
                  .eq('owner_id', user.id)
                  .gte('created_at', `${start}T00:00:00`);
                currentValue = createCount ?? 0;
                break;
              }
              case 'tasks': {
                const { count: taskCount } = await supabase
                  .from('scheduled_tasks')
                  .select('*', { count: 'exact', head: true })
                  .eq('user_id', user.id)
                  .eq('status', 'completed')
                  .gte('completed_at', `${start}T00:00:00`)
                  .is('deleted_at', null);
                currentValue = taskCount ?? 0;
                break;
              }
            }

            if (currentValue !== task.progress) {
              const newProgress = Math.min(currentValue, task.target);
              const updates: Record<string, unknown> = { progress: newProgress };

              if (newProgress >= task.target) {
                updates.status = 'completed';

                const { data: currentPass } = await supabase
                  .from('periodic_passes')
                  .select('total_points')
                  .eq('user_id', user.id)
                  .eq('period_type', periodType)
                  .eq('period_start', start)
                  .single();

                if (currentPass) {
                  await supabase
                    .from('periodic_passes')
                    .update({ total_points: currentPass.total_points + task.pass_points })
                    .eq('user_id', user.id)
                    .eq('period_type', periodType)
                    .eq('period_start', start);
                }
              }

              await supabase
                .from('periodic_tasks')
                .update(updates)
                .eq('id', task.id);
            }
          }
        }
      } catch (error) {
        logger.error(`[PeriodicTaskService] Failed to aggregate progress for user ${user.id}:`, error);
      }
    }
  }
}

export const periodicTaskService = new PeriodicTaskService();

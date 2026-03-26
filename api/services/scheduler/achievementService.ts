import { SupabaseClient } from '@supabase/supabase-js';
import { focusService } from './focusService';

export interface Achievement {
  id: string;
  code: string;
  name: string;
  description: string;
  category: 'focus' | 'tasks' | 'streak' | 'special';
  icon: string;
  color: string;
  xp_reward: number;
  condition_type: string;
  condition_value: number;
  is_hidden: boolean;
  created_at: string;
}

export interface UserAchievement {
  id: string;
  user_id: string;
  achievement_id: string;
  achievement?: Achievement;
  unlocked_at: string;
  progress: number;
  metadata: Record<string, unknown>;
}

export interface AchievementCheckResult {
  unlocked: Achievement[];
  progress: Array<{
    achievement: Achievement;
    current: number;
    target: number;
    percentage: number;
  }>;
}

export interface FocusSession {
  id: string;
  user_id: string;
  task_id?: string;
  started_at: string;
  ended_at?: string;
  duration?: number;
  pomodoro_count: number;
  white_noise_type?: string;
  is_break: boolean;
  created_at: string;
}

export class AchievementService {
  constructor(private focusSvc: typeof focusService) {}

  async getAllAchievements(client: SupabaseClient): Promise<Achievement[]> {
    const { data, error } = await client
      .from('achievements')
      .select('*')
      .order('category')
      .order('condition_value');

    if (error) throw new Error(`Failed to fetch achievements: ${error.message}`);
    return data as Achievement[];
  }

  async getUserAchievements(
    client: SupabaseClient,
    userId: string
  ): Promise<(UserAchievement & { achievement: Achievement })[]> {
    const { data, error } = await client
      .from('user_achievements')
      .select('*, achievement:achievements(*)')
      .eq('user_id', userId)
      .order('unlocked_at', { ascending: false });

    if (error) throw new Error(`Failed to fetch user achievements: ${error.message}`);
    return data as (UserAchievement & { achievement: Achievement })[];
  }

  async checkAndUnlockAchievements(
    client: SupabaseClient,
    userId: string
  ): Promise<AchievementCheckResult> {
    const stats = await this.focusSvc.getUserFocusStats(client, userId);
    const allAchievements = await this.getAllAchievements(client);
    const userAchievements = await this.getUserAchievements(client, userId);
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
          const todayStats = await this.focusSvc.getDailyFocusStats(client, userId);
          current = Math.floor(todayStats.total_duration / 3600);
          break;
        }
        default:
          continue;
      }

      const percentage = Math.min(100, Math.round((current / achievement.condition_value) * 100));

      if (current >= achievement.condition_value) {
        const { error: insertError } = await client
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

  async checkSpecialAchievements(
    client: SupabaseClient,
    userId: string,
    session: FocusSession
  ): Promise<Achievement[]> {
    const unlocked: Achievement[] = [];
    const userAchievements = await this.getUserAchievements(client, userId);
    const unlockedCodes = new Set(userAchievements.map(ua => ua.achievement.code));

    const sessionHour = new Date(session.started_at).getHours();

    if (!unlockedCodes.has('night_owl') && sessionHour >= 0 && sessionHour < 5) {
      const achievement = await this.unlockSpecialAchievement(client, userId, 'night_owl');
      if (achievement) unlocked.push(achievement);
    }

    if (!unlockedCodes.has('early_bird') && sessionHour >= 5 && sessionHour < 7) {
      const achievement = await this.unlockSpecialAchievement(client, userId, 'early_bird');
      if (achievement) unlocked.push(achievement);
    }

    const dayOfWeek = new Date(session.started_at).getDay();
    if (!unlockedCodes.has('weekend_warrior') && (dayOfWeek === 0 || dayOfWeek === 6)) {
      const dailyStats = await this.focusSvc.getDailyFocusStats(client, userId);
      if (dailyStats.total_duration >= 4 * 3600) {
        const achievement = await this.unlockSpecialAchievement(client, userId, 'weekend_warrior');
        if (achievement) unlocked.push(achievement);
      }
    }

    return unlocked;
  }

  private async unlockSpecialAchievement(
    client: SupabaseClient,
    userId: string,
    code: string
  ): Promise<Achievement | null> {
    const { data: achievement, error: achievementError } = await client
      .from('achievements')
      .select('*')
      .eq('code', code)
      .single();

    if (achievementError || !achievement) return null;

    const { error: insertError } = await client
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

export const achievementService = new AchievementService(focusService);

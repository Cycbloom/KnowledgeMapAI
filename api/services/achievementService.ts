import { supabaseAdmin } from '../supabase.js';
import { periodicTaskService } from './scheduler/periodicTaskService.js';

export interface Achievement {
  id: string;
  code: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  xp_reward: number;
  condition_type: string;
  condition_value: number;
  unlocked_at?: string;
}

export class AchievementService {
  /**
   * Initialize daily tasks for a user
   */
  async initDailyTasks(userId: string): Promise<void> {
    const today = new Date().toISOString().split('T')[0];
    
    // Check if tasks exist for today
    const { count, error } = await supabaseAdmin
      .from('daily_tasks')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('task_date', today);
      
    if (error || (count && count > 0)) return;

    // Create default daily tasks
    const tasks = [
      { user_id: userId, task_date: today, task_type: 'login', target: 1, xp_reward: 20 },
      { user_id: userId, task_date: today, task_type: 'study_cards', target: 10, xp_reward: 50 },
      { user_id: userId, task_date: today, task_type: 'focus_time', target: 25, xp_reward: 50 },
      { user_id: userId, task_date: today, task_type: 'create_node', target: 1, xp_reward: 30 }
    ];

    await supabaseAdmin.from('daily_tasks').insert(tasks);
  }

  /**
   * Get daily tasks
   */
  async getDailyTasks(userId: string): Promise<any[]> {
    await this.initDailyTasks(userId);
    
    const today = new Date().toISOString().split('T')[0];
    const { data } = await supabaseAdmin
      .from('daily_tasks')
      .select('*')
      .eq('user_id', userId)
      .eq('task_date', today)
      .order('created_at');
      
    return data || [];
  }

  /**
   * Update daily task progress
   */
  async updateDailyTask(userId: string, type: string, amount: number = 1): Promise<void> {
    const today = new Date().toISOString().split('T')[0];
    
    // Get task
    const { data: task } = await supabaseAdmin
      .from('daily_tasks')
      .select('*')
      .eq('user_id', userId)
      .eq('task_date', today)
      .eq('task_type', type)
      .single();
      
    if (!task || task.status !== 'pending') return;

    const newProgress = Math.min(task.progress + amount, task.target);
    const updates: any = { progress: newProgress };
    
    if (newProgress >= task.target) {
      updates.status = 'completed';
      updates.completed_at = new Date().toISOString();
      // Auto claim for now or let user claim? Let's auto claim XP for simplicity or separate claim step.
      // For now, let's just mark completed.
    }

    await supabaseAdmin
      .from('daily_tasks')
      .update(updates)
      .eq('id', task.id);
      
    if (updates.status === 'completed') {
      await this.addXp(userId, task.xp_reward);
    }
  }

  /**
   * Get all achievements with user unlock status
   */
  async getAchievements(userId: string): Promise<Achievement[]> {
    // 1. Get all achievements
    const { data: allAchievements, error: fetchError } = await supabaseAdmin
      .from('achievements')
      .select('*')
      .order('condition_value', { ascending: true });

    if (fetchError) throw fetchError;

    // 2. Get user's unlocked achievements
    const { data: userAchievements, error: userError } = await supabaseAdmin
      .from('user_achievements')
      .select('achievement_id, unlocked_at')
      .eq('user_id', userId);

    if (userError) throw userError;

    // 3. Merge
    const unlockedMap = new Map(userAchievements.map((ua: any) => [ua.achievement_id, ua.unlocked_at]));

    return allAchievements.map((ach: any) => ({
      ...ach,
      unlocked_at: unlockedMap.get(ach.id) || null
    }));
  }

  /**
   * Check if any achievements should be unlocked based on current stats
   */
  async checkAndUnlock(userId: string, type: string, currentValue: number): Promise<Achievement[]> {
    // 1. Find potential achievements of this type that are NOT yet unlocked
    const { data: candidates, error: candidateError } = await supabaseAdmin
      .from('achievements')
      .select('*')
      .eq('condition_type', type)
      .lte('condition_value', currentValue); // condition_value <= currentValue

    if (candidateError) throw candidateError;
    if (!candidates || candidates.length === 0) return [];

    // 2. Filter out already unlocked ones
    const { data: unlocked, error: unlockedError } = await supabaseAdmin
      .from('user_achievements')
      .select('achievement_id')
      .eq('user_id', userId)
      .in('achievement_id', candidates.map((c: any) => c.id));

    if (unlockedError) throw unlockedError;
    
    const unlockedIds = new Set(unlocked.map((u: any) => u.achievement_id));
    const newUnlocks = candidates.filter((c: any) => !unlockedIds.has(c.id));

    if (newUnlocks.length === 0) return [];

    // 3. Unlock them
    const unlocksToInsert = newUnlocks.map((ach: any) => ({
      user_id: userId,
      achievement_id: ach.id,
      unlocked_at: new Date().toISOString()
    }));

    const { error: insertError } = await supabaseAdmin
      .from('user_achievements')
      .insert(unlocksToInsert);

    if (insertError) throw insertError;

    // 4. Award XP
    let totalXp = 0;
    for (const ach of newUnlocks) {
      totalXp += ach.xp_reward;
    }

    if (totalXp > 0) {
      await this.addXp(userId, totalXp);
    }

    return newUnlocks;
  }

  /**
   * Add XP to user and handle leveling
   */
  async addXp(userId: string, amount: number): Promise<{ newLevel: number, newXp: number, levelUp: boolean }> {
    // 1. Get current user stats
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('xp, level')
      .eq('id', userId)
      .single();

    if (userError) throw userError;

    let { xp, level } = user;
    xp = (xp || 0) + amount;
    
    // Simple leveling formula: Level * 1000 XP needed for next level
    // Or constant: 1000 * (Level)
    // Let's use: Threshold = Level * 500
    let levelUp = false;
    let nextLevelThreshold = level * 500;

    while (xp >= nextLevelThreshold) {
      xp -= nextLevelThreshold;
      level++;
      levelUp = true;
      nextLevelThreshold = level * 500;
    }

    // 2. Update user
    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({ xp, level })
      .eq('id', userId);

    if (updateError) throw updateError;

    return { newLevel: level, newXp: xp, levelUp };
  }

  /**
   * Calculate and update study streak based on focus sessions
   */
  async updateStudyStreak(userId: string): Promise<void> {
    // Get unique dates from focus_sessions
    const { data: sessions, error } = await supabaseAdmin
      .from('focus_sessions')
      .select('start_time')
      .eq('user_id', userId)
      .eq('completed', true)
      .order('start_time', { ascending: false });

    if (error || !sessions) return;

    // Calculate streak
    const dates = new Set(sessions.map((s: any) => s.start_time.split('T')[0]));
    const sortedDates = Array.from(dates).sort((a: any, b: any) => new Date(b).getTime() - new Date(a).getTime());
    
    if (sortedDates.length === 0) return;

    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    
    // Check if user studied today or yesterday (to keep streak alive)
    if (sortedDates[0] !== today && sortedDates[0] !== yesterday) {
      // Streak broken (or 0 if they haven't studied today/yesterday)
      // But we only care about *current* streak for achievements usually.
      // If they missed a day, streak is 0? Or just doesn't increase?
      // "Streak" usually means consecutive days ending Today or Yesterday.
    }

    let streak = 0;
    const currentDate = new Date();
    // Normalize to YYYY-MM-DD
    const dateString = (d: Date) => d.toISOString().split('T')[0];
    
    // If the latest session is not today or yesterday, streak is 0
    if (!dates.has(dateString(currentDate)) && !dates.has(dateString(new Date(Date.now() - 86400000)))) {
      streak = 0;
    } else {
      // Count backwards
      // We start checking from Today.
      // If Today has data, streak = 1. Then check Yesterday.
      // If Today no data, check Yesterday. If Yesterday has data, streak = 1.
      
      const checkDate = new Date();
      // If today has no data, start from yesterday
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

  /**
   * Update focus achievements (total minutes)
   */
  async updateFocusStats(userId: string): Promise<void> {
    const { error: _error } = await supabaseAdmin
      .from('focus_sessions')
      .select('duration')
      .eq('user_id', userId)
      .eq('completed', true)
      .gte('start_time', new Date().toISOString().split('T')[0]); // Only today's sessions

    // Note: The original logic summed ALL focus sessions for achievements.
    // We should keep that for "Total Focus Time" achievements.
    // But for Daily Task "focus_time", we only care about today.
    // Let's separate the logic.
    
    // 1. Update Daily Task (Focus 25 min)
    // We need to know the duration of the *latest* session or accumulate today's.
    // The trigger usually comes after ONE session completes.
    // Let's assume this method is called after a session.
    // Ideally we pass the duration of the just-completed session.
    // But since we query DB, let's query today's total.
    
    const today = new Date().toISOString().split('T')[0];
    const { data: todaySessions } = await supabaseAdmin
      .from('focus_sessions')
      .select('duration')
      .eq('user_id', userId)
      .eq('completed', true)
      .gte('start_time', today);
      
    const todayMinutes = todaySessions?.reduce((acc: number, curr: any) => acc + curr.duration, 0) || 0;
    
    // Update daily task progress to match today's total
    // But updateDailyTask adds incremental progress usually? 
    // No, our implementation `newProgress = task.progress + amount`.
    // So we should pass the *delta*.
    // However, recreating state from DB is safer.
    // Let's modify updateDailyTask to set absolute progress if needed, or we just pass the delta from the caller.
    // For now, let's just pass 25 if the session was 25 min? 
    // It's better if the caller (route) passes the duration.
    // But let's stick to the current pattern: "Check and Update".
    
    // Let's refactor updateDailyTask to take absolute value or delta.
    // Actually, let's just use a specific method for daily focus.
    
    await this.updateDailyTaskProgress(userId, 'focus_time', todayMinutes);

    // 2. Update Lifetime Achievements (Total Focus Time)
    const { data: allSessions } = await supabaseAdmin
      .from('focus_sessions')
      .select('duration')
      .eq('user_id', userId)
      .eq('completed', true);
      
    const totalMinutes = allSessions?.reduce((acc: number, curr: any) => acc + curr.duration, 0) || 0;
    await this.checkAndUnlock(userId, 'focus_minutes', totalMinutes);
    
    await periodicTaskService.updatePeriodicTaskProgress(userId, 'focus', totalMinutes);
    
    await this.updateStudyStreak(userId);
  }

  /**
   * Helper to set absolute progress for daily task
   */
  async updateDailyTaskProgress(userId: string, type: string, currentTotal: number): Promise<void> {
    const today = new Date().toISOString().split('T')[0];
    const { data: task } = await supabaseAdmin
      .from('daily_tasks')
      .select('*')
      .eq('user_id', userId)
      .eq('task_date', today)
      .eq('task_type', type)
      .single();
      
    if (!task || task.status !== 'pending') return;
    
    if (currentTotal >= task.target) {
      await supabaseAdmin
        .from('daily_tasks')
        .update({ status: 'completed', progress: task.target, completed_at: new Date().toISOString() })
        .eq('id', task.id);
      await this.addXp(userId, task.xp_reward);
    } else {
      await supabaseAdmin
        .from('daily_tasks')
        .update({ progress: currentTotal })
        .eq('id', task.id);
    }
  }

  /**
   * Update study achievements (mastered cards)
   * We define "mastered" as having a stability > 21 days (approx 3 weeks)
   */
  async updateMasteredStats(userId: string): Promise<void> {
    const { count, error } = await supabaseAdmin
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

  /**
   * Update creation achievements (graphs/nodes created)
   */
  async updateCreationStats(userId: string): Promise<void> {
    const { count: graphCount, error: graphError } = await supabaseAdmin
      .from('graphs')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    if (!graphError) {
      await this.checkAndUnlock(userId, 'graphs_created', graphCount || 0);
    }

    await this.updateDailyTask(userId, 'create_node', 1);

    const { count: nodeCount, error: nodeError } = await supabaseAdmin
      .from('graph_nodes')
      .select('id, knowledge_graphs!inner(user_id)', { count: 'exact', head: true })
      .eq('knowledge_graphs.user_id', userId)
      .is('deleted_at', null);

    if (!nodeError) {
      await this.checkAndUnlock(userId, 'nodes_created', nodeCount || 0);
      await periodicTaskService.updatePeriodicTaskProgress(userId, 'create', nodeCount || 0);
    }
  }
}

export const achievementService = new AchievementService();

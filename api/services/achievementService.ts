import { supabaseAdmin } from '../supabase.js';

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
      .in('achievement_id', candidates.map(c => c.id));

    if (unlockedError) throw unlockedError;
    
    const unlockedIds = new Set(unlocked.map((u: any) => u.achievement_id));
    const newUnlocks = candidates.filter(c => !unlockedIds.has(c.id));

    if (newUnlocks.length === 0) return [];

    // 3. Unlock them
    const unlocksToInsert = newUnlocks.map(ach => ({
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
    const dates = new Set(sessions.map(s => s.start_time.split('T')[0]));
    const sortedDates = Array.from(dates).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
    
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
    let currentDate = new Date();
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
      
      let checkDate = new Date();
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
    const { data: sessions, error } = await supabaseAdmin
      .from('focus_sessions')
      .select('duration')
      .eq('user_id', userId)
      .eq('completed', true);

    if (error || !sessions) return;

    const totalMinutes = sessions.reduce((acc, curr) => acc + curr.duration, 0);
    await this.checkAndUnlock(userId, 'focus_minutes', totalMinutes);
    
    // Also update streak
    await this.updateStudyStreak(userId);
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
      .gt('fsrs_stability', 21); // Stability is in days

    if (error) return;

    await this.checkAndUnlock(userId, 'cards_mastered', count || 0);
  }

  /**
   * Update creation achievements (graphs/nodes created)
   */
  async updateCreationStats(userId: string): Promise<void> {
    // 1. Check graphs count
    const { count: graphCount, error: graphError } = await supabaseAdmin
      .from('graphs')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    if (!graphError) {
      await this.checkAndUnlock(userId, 'graphs_created', graphCount || 0);
    }

    // 2. Check nodes count
    // Note: We need to join with graphs to check ownership if nodes don't have user_id (which they don't seem to have directly on nodes table usually, let's check schema or assume ownership via graph)
    // Actually nodes usually belong to a graph, and graph belongs to user.
    // Let's check nodes table structure if needed. 
    // Wait, earlier read of types/index.ts didn't show user_id on Node interface.
    // Let's assume we count nodes via graphs owned by user.
    
    const { count: nodeCount, error: nodeError } = await supabaseAdmin
      .from('nodes')
      .select('id, graphs!inner(user_id)', { count: 'exact', head: true })
      .eq('graphs.user_id', userId);

    if (!nodeError) {
      await this.checkAndUnlock(userId, 'nodes_created', nodeCount || 0);
    }
  }
}

export const achievementService = new AchievementService();

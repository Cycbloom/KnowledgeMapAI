import { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '../../utils/logger';
import { CAPTURE_INBOX_TAG } from '@shared/constants/capture';
import type { TodaySummary } from '@shared/types/api';

export interface HeatmapItem {
  date: string;
  count: number;
}

export interface BlindSpot {
  id: string;
  user_id: string;
  knowledge_point_id: string;
  graph_id: string;
  question: string;
  answer: string;
  fsrs_stability: number;
  fsrs_difficulty: number;
  fsrs_state: number;
  last_reviewed: string | null;
  knowledge_points?: {
    title: string;
  } | null;
}

export interface DistributionItem {
  name: string;
  value: number;
  color: string;
}

export interface DashboardStats {
  heatmap: HeatmapItem[];
  blindSpots: BlindSpot[];
  distribution: DistributionItem[];
}

export class DashboardService {
  async getDashboard(supabase: SupabaseClient, userId: string): Promise<DashboardStats> {
    const heatmap = await this.getHeatmapData(supabase, userId);
    const blindSpots = await this.getBlindSpots(supabase, userId);
    const distribution = await this.getDistribution(supabase, userId);

    return {
      heatmap,
      blindSpots,
      distribution
    };
  }

  private async getHeatmapData(supabase: SupabaseClient, userId: string): Promise<HeatmapItem[]> {
    const { data, error } = await supabase
      .from('study_cards')
      .select('last_reviewed')
      .eq('user_id', userId)
      .not('last_reviewed', 'is', null)
      .gte('last_reviewed', new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString());

    if (error) {
      logger.error('Error fetching heatmap data:', error);
      throw error;
    }

    const activityMap = new Map<string, number>();
    data?.forEach(card => {
      if (!card.last_reviewed) return;
      const date = card.last_reviewed.split('T')[0];
      activityMap.set(date, (activityMap.get(date) || 0) + 1);
    });

    return Array.from(activityMap.entries()).map(([date, count]) => ({ date, count }));
  }

  private async getBlindSpots(supabase: SupabaseClient, userId: string): Promise<BlindSpot[]> {
    const { data, error } = await supabase
      .from('study_cards')
      .select('*, knowledge_points(title)')
      .eq('user_id', userId)
      .neq('fsrs_state', 'New')
      .order('fsrs_stability', { ascending: true })
      .limit(10);

    if (error) {
      logger.error('Error fetching blind spots:', error);
      throw error;
    }

    return (data as BlindSpot[]) || [];
  }

  private async getDistribution(supabase: SupabaseClient, userId: string): Promise<DistributionItem[]> {
    const { data, error } = await supabase
      .from('study_cards')
      .select('fsrs_state')
      .eq('user_id', userId);

    if (error) {
      logger.error('Error fetching distribution data:', error);
      throw error;
    }

    const distribution: Record<string, number> = {
      "New": 0,
      "Learning": 0,
      "Review": 0,
      "Relearning": 0
    };

    data?.forEach(card => {
      const state = card.fsrs_state;
      if (state && distribution[state] !== undefined) {
        distribution[state]++;
      }
    });

    return [
      { name: 'new', value: distribution["New"], color: '#94a3b8' },
      { name: 'learning', value: distribution["Learning"], color: '#fbbf24' },
      { name: 'review', value: distribution["Review"], color: '#4ade80' },
      { name: 'relearning', value: distribution["Relearning"], color: '#f87171' }
    ];
  }

  /**
   * 首页"今日回顾"摘要计数：
   * - inboxCount 待归档捕获数
   * - dueCards 今日到期需复习的卡片数
   * - dueTasks 今日到期且未完成的任务数
   */
  async getTodaySummary(supabase: SupabaseClient, userId: string): Promise<TodaySummary> {
    const now = new Date();
    const startOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    ).toISOString();
    const endOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      23,
      59,
      59,
      999,
    ).toISOString();

    const [inboxResult, cardsResult, tasksResult] = await Promise.all([
      supabase
        .from('notes')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('is_archived', false)
        .is('deleted_at', null)
        .contains('tags', [CAPTURE_INBOX_TAG]),
      supabase
        .from('study_cards')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .lte('next_review', endOfToday),
      supabase
        .from('user_tasks')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .is('deleted_at', null)
        .neq('status', 'completed')
        .gte('deadline', startOfToday)
        .lte('deadline', endOfToday),
    ]);

    const throwOnError = (label: string) => (error: unknown) => {
      logger.error(`Today summary: count error on ${label}`, { userId, error });
      throw error;
    };
    if (inboxResult.error) throwOnError('notes')(inboxResult.error);
    if (cardsResult.error) throwOnError('study_cards')(cardsResult.error);
    if (tasksResult.error) throwOnError('user_tasks')(tasksResult.error);

    return {
      inboxCount: inboxResult.count ?? 0,
      dueCards: cardsResult.count ?? 0,
      dueTasks: tasksResult.count ?? 0,
    };
  }
}

export const dashboardService = new DashboardService();

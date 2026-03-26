import { SupabaseClient } from '@supabase/supabase-js';
import { State } from 'ts-fsrs';
import { logger } from '../../utils/logger';

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
      .neq('fsrs_state', State.New)
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

    const distribution = {
      [State.New]: 0,
      [State.Learning]: 0,
      [State.Review]: 0,
      [State.Relearning]: 0
    };

    data?.forEach(card => {
      const state = card.fsrs_state as State;
      if (distribution[state] !== undefined) {
        distribution[state]++;
      }
    });

    return [
      { name: '新卡片', value: distribution[State.New], color: '#94a3b8' },
      { name: '学习中', value: distribution[State.Learning], color: '#fbbf24' },
      { name: '复习中', value: distribution[State.Review], color: '#4ade80' },
      { name: '重新学习', value: distribution[State.Relearning], color: '#f87171' }
    ];
  }
}

export const dashboardService = new DashboardService();

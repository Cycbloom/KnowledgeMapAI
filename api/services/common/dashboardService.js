import { State } from 'ts-fsrs';
import { logger } from '../../utils/logger.js';
export class DashboardService {
    async getDashboard(supabase, userId) {
        const heatmap = await this.getHeatmapData(supabase, userId);
        const blindSpots = await this.getBlindSpots(supabase, userId);
        const distribution = await this.getDistribution(supabase, userId);
        return {
            heatmap,
            blindSpots,
            distribution
        };
    }
    async getHeatmapData(supabase, userId) {
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
        const activityMap = new Map();
        data?.forEach(card => {
            if (!card.last_reviewed)
                return;
            const date = card.last_reviewed.split('T')[0];
            activityMap.set(date, (activityMap.get(date) || 0) + 1);
        });
        return Array.from(activityMap.entries()).map(([date, count]) => ({ date, count }));
    }
    async getBlindSpots(supabase, userId) {
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
        return data || [];
    }
    async getDistribution(supabase, userId) {
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
            const state = card.fsrs_state;
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
//# sourceMappingURL=dashboardService.js.map
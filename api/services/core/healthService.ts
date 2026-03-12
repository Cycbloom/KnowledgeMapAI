import { SupabaseClient } from '@supabase/supabase-js';

export interface OverviewData {
  totalGraphs: number;
  totalNodes: number;
  totalCards: number;
  masteredNodes: number;
  learningNodes: number;
  newNodes: number;
  overallProgress: number;
  weeklyStudyTime: number;
  streakDays: number;
}

export interface HeatmapItem {
  id: string;
  title: string;
  level: number;
  x: number;
  y: number;
  mastery: number;
  status: 'mastered' | 'learning' | 'new';
}

export interface WeakPoint {
  nodeId: string;
  nodeTitle: string;
  graphTitle: string;
  mastery: number;
  reviewCount: number;
  nextReview: string | null;
  priority: 'high' | 'medium' | 'low';
  suggestion: string;
}

export interface Prediction {
  date: string;
  reviewCount: number;
  newCards: number;
  difficulty: 'easy' | 'medium' | 'hard';
}

export interface ActivityItem {
  date: string;
  studyTime: number;
  reviews: number;
}

export class HealthService {
  async getOverview(
    supabase: SupabaseClient,
    userId: string
  ): Promise<OverviewData> {
    const { data: graphs } = await supabase
      .from('graphs')
      .select('id, title')
      .eq('user_id', userId);

    const graphIds = graphs?.map(g => g.id) || [];

    if (graphIds.length === 0) {
      return {
        totalGraphs: 0,
        totalNodes: 0,
        totalCards: 0,
        masteredNodes: 0,
        learningNodes: 0,
        newNodes: 0,
        overallProgress: 0,
        weeklyStudyTime: 0,
        streakDays: 0
      };
    }

    const { count: totalNodes } = await supabase
      .from('graph_nodes')
      .select('id', { count: 'exact', head: true })
      .in('graph_id', graphIds)
      .is('deleted_at', null);

    const { data: studyCards } = await supabase
      .from('study_cards')
      .select('id, knowledge_point_id, fsrs_stability, fsrs_difficulty')
      .eq('user_id', userId)
      .in('graph_id', graphIds);

    const nodeProgress = new Map<string, { mastered: number; learning: number; new: number }>();

    if (studyCards) {
      studyCards.forEach(card => {
        const mastery = Math.min(1, ((card.fsrs_stability || 0) / 30) * (1 - (card.fsrs_difficulty || 5) / 10));

        if (!nodeProgress.has(card.knowledge_point_id)) {
          nodeProgress.set(card.knowledge_point_id, { mastered: 0, learning: 0, new: 0 });
        }

        const np = nodeProgress.get(card.knowledge_point_id)!;
        if (mastery > 0.8) np.mastered++;
        else if (mastery > 0.3) np.learning++;
        else np.new++;
      });
    }

    let masteredNodes = 0;
    let learningNodes = 0;
    let newNodes = 0;

    nodeProgress.forEach(np => {
      if (np.mastered > 0) masteredNodes++;
      else if (np.learning > 0) learningNodes++;
      else newNodes++;
    });

    const nodesWithoutCards = (totalNodes || 0) - nodeProgress.size;
    newNodes += nodesWithoutCards;

    const overallProgress = (totalNodes || 0) > 0
      ? Math.round((masteredNodes / (totalNodes || 1)) * 100)
      : 0;

    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const { data: sessions } = await supabase
      .from('focus_sessions')
      .select('duration')
      .eq('user_id', userId)
      .gte('started_at', weekAgo.toISOString())
      .eq('status', 'completed');

    const weeklyStudyTime = sessions?.reduce((sum, s) => sum + (s.duration || 0), 0) || 0;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { data: dailyCheckins } = await supabase
      .from('daily_checkins')
      .select('checkin_date')
      .eq('user_id', userId)
      .order('checkin_date', { ascending: false })
      .limit(30);

    let streakDays = 0;
    if (dailyCheckins && dailyCheckins.length > 0) {
      const checkinDates = dailyCheckins.map(c => new Date(c.checkin_date).toDateString());
      const todayStr = today.toDateString();

      if (checkinDates.includes(todayStr)) {
        streakDays = 1;
        const checkDate = new Date(today);
        checkDate.setDate(checkDate.getDate() - 1);

        while (checkinDates.includes(checkDate.toDateString())) {
          streakDays++;
          checkDate.setDate(checkDate.getDate() - 1);
        }
      }
    }

    return {
      totalGraphs: graphs?.length || 0,
      totalNodes: totalNodes || 0,
      totalCards: studyCards?.length || 0,
      masteredNodes,
      learningNodes,
      newNodes,
      overallProgress,
      weeklyStudyTime,
      streakDays
    };
  }

  async getHeatmap(
    supabase: SupabaseClient,
    userId: string
  ): Promise<HeatmapItem[]> {
    const { data: graphs } = await supabase
      .from('graphs')
      .select('id, title')
      .eq('user_id', userId);

    const graphIds = graphs?.map(g => g.id) || [];

    if (graphIds.length === 0) {
      return [];
    }

    const { data: graphNodes } = await supabase
      .from('graph_nodes')
      .select(`
        knowledge_point_id,
        x_position,
        y_position,
        level,
        knowledge_points (
          id,
          title
        )
      `)
      .in('graph_id', graphIds)
      .is('deleted_at', null);

    const nodeIds = graphNodes?.map((gn: any) => gn.knowledge_points?.id || gn.knowledge_point_id) || [];

    const { data: studyCards } = await supabase
      .from('study_cards')
      .select('knowledge_point_id, fsrs_stability, fsrs_difficulty')
      .eq('user_id', userId)
      .in('knowledge_point_id', nodeIds);

    const nodeMastery = new Map<string, number[]>();

    if (studyCards) {
      studyCards.forEach(card => {
        const nodeId = card.knowledge_point_id;
        const mastery = Math.min(1, ((card.fsrs_stability || 0) / 30) * (1 - (card.fsrs_difficulty || 5) / 10));
        if (!nodeMastery.has(nodeId)) {
          nodeMastery.set(nodeId, []);
        }
        nodeMastery.get(nodeId)!.push(mastery);
      });
    }

    const heatmap: HeatmapItem[] = graphNodes?.map((gn: any) => {
      const nodeId = gn.knowledge_points?.id || gn.knowledge_point_id;
      const masteries = nodeMastery.get(nodeId) || [];
      const avgMastery = masteries.length > 0
        ? masteries.reduce((a: number, b: number) => a + b, 0) / masteries.length
        : 0;

      return {
        id: nodeId,
        title: gn.knowledge_points?.title || '',
        level: gn.level,
        x: gn.x_position,
        y: gn.y_position,
        mastery: Math.round(avgMastery * 100),
        status: avgMastery > 0.8 ? 'mastered' : avgMastery > 0.3 ? 'learning' : 'new'
      };
    }) || [];

    return heatmap;
  }

  async getWeakPoints(
    supabase: SupabaseClient,
    userId: string
  ): Promise<WeakPoint[]> {
    const { data: graphs } = await supabase
      .from('graphs')
      .select('id, title')
      .eq('user_id', userId);

    const graphIds = graphs?.map(g => g.id) || [];

    if (graphIds.length === 0) {
      return [];
    }

    const { data: graphNodes } = await supabase
      .from('graph_nodes')
      .select(`
        knowledge_point_id,
        graph_id,
        level,
        knowledge_points (
          id,
          title,
          content
        )
      `)
      .in('graph_id', graphIds)
      .is('deleted_at', null);

    const nodeIds = graphNodes?.map((gn: any) => gn.knowledge_points?.id || gn.knowledge_point_id) || [];
    const nodeMap = new Map(graphNodes?.map((gn: any) => [gn.knowledge_points?.id || gn.knowledge_point_id, {
      id: gn.knowledge_points?.id || gn.knowledge_point_id,
      title: gn.knowledge_points?.title || '',
      content: gn.knowledge_points?.content || '',
      level: gn.level,
      graph_id: gn.graph_id
    }]) || []);

    const { data: studyCards } = await supabase
      .from('study_cards')
      .select('knowledge_point_id, fsrs_stability, fsrs_difficulty, review_count, next_review')
      .eq('user_id', userId)
      .in('knowledge_point_id', nodeIds);

    const nodeStats = new Map<string, {
      mastery: number[];
      reviewCount: number;
      nextReview: string | null;
      cards: number;
    }>();

    if (studyCards) {
      studyCards.forEach(card => {
        const nodeId = card.knowledge_point_id;
        const mastery = Math.min(1, ((card.fsrs_stability || 0) / 30) * (1 - (card.fsrs_difficulty || 5) / 10));

        if (!nodeStats.has(nodeId)) {
          nodeStats.set(nodeId, { mastery: [], reviewCount: 0, nextReview: null, cards: 0 });
        }

        const stats = nodeStats.get(nodeId)!;
        stats.mastery.push(mastery);
        stats.reviewCount = Math.max(stats.reviewCount, card.review_count || 0);
        stats.cards++;

        if (card.next_review) {
          if (!stats.nextReview || new Date(card.next_review) < new Date(stats.nextReview)) {
            stats.nextReview = card.next_review;
          }
        }
      });
    }

    const weakPoints: WeakPoint[] = [];

    nodeStats.forEach((stats, nodeId) => {
      const avgMastery = stats.mastery.reduce((a, b) => a + b, 0) / stats.mastery.length;

      if (avgMastery < 0.6) {
        const node = nodeMap.get(nodeId);
        const graph = graphs?.find(g => g.id === node?.graph_id);

        let priority: 'high' | 'medium' | 'low' = 'low';
        let suggestion = '';

        if (avgMastery < 0.3) {
          priority = 'high';
          suggestion = '建议立即复习，掌握程度较低';
        } else if (avgMastery < 0.5) {
          priority = 'medium';
          suggestion = '建议近期安排复习';
        } else {
          priority = 'low';
          suggestion = '继续巩固，即将掌握';
        }

        if (stats.nextReview && new Date(stats.nextReview) <= new Date()) {
          priority = 'high';
          suggestion = '已到复习时间，建议立即复习';
        }

        weakPoints.push({
          nodeId,
          nodeTitle: node?.title || '未知',
          graphTitle: graph?.title || '未知图谱',
          mastery: Math.round(avgMastery * 100),
          reviewCount: stats.reviewCount,
          nextReview: stats.nextReview,
          priority,
          suggestion
        });
      }
    });

    weakPoints.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });

    return weakPoints.slice(0, 10);
  }

  async getPredictions(
    supabase: SupabaseClient,
    userId: string
  ): Promise<Prediction[]> {
    const { data: graphs } = await supabase
      .from('graphs')
      .select('id')
      .eq('user_id', userId);

    const graphIds = graphs?.map(g => g.id) || [];

    if (graphIds.length === 0) {
      return [];
    }

    const { data: graphNodes } = await supabase
      .from('graph_nodes')
      .select('knowledge_point_id')
      .in('graph_id', graphIds)
      .is('deleted_at', null);

    const nodeIds = graphNodes?.map((gn: any) => gn.knowledge_point_id) || [];

    const { data: studyCards } = await supabase
      .from('study_cards')
      .select('knowledge_point_id, fsrs_stability, fsrs_difficulty, next_review')
      .eq('user_id', userId)
      .in('knowledge_point_id', nodeIds);

    const today = new Date();
    const predictions: Prediction[] = [];

    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];

      let reviewCount = 0;
      let totalDifficulty = 0;

      studyCards?.forEach(card => {
        if (card.next_review) {
          const reviewDate = new Date(card.next_review).toISOString().split('T')[0];
          if (reviewDate === dateStr) {
            reviewCount++;
            totalDifficulty += card.fsrs_difficulty || 5;
          }
        }
      });

      const avgDifficulty = reviewCount > 0 ? totalDifficulty / reviewCount : 5;
      let difficulty: 'easy' | 'medium' | 'hard' = 'medium';
      if (avgDifficulty < 4) difficulty = 'easy';
      else if (avgDifficulty > 6) difficulty = 'hard';

      predictions.push({
        date: dateStr,
        reviewCount,
        newCards: i === 0 ? 0 : Math.max(0, 5 - reviewCount),
        difficulty
      });
    }

    return predictions;
  }

  async getActivity(
    supabase: SupabaseClient,
    userId: string,
    days: number = 7
  ): Promise<ActivityItem[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { data: sessions } = await supabase
      .from('focus_sessions')
      .select('started_at, duration')
      .eq('user_id', userId)
      .gte('started_at', startDate.toISOString())
      .eq('status', 'completed');

    const { data: reviews } = await supabase
      .from('study_cards')
      .select('fsrs_last_review')
      .eq('user_id', userId)
      .gte('fsrs_last_review', startDate.toISOString());

    const activityByDay = new Map<string, { studyTime: number; reviews: number }>();

    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      activityByDay.set(dateStr, { studyTime: 0, reviews: 0 });
    }

    sessions?.forEach(s => {
      const dateStr = new Date(s.started_at).toISOString().split('T')[0];
      const activity = activityByDay.get(dateStr);
      if (activity) {
        activity.studyTime += s.duration || 0;
      }
    });

    reviews?.forEach(r => {
      const dateStr = new Date(r.fsrs_last_review).toISOString().split('T')[0];
      const activity = activityByDay.get(dateStr);
      if (activity) {
        activity.reviews++;
      }
    });

    const activity = Array.from(activityByDay.entries())
      .map(([date, data]) => ({
        date,
        studyTime: Math.round(data.studyTime / 60),
        reviews: data.reviews
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return activity;
  }
}

export const healthService = new HealthService();

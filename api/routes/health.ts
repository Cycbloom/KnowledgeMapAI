import { Router, type Response } from 'express';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { ErrorCodes } from '../constants/errorCodes.js';
import { supabaseAdmin } from '../supabase.js';
import { logger } from '../utils/logger.js';

const router = Router();

router.get('/overview', requireAuth, async (req: AuthRequest, res: Response) => {
  const supabase = req.supabase!;

  try {
    const { data: graphs } = await supabase
      .from('graphs')
      .select('id, title')
      .eq('user_id', req.user.id);

    const graphIds = graphs?.map(g => g.id) || [];

    if (graphIds.length === 0) {
      return res.json({
        totalGraphs: 0,
        totalNodes: 0,
        totalCards: 0,
        masteredNodes: 0,
        learningNodes: 0,
        newNodes: 0,
        overallProgress: 0,
        weeklyStudyTime: 0,
        streakDays: 0
      });
    }

    const { count: totalNodes } = await supabase
      .from('nodes')
      .select('id', { count: 'exact', head: true })
      .in('graph_id', graphIds);

    const { data: cards } = await supabase
      .from('cards')
      .select('id, node_id')
      .in('graph_id', graphIds);

    const cardIds = cards?.map(c => c.id) || [];
    const nodeIds = [...new Set(cards?.map(c => c.node_id) || [])];

    const { data: progress } = await supabase
      .from('card_progress')
      .select('card_id, stability, difficulty, review_count')
      .eq('user_id', req.user.id)
      .in('card_id', cardIds);

    const nodeProgress = new Map<string, { mastered: number; learning: number; new: number }>();
    
    if (cards && progress) {
      cards.forEach(card => {
        const cardProgress = progress.find(p => p.card_id === card.id);
        const mastery = cardProgress 
          ? Math.min(1, ((cardProgress.stability || 0) / 30) * (1 - (cardProgress.difficulty || 5) / 10))
          : 0;
        
        if (!nodeProgress.has(card.node_id)) {
          nodeProgress.set(card.node_id, { mastered: 0, learning: 0, new: 0 });
        }
        
        const np = nodeProgress.get(card.node_id)!;
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
      ? Math.round((masteredNodes / totalNodes) * 100) 
      : 0;

    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const { data: sessions } = await supabase
      .from('focus_sessions')
      .select('duration')
      .eq('user_id', req.user.id)
      .gte('started_at', weekAgo.toISOString())
      .eq('status', 'completed');

    const weeklyStudyTime = sessions?.reduce((sum, s) => sum + (s.duration || 0), 0) || 0;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const { data: dailyCheckins } = await supabase
      .from('daily_checkins')
      .select('checkin_date')
      .eq('user_id', req.user.id)
      .order('checkin_date', { ascending: false })
      .limit(30);

    let streakDays = 0;
    if (dailyCheckins && dailyCheckins.length > 0) {
      const checkinDates = dailyCheckins.map(c => new Date(c.checkin_date).toDateString());
      const todayStr = today.toDateString();
      
      if (checkinDates.includes(todayStr)) {
        streakDays = 1;
        let checkDate = new Date(today);
        checkDate.setDate(checkDate.getDate() - 1);
        
        while (checkinDates.includes(checkDate.toDateString())) {
          streakDays++;
          checkDate.setDate(checkDate.getDate() - 1);
        }
      }
    }

    res.json({
      totalGraphs: graphs?.length || 0,
      totalNodes: totalNodes || 0,
      totalCards: cardIds.length,
      masteredNodes,
      learningNodes,
      newNodes,
      overallProgress,
      weeklyStudyTime,
      streakDays
    });

  } catch (error: any) {
    logger.error('Health Overview Error:', error);
    throw new AppError(error.message || '获取健康概览失败', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

router.get('/heatmap', requireAuth, async (req: AuthRequest, res: Response) => {
  const supabase = req.supabase!;

  try {
    const { data: graphs } = await supabase
      .from('graphs')
      .select('id, title')
      .eq('user_id', req.user.id);

    const graphIds = graphs?.map(g => g.id) || [];

    if (graphIds.length === 0) {
      return res.json({ heatmap: [] });
    }

    const { data: nodes } = await supabase
      .from('nodes')
      .select('id, title, level, x_position, y_position')
      .in('graph_id', graphIds);

    const nodeIds = nodes?.map(n => n.id) || [];

    const { data: cards } = await supabase
      .from('cards')
      .select('id, node_id')
      .in('node_id', nodeIds);

    const cardIds = cards?.map(c => c.id) || [];
    const cardToNode = new Map(cards?.map(c => [c.id, c.node_id]) || []);

    const { data: progress } = await supabase
      .from('card_progress')
      .select('card_id, stability, difficulty')
      .eq('user_id', req.user.id)
      .in('card_id', cardIds);

    const nodeMastery = new Map<string, number[]>();
    
    if (progress) {
      progress.forEach(p => {
        const nodeId = cardToNode.get(p.card_id);
        if (nodeId) {
          const mastery = Math.min(1, ((p.stability || 0) / 30) * (1 - (p.difficulty || 5) / 10));
          if (!nodeMastery.has(nodeId)) {
            nodeMastery.set(nodeId, []);
          }
          nodeMastery.get(nodeId)!.push(mastery);
        }
      });
    }

    const heatmap = nodes?.map(node => {
      const masteries = nodeMastery.get(node.id) || [];
      const avgMastery = masteries.length > 0 
        ? masteries.reduce((a, b) => a + b, 0) / masteries.length 
        : 0;

      return {
        id: node.id,
        title: node.title,
        level: node.level,
        x: node.x_position,
        y: node.y_position,
        mastery: Math.round(avgMastery * 100),
        status: avgMastery > 0.8 ? 'mastered' : avgMastery > 0.3 ? 'learning' : 'new'
      };
    }) || [];

    res.json({ heatmap });

  } catch (error: any) {
    logger.error('Heatmap Error:', error);
    throw new AppError(error.message || '获取热力图失败', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

router.get('/weak-points', requireAuth, async (req: AuthRequest, res: Response) => {
  const supabase = req.supabase!;

  try {
    const { data: graphs } = await supabase
      .from('graphs')
      .select('id, title')
      .eq('user_id', req.user.id);

    const graphIds = graphs?.map(g => g.id) || [];

    if (graphIds.length === 0) {
      return res.json({ weakPoints: [] });
    }

    const { data: nodes } = await supabase
      .from('nodes')
      .select('id, title, content, level, graph_id')
      .in('graph_id', graphIds);

    const nodeIds = nodes?.map(n => n.id) || [];
    const nodeMap = new Map(nodes?.map(n => [n.id, n]) || []);

    const { data: cards } = await supabase
      .from('cards')
      .select('id, node_id, question')
      .in('node_id', nodeIds);

    const cardIds = cards?.map(c => c.id) || [];
    const cardToNode = new Map(cards?.map(c => [c.id, c.node_id]) || []);

    const { data: progress } = await supabase
      .from('card_progress')
      .select('card_id, stability, difficulty, review_count, next_review')
      .eq('user_id', req.user.id)
      .in('card_id', cardIds);

    const nodeStats = new Map<string, { 
      mastery: number[]; 
      reviewCount: number; 
      nextReview: string | null;
      cards: number;
    }>();

    if (progress) {
      progress.forEach(p => {
        const nodeId = cardToNode.get(p.card_id);
        if (nodeId) {
          const mastery = Math.min(1, ((p.stability || 0) / 30) * (1 - (p.difficulty || 5) / 10));
          
          if (!nodeStats.has(nodeId)) {
            nodeStats.set(nodeId, { mastery: [], reviewCount: 0, nextReview: null, cards: 0 });
          }
          
          const stats = nodeStats.get(nodeId)!;
          stats.mastery.push(mastery);
          stats.reviewCount = Math.max(stats.reviewCount, p.review_count || 0);
          stats.cards++;
          
          if (p.next_review) {
            if (!stats.nextReview || new Date(p.next_review) < new Date(stats.nextReview)) {
              stats.nextReview = p.next_review;
            }
          }
        }
      });
    }

    const weakPoints: Array<{
      nodeId: string;
      nodeTitle: string;
      graphTitle: string;
      mastery: number;
      reviewCount: number;
      nextReview: string | null;
      priority: 'high' | 'medium' | 'low';
      suggestion: string;
    }> = [];

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

    res.json({ weakPoints: weakPoints.slice(0, 10) });

  } catch (error: any) {
    logger.error('Weak Points Error:', error);
    throw new AppError(error.message || '获取薄弱点失败', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

router.get('/weekly-activity', requireAuth, async (req: AuthRequest, res: Response) => {
  const supabase = req.supabase!;

  try {
    const days = parseInt(req.query.days as string) || 7;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { data: sessions } = await supabase
      .from('focus_sessions')
      .select('started_at, duration')
      .eq('user_id', req.user.id)
      .gte('started_at', startDate.toISOString())
      .eq('status', 'completed');

    const { data: reviews } = await supabase
      .from('card_progress')
      .select('last_review')
      .eq('user_id', req.user.id)
      .gte('last_review', startDate.toISOString());

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
      const dateStr = new Date(r.last_review).toISOString().split('T')[0];
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

    res.json({ activity });

  } catch (error: any) {
    logger.error('Weekly Activity Error:', error);
    throw new AppError(error.message || '获取活动数据失败', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

router.get('/predictions', requireAuth, async (req: AuthRequest, res: Response) => {
  const supabase = req.supabase!;

  try {
    const { data: graphs } = await supabase
      .from('graphs')
      .select('id')
      .eq('user_id', req.user.id);

    const graphIds = graphs?.map(g => g.id) || [];

    if (graphIds.length === 0) {
      return res.json({ predictions: [] });
    }

    const { data: nodes } = await supabase
      .from('nodes')
      .select('id')
      .in('graph_id', graphIds);

    const nodeIds = nodes?.map(n => n.id) || [];

    const { data: cards } = await supabase
      .from('cards')
      .select('id, node_id')
      .in('node_id', nodeIds);

    const cardIds = cards?.map(c => c.id) || [];

    const { data: progress } = await supabase
      .from('card_progress')
      .select('card_id, stability, difficulty, next_review')
      .eq('user_id', req.user.id)
      .in('card_id', cardIds);

    const today = new Date();
    const predictions: Array<{
      date: string;
      reviewCount: number;
      newCards: number;
      difficulty: 'easy' | 'medium' | 'hard';
    }> = [];

    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];

      let reviewCount = 0;
      let totalDifficulty = 0;

      progress?.forEach(p => {
        if (p.next_review) {
          const reviewDate = new Date(p.next_review).toISOString().split('T')[0];
          if (reviewDate === dateStr) {
            reviewCount++;
            totalDifficulty += p.difficulty || 5;
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

    res.json({ predictions });

  } catch (error: any) {
    logger.error('Predictions Error:', error);
    throw new AppError(error.message || '获取预测数据失败', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

export default router;

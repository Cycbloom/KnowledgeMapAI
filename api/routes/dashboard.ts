import { Router, type Response } from 'express';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import { ErrorCodes } from '../constants/errorCodes.js';
import { AppError } from '../middleware/errorHandler.js';
import { State } from 'ts-fsrs';

const router = Router();

// Get dashboard statistics
router.get('/stats', requireAuth, async (req: AuthRequest, res: Response) => {
  const userId = req.user.id;

  // 1. Heatmap Data (Last 365 days review activity)
  // Group by date(last_reviewed)
  const { data: activityData, error: activityError } = await req.supabase!
    .from('study_cards')
    .select('last_reviewed')
    .eq('user_id', userId)
    .not('last_reviewed', 'is', null)
    .gte('last_reviewed', new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString()); // Last year

  if (activityError) throw new AppError('获取活跃度数据失败', 500, ErrorCodes.INTERNAL_ERROR);

  // Process activity data into { date: 'YYYY-MM-DD', count: number }
  const activityMap = new Map<string, number>();
  activityData?.forEach(card => {
    if (!card.last_reviewed) return;
    const date = card.last_reviewed.split('T')[0];
    activityMap.set(date, (activityMap.get(date) || 0) + 1);
  });
  
  const heatmap = Array.from(activityMap.entries()).map(([date, count]) => ({ date, count }));

  // 2. Blind Spots (Lowest stability cards, excluding New)
  const { data: blindSpots, error: blindSpotError } = await req.supabase!
    .from('study_cards')
    .select('*, nodes(title, graph_id)')
    .eq('user_id', userId)
    .neq('fsrs_state', State.New) // Exclude New cards
    .order('fsrs_stability', { ascending: true })
    .limit(10);

  if (blindSpotError) throw new AppError('获取盲区数据失败', 500, ErrorCodes.INTERNAL_ERROR);

  // 3. Knowledge Distribution (By State)
  const { data: distributionData, error: distError } = await req.supabase!
    .from('study_cards')
    .select('fsrs_state')
    .eq('user_id', userId);

  if (distError) throw new AppError('获取分布数据失败', 500, ErrorCodes.INTERNAL_ERROR);

  const distribution = {
    [State.New]: 0,
    [State.Learning]: 0,
    [State.Review]: 0,
    [State.Relearning]: 0
  };

  distributionData?.forEach(card => {
    const state = card.fsrs_state as State;
    if (distribution[state] !== undefined) {
      distribution[state]++;
    }
  });

  res.json({
    heatmap,
    blindSpots,
    distribution: [
      { name: '新卡片', value: distribution[State.New], color: '#94a3b8' }, // gray-400
      { name: '学习中', value: distribution[State.Learning], color: '#fbbf24' }, // amber-400
      { name: '复习中', value: distribution[State.Review], color: '#4ade80' }, // green-400
      { name: '重新学习', value: distribution[State.Relearning], color: '#f87171' } // red-400
    ]
  });
});

export default router;

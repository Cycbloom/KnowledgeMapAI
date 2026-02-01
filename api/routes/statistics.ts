import { Router, type Response } from 'express';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import { ErrorCodes } from '../constants/errorCodes.js';
import { AppError } from '../middleware/errorHandler.js';
import { State } from 'ts-fsrs';

const router = Router();

// Get aggregated statistics
router.get('/', requireAuth, async (req: AuthRequest, res: Response) => {
  const userId = req.user.id;
  const now = new Date();
  
  // Parallelize queries for performance
  const queries = [
    // 1. Heatmap (Last 365 days)
    req.supabase!
      .from('study_cards')
      .select('last_reviewed')
      .eq('user_id', userId)
      .not('last_reviewed', 'is', null)
      .gte('last_reviewed', new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString()),

    // 2. Distribution & Key Metrics Base
    req.supabase!
      .from('study_cards')
      .select('fsrs_state, fsrs_stability, next_review, created_at')
      .eq('user_id', userId),

    // 3. Growth (Last 30 days) - redundant if we fetch all created_at in query 2, 
    // but if user has many cards, query 2 might be heavy. 
    // However, for "Growth", we need created_at. Query 2 gets all cards.
    // Let's optimize: Query 2 gets everything needed for Distribution, Forecast, Growth, Metrics.
    // But if there are 10k cards, sending all back is bad.
    // Let's do specific queries or aggregation in SQL if possible, but Supabase JS client doesn't do complex aggregation easily without RPC.
    // We will stick to fetching necessary fields.
  ];

  // Refined Strategy:
  // 1. Heatmap: specific query (already defined)
  // 2. Distribution & Metrics: fetch 'fsrs_state', 'fsrs_stability', 'next_review' for ALL cards.
  // 3. Growth: fetch 'created_at' for cards created in last 30 days.
  
  const [heatmapResult, allCardsResult, growthResult] = await Promise.all([
    // Heatmap
    req.supabase!
      .from('study_cards')
      .select('last_reviewed')
      .eq('user_id', userId)
      .not('last_reviewed', 'is', null)
      .gte('last_reviewed', new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString()),

    // Metrics, Distribution, Forecast
    req.supabase!
      .from('study_cards')
      .select('fsrs_state, fsrs_stability, next_review')
      .eq('user_id', userId),

    // Growth (Last 30 days)
    req.supabase!
      .from('study_cards')
      .select('created_at')
      .eq('user_id', userId)
      .gte('created_at', new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString())
  ]);

  if (heatmapResult.error) throw new AppError('获取热力图数据失败', 500, ErrorCodes.INTERNAL_ERROR);
  if (allCardsResult.error) throw new AppError('获取统计数据失败', 500, ErrorCodes.INTERNAL_ERROR);
  if (growthResult.error) throw new AppError('获取增长数据失败', 500, ErrorCodes.INTERNAL_ERROR);

  // --- Process Heatmap ---
  const activityMap = new Map<string, number>();
  heatmapResult.data?.forEach(card => {
    if (!card.last_reviewed) return;
    const date = card.last_reviewed.split('T')[0];
    activityMap.set(date, (activityMap.get(date) || 0) + 1);
  });
  const heatmap = Array.from(activityMap.entries()).map(([date, count]) => ({ date, count }));

  // --- Process Distribution, Metrics, Forecast ---
  const cards = allCardsResult.data || [];
  
  // Distribution
  const distribution = {
    [State.New]: 0,
    [State.Learning]: 0,
    [State.Review]: 0,
    [State.Relearning]: 0
  };
  
  // Metrics
  let totalStability = 0;
  let stabilityCount = 0;
  let dueToday = 0;
  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 999);

  // Forecast (Next 7 days)
  const forecastMap = new Map<string, number>();
  // Initialize next 7 days
  for (let i = 0; i < 7; i++) {
    const d = new Date(now.getTime() + i * 24 * 60 * 60 * 1000);
    forecastMap.set(d.toISOString().split('T')[0], 0);
  }

  cards.forEach(card => {
    // Distribution
    const state = card.fsrs_state as State;
    if (distribution[state] !== undefined) {
      distribution[state]++;
    }

    // Average Stability (only for cards that have been studied)
    if (state !== State.New) {
      totalStability += (card.fsrs_stability || 0);
      stabilityCount++;
    }

    // Due Today
    if (card.next_review && new Date(card.next_review) <= endOfToday) {
      dueToday++;
    }

    // Forecast
    if (card.next_review) {
      const date = card.next_review.split('T')[0];
      if (forecastMap.has(date)) {
        forecastMap.set(date, (forecastMap.get(date) || 0) + 1);
      }
    }
  });

  const avgStability = stabilityCount > 0 ? (totalStability / stabilityCount).toFixed(1) : '0.0';

  // --- Process Growth ---
  const growthMap = new Map<string, number>();
  // Initialize last 30 days
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    growthMap.set(d.toISOString().split('T')[0], 0);
  }

  growthResult.data?.forEach(card => {
    if (!card.created_at) return;
    const date = card.created_at.split('T')[0];
    if (growthMap.has(date)) {
      growthMap.set(date, (growthMap.get(date) || 0) + 1);
    }
  });

  const growth = Array.from(growthMap.entries()).map(([date, count]) => ({ date, count }));
  const forecast = Array.from(forecastMap.entries()).map(([date, count]) => ({ date, count }));

  res.json({
    metrics: {
      totalCards: cards.length,
      dueToday,
      learning: distribution[State.Learning] + distribution[State.Relearning],
      avgStability: Number(avgStability)
    },
    heatmap,
    distribution: [
      { name: '新卡片', value: distribution[State.New], color: '#94a3b8' },
      { name: '学习中', value: distribution[State.Learning], color: '#fbbf24' },
      { name: '复习中', value: distribution[State.Review], color: '#4ade80' },
      { name: '重新学习', value: distribution[State.Relearning], color: '#f87171' }
    ],
    forecast,
    growth
  });
});

export default router;

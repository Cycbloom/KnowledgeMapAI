import { Router, type Response } from 'express';
import { requireAuth, type AuthRequest } from '../middleware/auth';
import { ErrorCodes } from '../../shared/types/errorCodes';
import { AppError } from '../middleware/errorHandler';

const router = Router();

// Get aggregated statistics
router.get('/', requireAuth, async (req: AuthRequest, res: Response) => {
  const userId = req.user.id;
  const now = new Date();
  
  // Optimize: Use RPC for server-side aggregation
  const { data: stats, error } = await req.supabase!.rpc('get_user_study_stats', {
    p_user_id: userId
  });

  if (error) throw new AppError(error.message || '获取统计数据失败', 500, ErrorCodes.INTERNAL_ERROR);

  // --- Process Distribution ---
  const stateCounts: Record<string, number> = {
    New: 0,
    Learning: 0,
    Review: 0,
    Relearning: 0
  };

  if (stats.distribution && Array.isArray(stats.distribution)) {
    stats.distribution.forEach((item: any) => {
      stateCounts[item.state] = item.count;
    });
  }

  // --- Process Heatmap (Direct pass-through) ---
  const heatmap = stats.heatmap || [];

  // --- Process Forecast (Fill gaps) ---
  const forecastMap = new Map<string, number>();
  // Initialize next 7 days
  for (let i = 0; i < 7; i++) {
    const d = new Date(now.getTime() + i * 24 * 60 * 60 * 1000);
    forecastMap.set(d.toISOString().split('T')[0], 0);
  }
  
  if (stats.forecast) {
    stats.forecast.forEach((item: any) => {
      // Postgres date might be string
      const dateStr = String(item.date); 
      if (forecastMap.has(dateStr)) {
        forecastMap.set(dateStr, item.count);
      }
    });
  }
  const forecast = Array.from(forecastMap.entries()).map(([date, count]) => ({ date, count }));

  // --- Process Growth (Fill gaps) ---
  const growthMap = new Map<string, number>();
  // Initialize last 30 days
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    growthMap.set(d.toISOString().split('T')[0], 0);
  }

  if (stats.growth) {
    stats.growth.forEach((item: any) => {
      const dateStr = String(item.date);
      if (growthMap.has(dateStr)) {
        growthMap.set(dateStr, item.count);
      }
    });
  }
  const growth = Array.from(growthMap.entries()).map(([date, count]) => ({ date, count }));

  res.json({
    metrics: {
      totalCards: stats.metrics.totalCards,
      dueToday: stats.metrics.dueToday,
      learning: stats.metrics.learning,
      avgStability: stats.metrics.avgStability
    },
    heatmap,
    distribution: [
      { name: 'new', value: stateCounts.New, color: '#94a3b8' },
      { name: 'learning', value: stateCounts.Learning, color: '#fbbf24' },
      { name: 'review', value: stateCounts.Review, color: '#4ade80' },
      { name: 'relearning', value: stateCounts.Relearning, color: '#f87171' }
    ],
    forecast,
    growth
  });
});

export default router;

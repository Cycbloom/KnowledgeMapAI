import { Router, type Response } from 'express';
import { requireAuth, type AuthedRequest } from '../middleware/auth';
import { dashboardService } from '../services/common';

const router = Router();

router.get('/stats', requireAuth, async (req: AuthedRequest, res: Response) => {
  const userId = req.user.id;

  const dashboardStats = await dashboardService.getDashboard(req.supabase, userId);
  res.json(dashboardStats);
});

// 首页"今日回顾"摘要：待归档捕获数 + 今日到期卡片 + 今日任务
router.get('/today', requireAuth, async (req: AuthedRequest, res: Response) => {
  const userId = req.user.id;
  const summary = await dashboardService.getTodaySummary(req.supabase, userId);
  res.json(summary);
});

export default router;

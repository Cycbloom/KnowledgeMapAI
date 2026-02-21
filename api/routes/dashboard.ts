import { Router, type Response } from 'express';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import { ErrorCodes } from '../constants/errorCodes.js';
import { AppError } from '../middleware/errorHandler.js';
import { dashboardService } from '../services/dashboardService.js';

const router = Router();

router.get('/stats', requireAuth, async (req: AuthRequest, res: Response) => {
  const userId = req.user.id;

  try {
    const dashboardStats = await dashboardService.getDashboard(req.supabase!, userId);
    res.json(dashboardStats);
  } catch (error) {
    throw new AppError('获取仪表盘数据失败', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

export default router;

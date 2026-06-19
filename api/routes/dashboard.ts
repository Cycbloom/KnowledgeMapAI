import { Router, type Response } from 'express';
import { requireAuth, type AuthRequest } from '../middleware/auth';
import { ErrorCodes } from '../../shared/types/errorCodes';
import { AppError } from '../middleware/errorHandler';
import { dashboardService } from '../services/common';

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

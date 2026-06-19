import { Router, Request, Response } from 'express';
import { achievementService } from '../services/achievementService';
import { achievementEngine } from '../services/achievements';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { ErrorCodes } from '../../shared/types/errorCodes';

const router = Router();

router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthRequest).user.id;
    const achievements = await achievementService.getAchievements(userId);
    res.json(achievements);
  } catch (error) {
    throw new AppError((error as Error).message, 500, ErrorCodes.INTERNAL_ERROR);
  }
});

router.post('/check', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthRequest).user.id;
    const { type, value } = req.body;
    
    if (!type || value === undefined) {
      throw new AppError(ErrorCodes.MISSING_TYPE_OR_VALUE);
    }

    await achievementEngine.calibrateAllProgress(userId);
    res.json({ success: true });
  } catch (error) {
    throw new AppError((error as Error).message, 500, ErrorCodes.INTERNAL_ERROR);
  }
});

router.get('/daily-tasks', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthRequest).user.id;
    const tasks = await achievementService.getDailyTasks(userId);
    res.json(tasks);
  } catch (error) {
    throw new AppError((error as Error).message, 500, ErrorCodes.INTERNAL_ERROR);
  }
});

router.post('/daily-tasks/check-in', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthRequest).user.id;
    await achievementService.initDailyTasks(userId);
    await achievementService.updateDailyTask(userId, 'login', 1);
    res.json({ success: true });
  } catch (error) {
    throw new AppError((error as Error).message, 500, ErrorCodes.INTERNAL_ERROR);
  }
});

export default router;

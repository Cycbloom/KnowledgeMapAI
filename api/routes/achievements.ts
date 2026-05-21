import { Router, Request, Response } from 'express';
import { achievementService } from '../services/achievementService';
import { achievementEngine } from '../services/achievements/achievementEngine';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { ErrorCodes } from '../../shared/types/errorCodes';

const router = Router();

// Get all achievements
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthRequest).user.id;
    const achievements = await achievementService.getAchievements(userId);
    res.json(achievements);
  } catch (error: any) {
    throw new AppError(error.message, 500, ErrorCodes.INTERNAL_ERROR);
  }
});

// Check triggers (manual trigger for now, can be automated later)
router.post('/check', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthRequest).user.id;
    const { type, value } = req.body;
    
    if (!type || value === undefined) {
      throw new AppError(ErrorCodes.MISSING_TYPE_OR_VALUE);
    }

    await achievementEngine.calibrateAllProgress(userId);
    res.json({ success: true });
  } catch (error: any) {
    throw new AppError(error.message, 500, ErrorCodes.INTERNAL_ERROR);
  }
});

// Get daily tasks
router.get('/daily-tasks', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthRequest).user.id;
    const tasks = await achievementService.getDailyTasks(userId);
    res.json(tasks);
  } catch (error: any) {
    throw new AppError(error.message, 500, ErrorCodes.INTERNAL_ERROR);
  }
});

// Daily Check-in
router.post('/daily-tasks/check-in', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthRequest).user.id;
    // Initialize tasks if they don't exist
    await achievementService.initDailyTasks(userId);
    // Mark login task
    await achievementService.updateDailyTask(userId, 'login', 1);
    res.json({ success: true });
  } catch (error: any) {
    throw new AppError(error.message, 500, ErrorCodes.INTERNAL_ERROR);
  }
});

export default router;

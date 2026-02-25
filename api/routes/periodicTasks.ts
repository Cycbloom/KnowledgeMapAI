import { Router, Request, Response } from 'express';
import { periodicTaskService } from '../services/periodicTaskService.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';

const router = Router();

router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthRequest).user.id;
    const tasks = await periodicTaskService.getPeriodicTasks(userId);
    res.json(tasks);
  } catch (error: any) {
    throw new AppError(error.message, 500);
  }
});

router.post('/check', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthRequest).user.id;
    const { taskType, value } = req.body;
    
    if (!taskType || value === undefined) {
      throw new AppError('Missing taskType or value', 400);
    }
    
    const completedTasks = await periodicTaskService.updatePeriodicTaskProgress(userId, taskType, value);
    res.json({ completedTasks });
  } catch (error: any) {
    throw new AppError(error.message, 500);
  }
});

router.get('/pass', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthRequest).user.id;
    const progress = await periodicTaskService.getPassProgress(userId);
    res.json(progress);
  } catch (error: any) {
    throw new AppError(error.message, 500);
  }
});

router.post('/pass/claim', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthRequest).user.id;
    const { passId, level } = req.body;
    
    if (!passId || !level) {
      throw new AppError('Missing passId or level', 400);
    }
    
    const result = await periodicTaskService.claimPassReward(userId, passId, level);
    res.json(result);
  } catch (error: any) {
    throw new AppError(error.message, 500);
  }
});

router.post('/streak/check', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthRequest).user.id;
    const result = await periodicTaskService.checkDailyTaskStreak(userId);
    res.json(result);
  } catch (error: any) {
    throw new AppError(error.message, 500);
  }
});

export default router;

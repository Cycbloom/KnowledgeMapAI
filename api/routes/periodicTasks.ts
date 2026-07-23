import { Router, Request, Response } from 'express';
import { periodicTaskService } from '../services/scheduler';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { ErrorCodes } from '../../shared/types/errorCodes';

const router = Router();

router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthRequest).user.id;
    const tasks = await periodicTaskService.getPeriodicTasks(userId);
    res.json(tasks);
  } catch (error) {
    throw new AppError((error as Error).message, 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
  }
});

router.post('/check', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthRequest).user.id;
    const { taskType, value } = req.body;
    
    if (!taskType || value === undefined) {
      throw new AppError(ErrorCodes.VALIDATION_MISSING_FIELD);
    }
    
    const completedTasks = await periodicTaskService.updatePeriodicTaskProgress(userId, taskType, value);
    res.json({ completedTasks });
  } catch (error) {
    throw new AppError((error as Error).message, 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
  }
});

router.get('/pass', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthRequest).user.id;
    const progress = await periodicTaskService.getPassProgress(userId);
    res.json(progress);
  } catch (error) {
    throw new AppError((error as Error).message, 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
  }
});

router.post('/pass/claim', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthRequest).user.id;
    const { passId, level } = req.body;
    
    if (!passId || !level) {
      throw new AppError(ErrorCodes.VALIDATION_MISSING_FIELD);
    }
    
    const result = await periodicTaskService.claimPassReward(userId, passId, level);
    res.json(result);
  } catch (error) {
    throw new AppError((error as Error).message, 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
  }
});

router.post('/streak/check', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthRequest).user.id;
    const result = await periodicTaskService.checkDailyTaskStreak(userId);
    res.json(result);
  } catch (error) {
    throw new AppError((error as Error).message, 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
  }
});

export default router;

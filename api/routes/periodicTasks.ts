import { Router, Request, Response } from 'express';
import { periodicTaskService } from '../services/scheduler';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { ErrorCodes } from '../../shared/types/errorCodes';

const router = Router();

router.get('/', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as AuthRequest).user.id;
  const tasks = await periodicTaskService.getPeriodicTasks(userId);
  res.json(tasks);
});

router.post('/check', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as AuthRequest).user.id;
  const { taskType, value } = req.body;

  if (!taskType || value === undefined) {
    throw new AppError(ErrorCodes.VALIDATION_MISSING_FIELD);
  }

  const completedTasks = await periodicTaskService.updatePeriodicTaskProgress(userId, taskType, value);
  res.json({ completedTasks });
});

router.get('/pass', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as AuthRequest).user.id;
  const progress = await periodicTaskService.getPassProgress(userId);
  res.json(progress);
});

router.post('/pass/claim', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as AuthRequest).user.id;
  const { passId, level } = req.body;

  if (!passId || !level) {
    throw new AppError(ErrorCodes.VALIDATION_MISSING_FIELD);
  }

  const result = await periodicTaskService.claimPassReward(userId, passId, level);
  res.json(result);
});

router.post('/streak/check', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as AuthRequest).user.id;
  const result = await periodicTaskService.checkDailyTaskStreak(userId);
  res.json(result);
});

export default router;

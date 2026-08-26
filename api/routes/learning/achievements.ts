import { Router, Request, Response } from 'express';
import { achievementService } from '../../services/achievementService';
import { achievementEngine } from '../../services/achievements';
import { requireAuth, AuthRequest } from '../../middleware/auth';
import { AppError } from '../../middleware/errorHandler';
import { ErrorCodes } from '../../../shared/types/errorCodes';

const router = Router();

router.get('/', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as AuthRequest).user.id;
  const achievements = await achievementService.getAchievements(userId);
  res.json(achievements);
});

router.get('/user', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as AuthRequest).user.id;
  const userAchievements = await achievementService.getUserAchievements(userId);
  res.json(userAchievements);
});

router.post('/check', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as AuthRequest).user.id;
  const { type, value } = req.body;

  if (!type || value === undefined) {
    throw new AppError(ErrorCodes.VALIDATION_MISSING_FIELD);
  }

  await achievementEngine.calibrateAllProgress(userId);
  res.json({ success: true });
});

router.get('/daily-tasks', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as AuthRequest).user.id;
  const tasks = await achievementService.getDailyTasks(userId);
  res.json(tasks);
});

router.post('/daily-tasks/check-in', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as AuthRequest).user.id;
  await achievementService.initDailyTasks(userId);
  await achievementService.updateDailyTask(userId, 'login', 1);
  res.json({ success: true });
});

export default router;

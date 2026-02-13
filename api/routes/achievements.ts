import { Router, Request, Response } from 'express';
import { achievementService } from '../services/achievementService.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';

const router = Router();

// Get all achievements
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthRequest).user.id;
    const achievements = await achievementService.getAchievements(userId);
    res.json(achievements);
  } catch (error: any) {
    throw new AppError(error.message, 500);
  }
});

// Check triggers (manual trigger for now, can be automated later)
router.post('/check', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthRequest).user.id;
    const { type, value } = req.body;
    
    if (!type || value === undefined) {
      throw new AppError('Missing type or value', 400);
    }

    const newUnlocks = await achievementService.checkAndUnlock(userId, type, value);
    res.json({ newUnlocks });
  } catch (error: any) {
    throw new AppError(error.message, 500);
  }
});

export default router;

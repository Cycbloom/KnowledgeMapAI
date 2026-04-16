import { Router, type Response } from 'express';
import { requireAuth, type AuthRequest } from '../middleware/auth';
import { z } from 'zod';
import { validate } from '../middleware/validate';
import { focusService } from '../services/scheduler/focusService';
import { achievementService } from '../services/achievementService';
import { logger } from '../utils/logger';

const router = Router();

const createSessionSchema = z.object({
  body: z.object({
    duration: z.number().int().positive(),
    mode: z.enum(['focus', 'shortBreak', 'longBreak']),
    start_time: z.string().datetime(),
    end_time: z.string().datetime(),
    completed: z.boolean().optional(),
  }),
});

router.post('/sessions', requireAuth, validate(createSessionSchema), async (req: AuthRequest, res: Response) => {
  const { duration, mode, start_time, end_time, completed = true } = req.body;
  const supabase = req.supabase;

  if (!supabase) {
    return res.status(500).json({ error: 'Database connection not available' });
  }

  const session = await focusService.createFocusSession(supabase, req.user.id, {
    started_at: start_time,
    ended_at: end_time,
    duration,
    is_break: mode !== 'focus',
  });

  if (completed) {
    achievementService.updateFocusStats(req.user.id).catch(err => logger.error('Focus stats update failed:', err));
  }

  res.status(201).json({ success: true, data: session });
});

router.get('/stats', requireAuth, async (req: AuthRequest, res: Response) => {
  const supabase = req.supabase;

  if (!supabase) {
    return res.status(500).json({ error: 'Database connection not available' });
  }

  const stats = await focusService.getUserFocusStats(supabase, req.user.id);
  res.json({ success: true, data: stats });
});

router.get('/sessions', requireAuth, async (req: AuthRequest, res: Response) => {
  const supabase = req.supabase;
  const limit = parseInt(req.query.limit as string) || 20;

  if (!supabase) {
    return res.status(500).json({ error: 'Database connection not available' });
  }

  const sessions = await focusService.getFocusSessions(supabase, req.user.id, { limit });
  res.json({ success: true, data: sessions });
});

router.get('/today', requireAuth, async (req: AuthRequest, res: Response) => {
  const supabase = req.supabase;

  if (!supabase) {
    return res.status(500).json({ error: 'Database connection not available' });
  }

  const todayStats = await focusService.getDailyFocusStats(supabase, req.user.id);
  res.json({ success: true, data: todayStats });
});

export default router;

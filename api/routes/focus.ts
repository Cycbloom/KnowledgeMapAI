import { Router, type Response } from 'express';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { focusService } from '../services/focusService.js';
import { achievementService } from '../services/achievementService.js';
import { logger } from '../utils/logger.js';

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

  const session = await focusService.createSession(supabase, req.user.id, {
    duration,
    mode,
    start_time,
    end_time,
    completed,
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

  const stats = await focusService.getStats(supabase, req.user.id);
  res.json({ success: true, data: stats });
});

router.get('/sessions', requireAuth, async (req: AuthRequest, res: Response) => {
  const supabase = req.supabase;
  const limit = parseInt(req.query.limit as string) || 20;
  const offset = parseInt(req.query.offset as string) || 0;

  if (!supabase) {
    return res.status(500).json({ error: 'Database connection not available' });
  }

  const sessions = await focusService.getSessions(supabase, req.user.id, { limit, offset });
  res.json({ success: true, data: sessions });
});

router.get('/today', requireAuth, async (req: AuthRequest, res: Response) => {
  const supabase = req.supabase;

  if (!supabase) {
    return res.status(500).json({ error: 'Database connection not available' });
  }

  const todayStats = await focusService.getTodayStats(supabase, req.user.id);
  res.json({ success: true, data: todayStats });
});

export default router;

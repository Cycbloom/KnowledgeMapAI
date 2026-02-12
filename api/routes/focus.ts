import { Router, type Response } from 'express';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';

const router = Router();

// Validation schema for saving a session
const createSessionSchema = z.object({
  body: z.object({
    duration: z.number().int().positive(),
    mode: z.enum(['focus', 'shortBreak', 'longBreak']),
    start_time: z.string().datetime(),
    end_time: z.string().datetime(),
    completed: z.boolean().optional(),
  }),
});

/**
 * @openapi
 * /focus/sessions:
 *   post:
 *     summary: Save a focus session
 *     tags: [Focus]
 *     security:
 *       - bearerAuth: []
 */
router.post('/sessions', requireAuth, validate(createSessionSchema), async (req: AuthRequest, res: Response) => {
  const { duration, mode, start_time, end_time, completed = true } = req.body;
  const supabase = req.supabase;

  const { data, error } = await supabase
    .from('focus_sessions')
    .insert({
      user_id: req.user?.id,
      duration,
      mode,
      start_time,
      end_time,
      completed,
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  res.status(201).json({ success: true, data });
});

/**
 * @openapi
 * /focus/stats:
 *   get:
 *     summary: Get focus statistics
 *     tags: [Focus]
 *     security:
 *       - bearerAuth: []
 */
router.get('/stats', requireAuth, async (req: AuthRequest, res: Response) => {
  const supabase = req.supabase;
  const userId = req.user?.id;

  // Get all sessions for the user
  const { data: sessions, error } = await supabase
    .from('focus_sessions')
    .select('*')
    .eq('user_id', userId)
    .eq('completed', true)
    .order('start_time', { ascending: false });

  if (error) throw error;

  // Calculate statistics
  const totalSessions = sessions.length;
  const totalDuration = sessions.reduce((acc, curr) => acc + curr.duration, 0); // in minutes

  // Today's stats
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todaySessions = sessions.filter(s => new Date(s.start_time) >= today);
  const todayDuration = todaySessions.reduce((acc, curr) => acc + curr.duration, 0);

  // Stats by mode
  const byMode = sessions.reduce((acc: any, curr) => {
    acc[curr.mode] = (acc[curr.mode] || 0) + curr.duration;
    return acc;
  }, { focus: 0, shortBreak: 0, longBreak: 0 });

  // Last 7 days daily stats
  const last7Days = new Array(7).fill(0).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - i);
    d.setHours(0, 0, 0, 0);
    const dateStr = d.toISOString().split('T')[0];
    
    const daySessions = sessions.filter(s => {
      const sDate = new Date(s.start_time);
      sDate.setHours(0, 0, 0, 0);
      return sDate.toISOString().split('T')[0] === dateStr;
    });

    return {
      date: dateStr,
      minutes: daySessions.filter(s => s.mode === 'focus').reduce((acc, s) => acc + s.duration, 0),
      count: daySessions.filter(s => s.mode === 'focus').length
    };
  }).reverse();

  res.json({
    success: true,
    data: {
      total: {
        sessions: totalSessions,
        minutes: totalDuration,
      },
      today: {
        sessions: todaySessions.length,
        minutes: todayDuration,
      },
      byMode,
      daily: last7Days
    }
  });
});

export default router;

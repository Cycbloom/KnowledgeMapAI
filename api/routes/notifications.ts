import { Router, Response } from 'express';
import { requireAuth, type AuthRequest } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { z } from 'zod';
import { notificationService } from '../services/common';

const router = Router();

const createNotificationSchema = z.object({
  type: z.enum([
    'task_start',
    'task_complete',
    'time_slice_end',
    'deadline',
    'break_start',
    'break_end',
    'daily_summary',
    'system',
  ]),
  title: z.string().min(1).max(255),
  message: z.string().optional(),
  data: z.record(z.any()).optional(),
  expires_at: z.string().optional(),
});

const updateSettingsSchema = z.object({
  browser_enabled: z.boolean().optional(),
  sound_enabled: z.boolean().optional(),
  sound_volume: z.number().min(0).max(100).optional(),
  task_start_enabled: z.boolean().optional(),
  task_complete_enabled: z.boolean().optional(),
  time_slice_end_enabled: z.boolean().optional(),
  deadline_enabled: z.boolean().optional(),
  break_enabled: z.boolean().optional(),
  daily_summary_enabled: z.boolean().optional(),
  deadline_reminder_minutes: z.array(z.number()).optional(),
  do_not_disturb_enabled: z.boolean().optional(),
  do_not_disturb_start: z.string().optional(),
  do_not_disturb_end: z.string().optional(),
});

router.get(
  '/',
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const limit = parseInt(req.query.limit as string) || 20;
    const unreadOnly = req.query.unread_only === 'true';

    const data = await notificationService.list(req.supabase!, req.user.id, { limit, unreadOnly });
    res.json({ success: true, data });
  },
);

router.get(
  '/unread-count',
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const count = await notificationService.getUnreadCount(req.supabase!, req.user.id);
    res.json({ success: true, count });
  },
);

router.post(
  '/',
  requireAuth,
  validate({ body: createNotificationSchema }),
  async (req: AuthRequest, res: Response) => {
    const { type, title, message, data, expires_at } = req.body;

    const notification = await notificationService.create(req.supabase!, req.user.id, { type, title, message, data, expires_at });
    res.json({ success: true, data: notification });
  },
);

router.put(
  '/:id/read',
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const { id } = req.params;

    await notificationService.markAsRead(req.supabase!, req.user.id, id);
    res.json({ success: true });
  },
);

router.put(
  '/read-all',
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    await notificationService.markAllAsRead(req.supabase!, req.user.id);
    res.json({ success: true });
  },
);

router.delete(
  '/:id',
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const { id } = req.params;

    await notificationService.delete(req.supabase!, req.user.id, id);
    res.json({ success: true });
  },
);

router.delete(
  '/clear-all',
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    await notificationService.clearAll(req.supabase!, req.user.id);
    res.json({ success: true });
  },
);

router.get(
  '/settings',
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const data = await notificationService.getSettings(req.supabase!, req.user.id);
    res.json({ success: true, data });
  },
);

router.put(
  '/settings',
  requireAuth,
  validate({ body: updateSettingsSchema }),
  async (req: AuthRequest, res: Response) => {
    const { ...updates } = req.body;

    const data = await notificationService.updateSettings(req.supabase!, req.user.id, updates);
    res.json({ success: true, data });
  },
);

export default router;

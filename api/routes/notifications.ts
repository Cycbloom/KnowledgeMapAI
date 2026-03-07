import { Router, Response } from 'express';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { z } from 'zod';
import { logger } from '../utils/logger.js';

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
    const supabase = req.supabase;
    if (!supabase) {
      return res.status(500).json({ error: 'Database connection not available' });
    }

    const limit = parseInt(req.query.limit as string) || 20;
    const unreadOnly = req.query.unread_only === 'true';

    let query = supabase
      .from('notifications')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (unreadOnly) {
      query = query.is('read_at', null);
    }

    const { data, error } = await query;

    if (error) {
      logger.error('Get notifications error:', error);
      return res.status(500).json({ error: '获取通知失败' });
    }

    res.json({ success: true, data });
  },
);

router.get(
  '/unread-count',
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      return res.status(500).json({ error: 'Database connection not available' });
    }

    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', req.user.id)
      .is('read_at', null);

    if (error) {
      logger.error('Get unread count error:', error);
      return res.status(500).json({ error: '获取未读数量失败' });
    }

    res.json({ success: true, count: count || 0 });
  },
);

router.post(
  '/',
  requireAuth,
  validate({ body: createNotificationSchema }),
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      return res.status(500).json({ error: 'Database connection not available' });
    }

    const { type, title, message, data, expires_at } = req.body;

    const { data: notification, error } = await supabase
      .from('notifications')
      .insert({
        user_id: req.user.id,
        type,
        title,
        message,
        data,
        expires_at,
      })
      .select()
      .single();

    if (error) {
      logger.error('Create notification error:', error);
      return res.status(500).json({ error: '创建通知失败' });
    }

    res.json({ success: true, data: notification });
  },
);

router.put(
  '/:id/read',
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      return res.status(500).json({ error: 'Database connection not available' });
    }

    const { id } = req.params;

    const { error } = await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', req.user.id);

    if (error) {
      logger.error('Mark as read error:', error);
      return res.status(500).json({ error: '标记已读失败' });
    }

    res.json({ success: true });
  },
);

router.put(
  '/read-all',
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      return res.status(500).json({ error: 'Database connection not available' });
    }

    const { error } = await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('user_id', req.user.id)
      .is('read_at', null);

    if (error) {
      logger.error('Mark all as read error:', error);
      return res.status(500).json({ error: '全部标记已读失败' });
    }

    res.json({ success: true });
  },
);

router.delete(
  '/:id',
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      return res.status(500).json({ error: 'Database connection not available' });
    }

    const { id } = req.params;

    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', id)
      .eq('user_id', req.user.id);

    if (error) {
      logger.error('Delete notification error:', error);
      return res.status(500).json({ error: '删除通知失败' });
    }

    res.json({ success: true });
  },
);

router.delete(
  '/clear-all',
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      return res.status(500).json({ error: 'Database connection not available' });
    }

    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('user_id', req.user.id);

    if (error) {
      logger.error('Clear all notifications error:', error);
      return res.status(500).json({ error: '清空通知失败' });
    }

    res.json({ success: true });
  },
);

router.get(
  '/settings',
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      return res.status(500).json({ error: 'Database connection not available' });
    }

    const { data, error } = await supabase
      .from('notification_settings')
      .select('*')
      .eq('user_id', req.user.id)
      .single();

    if (error && error.code !== 'PGRST116') {
      logger.error('Get notification settings error:', error);
      return res.status(500).json({ error: '获取通知设置失败' });
    }

    if (!data) {
      const { data: newSettings, error: createError } = await supabase
        .from('notification_settings')
        .insert({ user_id: req.user.id })
        .select()
        .single();

      if (createError) {
        logger.error('Create notification settings error:', createError);
        return res.status(500).json({ error: '创建通知设置失败' });
      }

      return res.json({ success: true, data: newSettings });
    }

    res.json({ success: true, data });
  },
);

router.put(
  '/settings',
  requireAuth,
  validate({ body: updateSettingsSchema }),
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      return res.status(500).json({ error: 'Database connection not available' });
    }

    const { ...updates } = req.body;

    const { data, error } = await supabase
      .from('notification_settings')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', req.user.id)
      .select()
      .single();

    if (error) {
      logger.error('Update notification settings error:', error);
      return res.status(500).json({ error: '更新通知设置失败' });
    }

    res.json({ success: true, data });
  },
);

export default router;

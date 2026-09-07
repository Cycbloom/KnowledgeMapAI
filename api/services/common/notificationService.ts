import { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '../../utils/logger';

export interface ListNotificationsOptions {
  limit?: number;
  unreadOnly?: boolean;
}

export interface CreateNotificationData {
  type: string;
  title: string;
  message?: string;
  data?: Record<string, unknown>;
  expires_at?: string;
}

export interface UpdateNotificationSettingsData {
  browser_enabled?: boolean;
  sound_enabled?: boolean;
  sound_volume?: number;
  task_start_enabled?: boolean;
  task_complete_enabled?: boolean;
  time_slice_end_enabled?: boolean;
  deadline_enabled?: boolean;
  break_enabled?: boolean;
  daily_summary_enabled?: boolean;
  deadline_reminder_minutes?: number[];
  do_not_disturb_enabled?: boolean;
  do_not_disturb_start?: string;
  do_not_disturb_end?: string;
}

class NotificationService {
  async list(supabase: SupabaseClient, userId: string, options: ListNotificationsOptions = {}) {
    const limit = options.limit ?? 20;
    const unreadOnly = options.unreadOnly ?? false;

    let query = supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (unreadOnly) {
      query = query.is('read_at', null);
    }

    const { data, error } = await query;

    if (error) {
      logger.error('Get notifications error:', error);
      throw error;
    }

    return data;
  }

  async getUnreadCount(supabase: SupabaseClient, userId: string): Promise<number> {
    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .is('read_at', null);

    if (error) {
      logger.error('Get unread count error:', error);
      throw error;
    }

    return count ?? 0;
  }

  async create(supabase: SupabaseClient, userId: string, data: CreateNotificationData) {
    const { data: notification, error } = await supabase
      .from('notifications')
      .insert({
        user_id: userId,
        type: data.type,
        title: data.title,
        message: data.message,
        data: data.data,
        expires_at: data.expires_at,
      })
      .select()
      .single();

    if (error) {
      logger.error('Create notification error:', error);
      throw error;
    }

    return notification;
  }

  async markAsRead(supabase: SupabaseClient, userId: string, notificationId: string): Promise<void> {
    const { error } = await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', notificationId)
      .eq('user_id', userId);

    if (error) {
      logger.error('Mark as read error:', error);
      throw error;
    }
  }

  async markAllAsRead(supabase: SupabaseClient, userId: string): Promise<void> {
    const { error } = await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('user_id', userId)
      .is('read_at', null);

    if (error) {
      logger.error('Mark all as read error:', error);
      throw error;
    }
  }

  async delete(supabase: SupabaseClient, userId: string, notificationId: string): Promise<void> {
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', notificationId)
      .eq('user_id', userId);

    if (error) {
      logger.error('Delete notification error:', error);
      throw error;
    }
  }

  async clearAll(supabase: SupabaseClient, userId: string): Promise<void> {
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('user_id', userId);

    if (error) {
      logger.error('Clear all notifications error:', error);
      throw error;
    }
  }

  async getSettings(supabase: SupabaseClient, userId: string) {
    const { data, error } = await supabase
      .from('notification_settings')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') {
      logger.error('Get notification settings error:', error);
      throw error;
    }

    if (!data) {
      const { data: newSettings, error: createError } = await supabase
        .from('notification_settings')
        .insert({ user_id: userId })
        .select()
        .single();

      if (createError) {
        logger.error('Create notification settings error:', createError);
        throw createError;
      }

      return newSettings;
    }

    return data;
  }

  async updateSettings(supabase: SupabaseClient, userId: string, updates: UpdateNotificationSettingsData) {
    const { data, error } = await supabase
      .from('notification_settings')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      logger.error('Update notification settings error:', error);
      throw error;
    }

    return data;
  }

  /**
   * 判断当前是否处于用户设置的免打扰（DND）时段。
   *
   * 支持跨午夜区间（如 22:00 → 08:00）。DND 期间应抑制主动推送
   * （SSE / toast / 浏览器通知），但落库仍保留（用户醒来可查看）。
   * 读取失败时返回 false（保守：不误吞通知）。
   */
  async isInDoNotDisturb(
    supabase: SupabaseClient,
    userId: string,
    now: Date = new Date(),
  ): Promise<boolean> {
    try {
      const { data: settings } = await supabase
        .from('notification_settings')
        .select('do_not_disturb_enabled, do_not_disturb_start, do_not_disturb_end')
        .eq('user_id', userId)
        .maybeSingle();

      if (!settings?.do_not_disturb_enabled) return false;

      const start = (settings.do_not_disturb_start as string) || '22:00';
      const end = (settings.do_not_disturb_end as string) || '08:00';

      const toMinutes = (time: string): number => {
        const [h, m] = time.split(':').map(Number);
        return (h ?? 0) * 60 + (m ?? 0);
      };

      const current = now.getHours() * 60 + now.getMinutes();
      const startMin = toMinutes(start);
      const endMin = toMinutes(end);

      if (startMin === endMin) return false;
      // 跨午夜区间（start > end）：now >= start 或 now < end
      if (startMin > endMin) return current >= startMin || current < endMin;
      return current >= startMin && current < endMin;
    } catch (error) {
      logger.error('isInDoNotDisturb error:', error);
      return false;
    }
  }
}

export const notificationService = new NotificationService();

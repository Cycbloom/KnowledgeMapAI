export type NotificationType =
  | 'task_start'
  | 'task_complete'
  | 'time_slice_end'
  | 'deadline'
  | 'break_start'
  | 'break_end'
  | 'daily_summary'
  | 'system';

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  message?: string;
  data?: Record<string, any>;
  read_at?: string;
  created_at: string;
  expires_at?: string;
}

export interface NotificationSettings {
  id: string;
  user_id: string;
  browser_enabled: boolean;
  sound_enabled: boolean;
  sound_volume: number;
  task_start_enabled: boolean;
  task_complete_enabled: boolean;
  time_slice_end_enabled: boolean;
  deadline_enabled: boolean;
  break_enabled: boolean;
  daily_summary_enabled: boolean;
  deadline_reminder_minutes: number[];
  do_not_disturb_enabled: boolean;
  do_not_disturb_start: string;
  do_not_disturb_end: string;
  created_at: string;
  updated_at: string;
}

export interface CreateNotificationData {
  type: NotificationType;
  title: string;
  message?: string;
  data?: Record<string, any>;
  expires_at?: string;
}

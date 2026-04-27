-- =====================================================
-- Knowledge Map - Focus & Notifications
-- =====================================================

-- Focus sessions table
CREATE TABLE IF NOT EXISTS focus_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  task_id UUID,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  duration INTEGER NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('focus', 'shortBreak', 'longBreak')),
  completed BOOLEAN DEFAULT TRUE,
  pomodoro_count INTEGER DEFAULT 0,
  white_noise_type TEXT,
  is_break BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE focus_sessions IS '专注会话记录表，跟踪番茄钟和专注时段';
COMMENT ON COLUMN focus_sessions.duration IS '会话时长（秒）';
COMMENT ON COLUMN focus_sessions.mode IS '会话模式：focus(专注), shortBreak(短休息), longBreak(长休息)';
COMMENT ON COLUMN focus_sessions.pomodoro_count IS '本次会话完成的番茄钟数';
COMMENT ON COLUMN focus_sessions.white_noise_type IS '白噪音类型';
COMMENT ON COLUMN focus_sessions.is_break IS '是否为休息时段';

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT,
  data JSONB DEFAULT '{}',
  read_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE
);

COMMENT ON TABLE notifications IS 'User notifications for task reminders and alerts';
COMMENT ON COLUMN notifications.type IS 'Notification type: task_start, task_complete, time_slice_end, deadline, break_start, break_end, daily_summary, system';
COMMENT ON COLUMN notifications.data IS 'Additional data (e.g., taskId, taskTitle)';
COMMENT ON COLUMN notifications.expires_at IS 'When this notification should be auto-deleted';

-- Notification settings table
CREATE TABLE IF NOT EXISTS notification_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  browser_enabled BOOLEAN DEFAULT TRUE,
  sound_enabled BOOLEAN DEFAULT TRUE,
  sound_volume INTEGER DEFAULT 50,
  task_start_enabled BOOLEAN DEFAULT TRUE,
  task_complete_enabled BOOLEAN DEFAULT TRUE,
  time_slice_end_enabled BOOLEAN DEFAULT FALSE,
  deadline_enabled BOOLEAN DEFAULT TRUE,
  break_enabled BOOLEAN DEFAULT TRUE,
  daily_summary_enabled BOOLEAN DEFAULT FALSE,
  deadline_reminder_minutes INTEGER[] DEFAULT ARRAY[30, 60],
  do_not_disturb_enabled BOOLEAN DEFAULT FALSE,
  do_not_disturb_start TIME DEFAULT '22:00',
  do_not_disturb_end TIME DEFAULT '08:00',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE notification_settings IS 'User preferences for notifications';
COMMENT ON COLUMN notification_settings.deadline_reminder_minutes IS 'Minutes before deadline to send reminder (e.g., 30, 60, 1440)';
COMMENT ON COLUMN notification_settings.do_not_disturb_enabled IS 'Whether do-not-disturb mode is enabled';
COMMENT ON COLUMN notification_settings.do_not_disturb_start IS 'Do-not-disturb start time';
COMMENT ON COLUMN notification_settings.do_not_disturb_end IS 'Do-not-disturb end time';

-- User efficiency profile table
CREATE TABLE IF NOT EXISTS user_efficiency_profile (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  hourly_efficiency JSONB DEFAULT '{}',
  tag_efficiency JSONB DEFAULT '{}',
  queue_efficiency JSONB DEFAULT '{}',
  peak_hours INTEGER[] DEFAULT '{}',
  low_hours INTEGER[] DEFAULT '{}',
  last_updated TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE user_efficiency_profile IS '用户效率画像，用于智能调度';
COMMENT ON COLUMN user_efficiency_profile.hourly_efficiency IS '各时段效率统计，结构: {"0": 0.85, "1": 0.72, ...}';
COMMENT ON COLUMN user_efficiency_profile.tag_efficiency IS '各标签效率统计，结构: {"学习": {"avgDuration": 30, "completionRate": 0.85}, ...}';
COMMENT ON COLUMN user_efficiency_profile.queue_efficiency IS '各队列效率统计，结构: {"0": {"avgDuration": 25, "completionRate": 0.9}, ...}';
COMMENT ON COLUMN user_efficiency_profile.peak_hours IS '高效时段列表（小时）';
COMMENT ON COLUMN user_efficiency_profile.low_hours IS '低效时段列表（小时）';

CREATE TABLE IF NOT EXISTS user_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL CHECK (activity_type IN ('focus_study', 'review', 'path_progress')),
  title TEXT NOT NULL,
  description TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  duration INTEGER,
  metadata JSONB DEFAULT '{}',
  knowledge_point_id UUID REFERENCES knowledge_points(id) ON DELETE SET NULL,
  graph_id UUID REFERENCES knowledge_graphs(id) ON DELETE SET NULL,
  task_id UUID REFERENCES user_tasks(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE user_activities IS '用户活动记录表，追踪用户在应用内的各类操作';
COMMENT ON COLUMN user_activities.activity_type IS '活动类型：focus_study, review, path_progress';
COMMENT ON COLUMN user_activities.duration IS '活动持续时间（秒）';
COMMENT ON COLUMN user_activities.metadata IS '活动额外数据，如评分、模式等';

CREATE INDEX IF NOT EXISTS idx_user_activities_user_id ON user_activities(user_id);
CREATE INDEX IF NOT EXISTS idx_user_activities_type ON user_activities(activity_type);
CREATE INDEX IF NOT EXISTS idx_user_activities_started_at ON user_activities(started_at);
CREATE INDEX IF NOT EXISTS idx_user_activities_knowledge_point_id ON user_activities(knowledge_point_id);

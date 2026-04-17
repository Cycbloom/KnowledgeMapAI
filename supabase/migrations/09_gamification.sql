-- =====================================================
-- Knowledge Map - Gamification
-- =====================================================

-- Achievements table
CREATE TABLE IF NOT EXISTS achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  category VARCHAR(50) NOT NULL,
  icon VARCHAR(50),
  color TEXT DEFAULT '#3B82F6',
  xp_reward INTEGER DEFAULT 100,
  condition_type VARCHAR(50) NOT NULL,
  condition_value INTEGER NOT NULL,
  is_hidden BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE achievements IS '成就定义表，存储所有可获得的成就';
COMMENT ON COLUMN achievements.code IS '成就唯一标识码';
COMMENT ON COLUMN achievements.category IS '成就分类';
COMMENT ON COLUMN achievements.condition_type IS '解锁条件类型';
COMMENT ON COLUMN achievements.condition_value IS '解锁条件阈值';
COMMENT ON COLUMN achievements.is_hidden IS '是否为隐藏成就';

-- User achievements table
CREATE TABLE IF NOT EXISTS user_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  achievement_id UUID REFERENCES achievements(id) ON DELETE CASCADE,
  progress INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  unlocked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, achievement_id)
);

COMMENT ON TABLE user_achievements IS '用户成就解锁记录';
COMMENT ON COLUMN user_achievements.progress IS '成就进度（0-100）';
COMMENT ON COLUMN user_achievements.metadata IS '成就元数据，如解锁时的具体数值';

-- Periodic tasks table (includes daily, merged from daily_tasks)
CREATE TABLE IF NOT EXISTS periodic_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  period_type TEXT NOT NULL CHECK (period_type IN ('daily', 'weekly', 'monthly', 'quarterly')),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  task_type TEXT NOT NULL CHECK (task_type IN ('focus', 'study', 'create', 'tasks')),
  target INTEGER NOT NULL,
  progress INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),
  xp_reward INTEGER NOT NULL,
  pass_points INTEGER NOT NULL DEFAULT 10,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_user_period_task UNIQUE (user_id, period_type, period_start, task_type)
);

COMMENT ON TABLE periodic_tasks IS '周期性任务表，支持每日/每周/每月/每季度目标（已合并 daily_tasks）';
COMMENT ON COLUMN periodic_tasks.period_type IS '周期类型：daily(每日), weekly(每周), monthly(每月), quarterly(每季度)';
COMMENT ON COLUMN periodic_tasks.task_type IS '任务类型：focus(专注), study(学习), create(创建), tasks(任务)';
COMMENT ON COLUMN periodic_tasks.pass_points IS '完成该任务获得的通行证积分';

-- Periodic passes table
CREATE TABLE IF NOT EXISTS periodic_passes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  period_type TEXT NOT NULL CHECK (period_type IN ('weekly', 'monthly', 'quarterly')),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  total_points INTEGER DEFAULT 0,
  current_level INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, period_type, period_start)
);

COMMENT ON TABLE periodic_passes IS 'User pass progress for each period';

-- Pass rewards table
CREATE TABLE IF NOT EXISTS pass_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_type TEXT NOT NULL CHECK (period_type IN ('weekly', 'monthly', 'quarterly')),
  level INTEGER NOT NULL,
  points_required INTEGER NOT NULL,
  reward_type TEXT NOT NULL CHECK (reward_type IN ('xp', 'achievement', 'badge')),
  reward_value INTEGER,
  achievement_code TEXT,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT DEFAULT '🎁',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(period_type, level)
);

COMMENT ON TABLE pass_rewards IS 'Reward configuration for each pass level';
COMMENT ON COLUMN pass_rewards.reward_type IS '奖励类型：xp(经验), achievement(成就), badge(徽章)';

-- User pass progress table
CREATE TABLE IF NOT EXISTS user_pass_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pass_id UUID NOT NULL REFERENCES periodic_passes(id) ON DELETE CASCADE,
  level INTEGER NOT NULL,
  claimed BOOLEAN DEFAULT FALSE,
  claimed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, pass_id, level)
);

COMMENT ON TABLE user_pass_progress IS 'Track which rewards user has claimed';

-- User focus stats table
CREATE TABLE IF NOT EXISTS user_focus_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  total_focus_seconds BIGINT DEFAULT 0,
  total_sessions INTEGER DEFAULT 0,
  total_pomodoros INTEGER DEFAULT 0,
  total_tasks_completed INTEGER DEFAULT 0,
  current_streak INTEGER DEFAULT 0,
  longest_streak INTEGER DEFAULT 0,
  weekly_streak INTEGER DEFAULT 0,
  monthly_streak INTEGER DEFAULT 0,
  quarterly_streak INTEGER DEFAULT 0,
  daily_task_streak INTEGER DEFAULT 0,
  last_daily_completion DATE,
  last_focus_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE user_focus_stats IS 'Aggregated user focus statistics for quick access';

-- =====================================================
-- Periodic Tasks and Pass System
-- Created: 2026-02-24
-- =====================================================

-- =====================================================
-- EXTEND EXISTING TABLES
-- =====================================================

ALTER TABLE user_focus_stats ADD COLUMN IF NOT EXISTS weekly_streak INTEGER DEFAULT 0;
ALTER TABLE user_focus_stats ADD COLUMN IF NOT EXISTS monthly_streak INTEGER DEFAULT 0;
ALTER TABLE user_focus_stats ADD COLUMN IF NOT EXISTS quarterly_streak INTEGER DEFAULT 0;
ALTER TABLE user_focus_stats ADD COLUMN IF NOT EXISTS daily_task_streak INTEGER DEFAULT 0;
ALTER TABLE user_focus_stats ADD COLUMN IF NOT EXISTS last_daily_completion DATE;

-- =====================================================
-- CREATE NEW TABLES
-- =====================================================

CREATE TABLE IF NOT EXISTS periodic_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  period_type TEXT NOT NULL CHECK (period_type IN ('weekly', 'monthly', 'quarterly')),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  task_type TEXT NOT NULL CHECK (task_type IN ('focus', 'study', 'create', 'tasks')),
  target INTEGER NOT NULL,
  progress INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),
  xp_reward INTEGER NOT NULL,
  pass_points INTEGER NOT NULL DEFAULT 10,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE periodic_tasks IS 'Periodic tasks for weekly, monthly, and quarterly goals';

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

CREATE TABLE IF NOT EXISTS user_pass_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pass_id UUID NOT NULL REFERENCES periodic_passes(id) ON DELETE CASCADE,
  level INTEGER NOT NULL,
  claimed BOOLEAN DEFAULT FALSE,
  claimed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(pass_id, level)
);

COMMENT ON TABLE user_pass_progress IS 'Track which rewards user has claimed';

-- =====================================================
-- INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_periodic_tasks_user ON periodic_tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_periodic_tasks_period ON periodic_tasks(user_id, period_type, period_start);
CREATE INDEX IF NOT EXISTS idx_periodic_tasks_status ON periodic_tasks(user_id, status);

CREATE INDEX IF NOT EXISTS idx_periodic_passes_user ON periodic_passes(user_id);
CREATE INDEX IF NOT EXISTS idx_periodic_passes_period ON periodic_passes(user_id, period_type, period_start);

CREATE INDEX IF NOT EXISTS idx_pass_rewards_period ON pass_rewards(period_type, level);

CREATE INDEX IF NOT EXISTS idx_user_pass_progress_pass ON user_pass_progress(pass_id);
CREATE INDEX IF NOT EXISTS idx_user_pass_progress_user ON user_pass_progress(user_id);

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE periodic_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own periodic tasks" ON periodic_tasks;
CREATE POLICY "Users can view own periodic tasks" 
  ON periodic_tasks FOR SELECT 
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own periodic tasks" ON periodic_tasks;
CREATE POLICY "Users can insert own periodic tasks" 
  ON periodic_tasks FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own periodic tasks" ON periodic_tasks;
CREATE POLICY "Users can update own periodic tasks" 
  ON periodic_tasks FOR UPDATE 
  USING (auth.uid() = user_id);

ALTER TABLE periodic_passes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own periodic passes" ON periodic_passes;
CREATE POLICY "Users can view own periodic passes" 
  ON periodic_passes FOR SELECT 
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own periodic passes" ON periodic_passes;
CREATE POLICY "Users can insert own periodic passes" 
  ON periodic_passes FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own periodic passes" ON periodic_passes;
CREATE POLICY "Users can update own periodic passes" 
  ON periodic_passes FOR UPDATE 
  USING (auth.uid() = user_id);

ALTER TABLE pass_rewards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view pass rewards" ON pass_rewards;
CREATE POLICY "Anyone can view pass rewards" 
  ON pass_rewards FOR SELECT 
  USING (TRUE);

ALTER TABLE user_pass_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own pass progress" ON user_pass_progress;
CREATE POLICY "Users can view own pass progress" 
  ON user_pass_progress FOR SELECT 
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own pass progress" ON user_pass_progress;
CREATE POLICY "Users can insert own pass progress" 
  ON user_pass_progress FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own pass progress" ON user_pass_progress;
CREATE POLICY "Users can update own pass progress" 
  ON user_pass_progress FOR UPDATE 
  USING (auth.uid() = user_id);

-- =====================================================
-- FUNCTIONS
-- =====================================================

CREATE OR REPLACE FUNCTION update_periodic_tasks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS periodic_tasks_updated_at ON periodic_tasks;
CREATE TRIGGER periodic_tasks_updated_at
  BEFORE UPDATE ON periodic_tasks
  FOR EACH ROW EXECUTE FUNCTION update_periodic_tasks_updated_at();

DROP TRIGGER IF EXISTS periodic_passes_updated_at ON periodic_passes;
CREATE TRIGGER periodic_passes_updated_at
  BEFORE UPDATE ON periodic_passes
  FOR EACH ROW EXECUTE FUNCTION update_periodic_tasks_updated_at();

-- =====================================================
-- GRANTS
-- =====================================================

GRANT ALL PRIVILEGES ON periodic_tasks TO authenticated;
GRANT ALL PRIVILEGES ON periodic_passes TO authenticated;
GRANT ALL PRIVILEGES ON user_pass_progress TO authenticated;
GRANT SELECT ON pass_rewards TO authenticated;

GRANT SELECT ON periodic_tasks TO anon;
GRANT SELECT ON periodic_passes TO anon;
GRANT SELECT ON pass_rewards TO anon;
GRANT SELECT ON user_pass_progress TO anon;

-- =====================================================
-- SEED PASS REWARDS CONFIGURATION
-- =====================================================

INSERT INTO pass_rewards (period_type, level, points_required, reward_type, reward_value, name, description, icon) VALUES
-- Weekly Pass (15 levels, 40 points total to complete all tasks = 4 tasks * 10 points each)
('weekly', 1, 10, 'xp', 50, '起步者', '完成第一个周任务', '🌱'),
('weekly', 2, 20, 'xp', 50, '初见成效', '继续努力', '⭐'),
('weekly', 3, 30, 'xp', 75, '渐入佳境', '保持势头', '✨'),
('weekly', 4, 40, 'xp', 75, '周常达人', '完成所有周任务', '🏆'),
('weekly', 5, 50, 'achievement', 0, '周冠军', '连续完成周任务', '🥇'),

-- Monthly Pass (20 levels, ~160 points total)
('monthly', 1, 10, 'xp', 50, '月度起步', '开始你的月度旅程', '📅'),
('monthly', 2, 20, 'xp', 50, '稳步前行', '持续进步', '📈'),
('monthly', 3, 30, 'xp', 75, '小有成就', '月度任务进行中', '🎯'),
('monthly', 4, 40, 'xp', 75, '坚持就是胜利', '保持专注', '💪'),
('monthly', 5, 50, 'xp', 100, '月度中坚', '完成一半目标', '🌟'),
('monthly', 6, 60, 'xp', 100, '势不可挡', '继续冲刺', '🔥'),
('monthly', 7, 70, 'xp', 125, '接近终点', '胜利在望', '💫'),
('monthly', 8, 80, 'xp', 125, '月度精英', '即将完成', '🏅'),
('monthly', 9, 90, 'xp', 150, '月度大师', '几乎完成', '👑'),
('monthly', 10, 100, 'achievement', 0, '月度冠军', '完成所有月任务', '🥇'),
('monthly', 11, 110, 'xp', 150, '超额完成', '超越目标', '🚀'),
('monthly', 12, 120, 'xp', 175, '月度传奇', '持续超越', '💎'),
('monthly', 13, 130, 'xp', 175, '月度神话', '非凡成就', '🌈'),
('monthly', 14, 140, 'xp', 200, '月度至尊', '登峰造极', '🏆'),
('monthly', 15, 150, 'achievement', 0, '月度之神', '完美月度', '⚡'),

-- Quarterly Pass (20 levels, ~480 points total)
('quarterly', 1, 20, 'xp', 75, '季度启程', '开始你的季度旅程', '🗓️'),
('quarterly', 2, 40, 'xp', 75, '季度进展', '稳步前进', '📊'),
('quarterly', 3, 60, 'xp', 100, '季度中坚', '保持势头', '🎯'),
('quarterly', 4, 80, 'xp', 100, '季度精英', '持续努力', '⭐'),
('quarterly', 5, 100, 'xp', 125, '季度达人', '表现优秀', '🌟'),
('quarterly', 6, 120, 'xp', 125, '季度高手', '技艺精湛', '💫'),
('quarterly', 7, 140, 'xp', 150, '季度专家', '专业水准', '🏅'),
('quarterly', 8, 160, 'xp', 150, '季度大师', '登峰造极', '👑'),
('quarterly', 9, 180, 'xp', 175, '季度传奇', '非凡成就', '💎'),
('quarterly', 10, 200, 'achievement', 0, '季度冠军', '完成所有季度任务', '🥇'),
('quarterly', 11, 220, 'xp', 175, '超额完成', '超越目标', '🚀'),
('quarterly', 12, 240, 'xp', 200, '季度神话', '持续超越', '🌈'),
('quarterly', 13, 260, 'xp', 200, '季度至尊', '非凡表现', '🏆'),
('quarterly', 14, 280, 'xp', 225, '季度之神', '登峰造极', '⚡'),
('quarterly', 15, 300, 'achievement', 0, '完美季度', '季度完美表现', '🌟')
ON CONFLICT (period_type, level) DO NOTHING;

-- =====================================================
-- SEED PERIODIC ACHIEVEMENTS
-- =====================================================

INSERT INTO achievements (code, name, description, category, icon, color, xp_reward, condition_type, condition_value, is_hidden) VALUES
-- Weekly streak achievements
('weekly_streak_4', '四周坚持', '连续完成4周所有周任务', 'streak', '📅', '#10B981', 100, 'weekly_streak', 4, FALSE),
('weekly_streak_8', '两月坚持', '连续完成8周所有周任务', 'streak', '📆', '#3B82F6', 200, 'weekly_streak', 8, FALSE),
('weekly_streak_12', '季度坚持', '连续完成12周所有周任务', 'streak', '🗓️', '#8B5CF6', 400, 'weekly_streak', 12, FALSE),

-- Monthly streak achievements
('monthly_streak_3', '三月连冠', '连续完成3个月所有月任务', 'streak', '🏆', '#F59E0B', 300, 'monthly_streak', 3, FALSE),
('monthly_streak_6', '半年传奇', '连续完成6个月所有月任务', 'streak', '👑', '#EC4899', 600, 'monthly_streak', 6, FALSE),
('monthly_streak_12', '年度霸主', '连续完成12个月所有月任务', 'streak', '💎', '#FCD34D', 1500, 'monthly_streak', 12, FALSE),

-- Quarterly streak achievements
('quarterly_streak_2', '半年坚持', '连续完成2个季度所有任务', 'streak', '🌟', '#14B8A6', 500, 'quarterly_streak', 2, FALSE),
('quarterly_streak_4', '年度传奇', '连续完成4个季度所有任务', 'streak', '🏅', '#A855F7', 1000, 'quarterly_streak', 4, FALSE),

-- Daily task streak achievements (extended)
('daily_streak_7', '周常达人', '连续7天完成所有每日任务', 'streak', '🔥', '#F97316', 50, 'daily_task_streak', 7, FALSE),
('daily_streak_14', '两周毅力', '连续14天完成所有每日任务', 'streak', '💪', '#EF4444', 100, 'daily_task_streak', 14, FALSE),
('daily_streak_30', '月度坚持', '连续30天完成所有每日任务', 'streak', '🎯', '#DC2626', 300, 'daily_task_streak', 30, FALSE),
('daily_streak_60', '双月传奇', '连续60天完成所有每日任务', 'streak', '⭐', '#7C3AED', 600, 'daily_task_streak', 60, FALSE),
('daily_streak_100', '百日王者', '连续100天完成所有每日任务', 'streak', '👑', '#FCD34D', 1000, 'daily_task_streak', 100, FALSE)
ON CONFLICT (code) DO NOTHING;

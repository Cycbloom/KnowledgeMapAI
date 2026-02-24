-- =====================================================
-- Focus Sessions and Achievement System Enhancement
-- Created: 2026-02-24
-- =====================================================

-- =====================================================
-- ADD MISSING COLUMNS TO EXISTING TABLES
-- =====================================================

-- Add missing columns to existing focus_sessions table
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'focus_sessions' AND column_name = 'task_id') THEN
    ALTER TABLE focus_sessions ADD COLUMN task_id UUID REFERENCES scheduled_tasks(id) ON DELETE SET NULL;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'focus_sessions' AND column_name = 'pomodoro_count') THEN
    ALTER TABLE focus_sessions ADD COLUMN pomodoro_count INTEGER DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'focus_sessions' AND column_name = 'white_noise_type') THEN
    ALTER TABLE focus_sessions ADD COLUMN white_noise_type TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'focus_sessions' AND column_name = 'is_break') THEN
    ALTER TABLE focus_sessions ADD COLUMN is_break BOOLEAN DEFAULT FALSE;
  END IF;
END $$;

-- Add missing columns to existing achievements table
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'achievements' AND column_name = 'color') THEN
    ALTER TABLE achievements ADD COLUMN color TEXT DEFAULT '#3B82F6';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'achievements' AND column_name = 'is_hidden') THEN
    ALTER TABLE achievements ADD COLUMN is_hidden BOOLEAN DEFAULT FALSE;
  END IF;
END $$;

-- Add missing columns to existing user_achievements table
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_achievements' AND column_name = 'progress') THEN
    ALTER TABLE user_achievements ADD COLUMN progress INTEGER DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_achievements' AND column_name = 'metadata') THEN
    ALTER TABLE user_achievements ADD COLUMN metadata JSONB DEFAULT '{}';
  END IF;
END $$;

-- =====================================================
-- CREATE NEW TABLES
-- =====================================================

-- User focus stats table (aggregated statistics)
CREATE TABLE IF NOT EXISTS user_focus_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  total_focus_seconds BIGINT DEFAULT 0,
  total_sessions INTEGER DEFAULT 0,
  total_pomodoros INTEGER DEFAULT 0,
  total_tasks_completed INTEGER DEFAULT 0,
  current_streak INTEGER DEFAULT 0,
  longest_streak INTEGER DEFAULT 0,
  last_focus_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE user_focus_stats IS 'Aggregated user focus statistics for quick access';

-- =====================================================
-- INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_focus_sessions_user_started ON focus_sessions(user_id, start_time DESC);
CREATE INDEX IF NOT EXISTS idx_focus_sessions_task ON focus_sessions(task_id) WHERE task_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_focus_sessions_break ON focus_sessions(user_id, is_break);

CREATE INDEX IF NOT EXISTS idx_achievements_code ON achievements(code);
CREATE INDEX IF NOT EXISTS idx_achievements_category ON achievements(category);

CREATE INDEX IF NOT EXISTS idx_user_achievements_user ON user_achievements(user_id);
CREATE INDEX IF NOT EXISTS idx_user_achievements_achievement ON user_achievements(achievement_id);
CREATE INDEX IF NOT EXISTS idx_user_achievements_unlocked ON user_achievements(user_id, unlocked_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_focus_stats_user ON user_focus_stats(user_id);

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE focus_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own focus sessions" ON focus_sessions;
CREATE POLICY "Users can view own focus sessions" 
  ON focus_sessions FOR SELECT 
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own focus sessions" ON focus_sessions;
CREATE POLICY "Users can insert own focus sessions" 
  ON focus_sessions FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own focus sessions" ON focus_sessions;
CREATE POLICY "Users can update own focus sessions" 
  ON focus_sessions FOR UPDATE 
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own focus sessions" ON focus_sessions;
CREATE POLICY "Users can delete own focus sessions" 
  ON focus_sessions FOR DELETE 
  USING (auth.uid() = user_id);

ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view achievements" ON achievements;
CREATE POLICY "Anyone can view achievements" 
  ON achievements FOR SELECT 
  USING (TRUE);

DROP POLICY IF EXISTS "Only admins can manage achievements" ON achievements;
CREATE POLICY "Only admins can manage achievements" 
  ON achievements FOR ALL 
  USING (
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
    )
  );

ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own achievements" ON user_achievements;
CREATE POLICY "Users can view own achievements" 
  ON user_achievements FOR SELECT 
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own achievements" ON user_achievements;
CREATE POLICY "Users can insert own achievements" 
  ON user_achievements FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own achievements" ON user_achievements;
CREATE POLICY "Users can update own achievements" 
  ON user_achievements FOR UPDATE 
  USING (auth.uid() = user_id);

ALTER TABLE user_focus_stats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own focus stats" ON user_focus_stats;
CREATE POLICY "Users can view own focus stats" 
  ON user_focus_stats FOR SELECT 
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own focus stats" ON user_focus_stats;
CREATE POLICY "Users can insert own focus stats" 
  ON user_focus_stats FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own focus stats" ON user_focus_stats;
CREATE POLICY "Users can update own focus stats" 
  ON user_focus_stats FOR UPDATE 
  USING (auth.uid() = user_id);

-- =====================================================
-- FUNCTIONS
-- =====================================================

CREATE OR REPLACE FUNCTION update_user_focus_stats()
RETURNS TRIGGER AS $$
DECLARE
  focus_date DATE;
  prev_focus_date DATE;
  new_streak INTEGER;
  col_name TEXT;
BEGIN
  col_name := 'start_time';
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'focus_sessions' AND column_name = 'started_at') THEN
    col_name := 'started_at';
  END IF;
  
  EXECUTE format('SELECT ($1).%I::date', col_name) INTO focus_date USING NEW;
  
  INSERT INTO user_focus_stats (user_id, total_focus_seconds, total_sessions, total_pomodoros, current_streak, longest_streak, last_focus_date)
  VALUES (
    NEW.user_id,
    COALESCE(NEW.duration, 0),
    1,
    COALESCE(NEW.pomodoro_count, 0),
    1,
    1,
    focus_date
  )
  ON CONFLICT (user_id) DO UPDATE SET
    total_focus_seconds = user_focus_stats.total_focus_seconds + COALESCE(NEW.duration, 0),
    total_sessions = user_focus_stats.total_sessions + 1,
    total_pomodoros = user_focus_stats.total_pomodoros + COALESCE(NEW.pomodoro_count, 0),
    last_focus_date = focus_date,
    updated_at = NOW();
  
  IF COALESCE(NEW.is_break, FALSE) = FALSE THEN
    SELECT last_focus_date INTO prev_focus_date 
    FROM user_focus_stats 
    WHERE user_id = NEW.user_id;
    
    IF prev_focus_date IS NOT NULL THEN
      IF prev_focus_date = focus_date - 1 THEN
        new_streak := (SELECT current_streak FROM user_focus_stats WHERE user_id = NEW.user_id) + 1;
        UPDATE user_focus_stats 
        SET current_streak = new_streak,
            longest_streak = GREATEST(longest_streak, new_streak)
        WHERE user_id = NEW.user_id;
      ELSIF prev_focus_date < focus_date - 1 THEN
        UPDATE user_focus_stats 
        SET current_streak = 1
        WHERE user_id = NEW.user_id;
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_focus_session_created ON focus_sessions;
CREATE TRIGGER on_focus_session_created
  AFTER INSERT ON focus_sessions
  FOR EACH ROW
  WHEN (NEW.is_break = FALSE OR NEW.is_break IS NULL)
  EXECUTE FUNCTION update_user_focus_stats();

CREATE OR REPLACE FUNCTION update_stats_on_task_complete()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    UPDATE user_focus_stats 
    SET total_tasks_completed = total_tasks_completed + 1,
        updated_at = NOW()
    WHERE user_id = NEW.user_id;
    
    IF NOT FOUND THEN
      INSERT INTO user_focus_stats (user_id, total_tasks_completed)
      VALUES (NEW.user_id, 1);
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_task_completed ON scheduled_tasks;
CREATE TRIGGER on_task_completed
  AFTER UPDATE ON scheduled_tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_stats_on_task_complete();

CREATE OR REPLACE FUNCTION update_focus_stats_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS user_focus_stats_updated_at ON user_focus_stats;
CREATE TRIGGER user_focus_stats_updated_at
  BEFORE UPDATE ON user_focus_stats
  FOR EACH ROW EXECUTE FUNCTION update_focus_stats_updated_at();

-- =====================================================
-- GRANTS
-- =====================================================

GRANT ALL PRIVILEGES ON focus_sessions TO authenticated;
GRANT ALL PRIVILEGES ON user_achievements TO authenticated;
GRANT ALL PRIVILEGES ON user_focus_stats TO authenticated;
GRANT SELECT ON achievements TO authenticated;

GRANT SELECT ON focus_sessions TO anon;
GRANT SELECT ON achievements TO anon;
GRANT SELECT ON user_achievements TO anon;
GRANT SELECT ON user_focus_stats TO anon;

-- =====================================================
-- SEED DEFAULT ACHIEVEMENTS
-- =====================================================

INSERT INTO achievements (code, name, description, category, icon, color, xp_reward, condition_type, condition_value, is_hidden) VALUES
-- Focus achievements
('first_focus', '初次专注', '完成第一次专注会话', 'focus', '🎯', '#10B981', 10, 'focus_sessions', 1, FALSE),
('focus_1h', '一小时达人', '累计专注时间达到1小时', 'focus', '⏱️', '#3B82F6', 20, 'total_focus_hours', 1, FALSE),
('focus_10h', '专注新手', '累计专注时间达到10小时', 'focus', '🔥', '#F59E0B', 50, 'total_focus_hours', 10, FALSE),
('focus_50h', '专注达人', '累计专注时间达到50小时', 'focus', '💪', '#8B5CF6', 100, 'total_focus_hours', 50, FALSE),
('focus_100h', '专注大师', '累计专注时间达到100小时', 'focus', '🏆', '#EC4899', 200, 'total_focus_hours', 100, FALSE),
('focus_500h', '专注传奇', '累计专注时间达到500小时', 'focus', '👑', '#FCD34D', 500, 'total_focus_hours', 500, FALSE),
('daily_4h', '高效一天', '单日专注时间达到4小时', 'focus', '⚡', '#06B6D4', 50, 'daily_focus_hours', 4, FALSE),
('daily_8h', '极限挑战', '单日专注时间达到8小时', 'focus', '🚀', '#EF4444', 100, 'daily_focus_hours', 8, FALSE),

-- Streak achievements
('streak_3', '三天坚持', '连续专注3天', 'streak', '🌟', '#F97316', 30, 'consecutive_days', 3, FALSE),
('streak_7', '一周达人', '连续专注7天', 'streak', '✨', '#84CC16', 70, 'consecutive_days', 7, FALSE),
('streak_14', '两周毅力', '连续专注14天', 'streak', '💫', '#14B8A6', 140, 'consecutive_days', 14, FALSE),
('streak_30', '月度冠军', '连续专注30天', 'streak', '🏅', '#A855F7', 300, 'consecutive_days', 30, FALSE),
('streak_100', '百日传奇', '连续专注100天', 'streak', '💎', '#F43F5E', 1000, 'consecutive_days', 100, FALSE),

-- Task achievements
('tasks_10', '任务新手', '完成10个任务', 'tasks', '📋', '#6366F1', 30, 'tasks_completed', 10, FALSE),
('tasks_50', '任务达人', '完成50个任务', 'tasks', '📝', '#8B5CF6', 100, 'tasks_completed', 50, FALSE),
('tasks_100', '任务大师', '完成100个任务', 'tasks', '🎖️', '#EC4899', 200, 'tasks_completed', 100, FALSE),
('tasks_500', '任务传奇', '完成500个任务', 'tasks', '🏅', '#F59E0B', 500, 'tasks_completed', 500, FALSE),

-- Pomodoro achievements
('pomodoro_10', '番茄新手', '完成10个番茄钟', 'focus', '🍅', '#EF4444', 20, 'pomodoros_completed', 10, FALSE),
('pomodoro_50', '番茄达人', '完成50个番茄钟', 'focus', '🍅', '#F97316', 50, 'pomodoros_completed', 50, FALSE),
('pomodoro_100', '番茄大师', '完成100个番茄钟', 'focus', '🍅', '#DC2626', 100, 'pomodoros_completed', 100, FALSE),

-- Special achievements
('night_owl', '夜猫子', '在凌晨(0:00-5:00)完成专注会话', 'special', '🦉', '#6366F1', 30, 'special_condition', 1, TRUE),
('early_bird', '早起鸟', '在早晨(5:00-7:00)完成专注会话', 'special', '🐦', '#FBBF24', 30, 'special_condition', 1, TRUE),
('weekend_warrior', '周末战士', '在周末完成4小时专注', 'special', '⚔️', '#8B5CF6', 50, 'special_condition', 1, TRUE),
('perfectionist', '完美主义者', '一天内完成所有计划任务', 'special', '✅', '#10B981', 50, 'special_condition', 1, TRUE),
('multitasker', '多面手', '在一天内完成5个不同任务', 'special', '🎭', '#EC4899', 40, 'special_condition', 1, TRUE)
ON CONFLICT (code) DO NOTHING;

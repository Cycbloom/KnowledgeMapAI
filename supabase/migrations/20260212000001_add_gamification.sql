-- Add XP and Level to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS xp INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS level INTEGER DEFAULT 1;

-- Create achievements table
CREATE TABLE IF NOT EXISTS achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  category VARCHAR(50) NOT NULL, -- 'study', 'focus', 'creation'
  icon VARCHAR(50), -- Lucide icon name
  xp_reward INTEGER DEFAULT 100,
  condition_type VARCHAR(50) NOT NULL, -- 'streak_days', 'focus_minutes', 'cards_mastered'
  condition_value INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create user_achievements table
CREATE TABLE IF NOT EXISTS user_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  achievement_id UUID REFERENCES achievements(id) ON DELETE CASCADE,
  unlocked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, achievement_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_achievements_user ON user_achievements(user_id);

-- RLS
ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;

-- Achievements are public read
CREATE POLICY "Achievements are viewable by everyone" 
  ON achievements FOR SELECT 
  USING (true);

-- User achievements are viewable by owner
CREATE POLICY "Users can view their own achievements" 
  ON user_achievements FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own achievements" 
  ON user_achievements FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- Seed initial achievements
INSERT INTO achievements (code, name, description, category, icon, xp_reward, condition_type, condition_value) VALUES
  ('streak_3', 'Getting Started', 'Maintain a 3-day study streak', 'study', 'Flame', 100, 'streak_days', 3),
  ('streak_7', 'Week Warrior', 'Maintain a 7-day study streak', 'study', 'Zap', 300, 'streak_days', 7),
  ('streak_30', 'Monthly Master', 'Maintain a 30-day study streak', 'study', 'Crown', 1000, 'streak_days', 30),
  ('focus_60', 'Deep Diver', 'Complete 60 minutes of focus time', 'focus', 'Timer', 150, 'focus_minutes', 60),
  ('focus_300', 'Focus Master', 'Complete 300 minutes (5 hours) of focus time', 'focus', 'Brain', 500, 'focus_minutes', 300),
  ('mastery_10', 'First Steps', 'Master 10 knowledge cards', 'study', 'GraduationCap', 100, 'cards_mastered', 10),
  ('mastery_50', 'Knowledge Seeker', 'Master 50 knowledge cards', 'study', 'BookOpen', 300, 'cards_mastered', 50),
  ('mastery_100', 'Expert', 'Master 100 knowledge cards', 'study', 'Trophy', 600, 'cards_mastered', 100)
ON CONFLICT (code) DO NOTHING;

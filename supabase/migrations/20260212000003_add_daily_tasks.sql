-- Create daily_tasks table
CREATE TABLE IF NOT EXISTS daily_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  task_date DATE NOT NULL DEFAULT CURRENT_DATE,
  task_type VARCHAR(50) NOT NULL, -- 'login', 'study_10_cards', 'focus_25_min', 'create_node'
  status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'completed', 'claimed'
  progress INTEGER DEFAULT 0,
  target INTEGER DEFAULT 1,
  xp_reward INTEGER DEFAULT 50,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, task_date, task_type)
);

-- RLS
ALTER TABLE daily_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own daily tasks"
  ON daily_tasks FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_daily_tasks_user_date ON daily_tasks(user_id, task_date);

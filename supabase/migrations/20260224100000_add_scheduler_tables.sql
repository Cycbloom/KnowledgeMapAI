-- =====================================================
-- Three-Layer Feedback Queue Task Scheduler System
-- Created: 2026-02-24
-- =====================================================

-- =====================================================
-- TABLES
-- =====================================================

-- Scheduled tasks table (main task table)
CREATE TABLE IF NOT EXISTS scheduled_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  queue_level INTEGER DEFAULT 0,
  position INTEGER DEFAULT 0,
  estimated_duration INTEGER,
  actual_duration INTEGER,
  deadline TIMESTAMPTZ,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'paused', 'completed', 'cancelled')),
  tags TEXT[] DEFAULT '{}',
  knowledge_point_id UUID,
  priority INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

COMMENT ON TABLE scheduled_tasks IS 'Three-layer feedback queue task scheduler - main task table';
COMMENT ON COLUMN scheduled_tasks.queue_level IS 'Queue level: 0=Q0 (focus), 1=Q1 (standard), 2=Q2 (background)';
COMMENT ON COLUMN scheduled_tasks.position IS 'Position within the queue for ordering';
COMMENT ON COLUMN scheduled_tasks.estimated_duration IS 'Estimated duration in minutes';
COMMENT ON COLUMN scheduled_tasks.actual_duration IS 'Actual duration in minutes';
COMMENT ON COLUMN scheduled_tasks.status IS 'Task status: pending, in_progress, paused, completed, cancelled';

-- Task executions table (execution history)
CREATE TABLE IF NOT EXISTS task_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES scheduled_tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  duration INTEGER,
  queue_level INTEGER,
  status TEXT CHECK (status IN ('completed', 'interrupted', 'time_slice_ended'))
);

COMMENT ON TABLE task_executions IS 'Task execution history for tracking work sessions';
COMMENT ON COLUMN task_executions.duration IS 'Execution duration in seconds';
COMMENT ON COLUMN task_executions.status IS 'Execution result: completed, interrupted, time_slice_ended';

-- Task tags table (user-defined tags)
CREATE TABLE IF NOT EXISTS task_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#3B82F6',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, name)
);

COMMENT ON TABLE task_tags IS 'User-defined task tags for categorization';

-- Task settings table (user preferences)
CREATE TABLE IF NOT EXISTS task_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  q0_time_slice INTEGER DEFAULT 25,
  q1_time_slice INTEGER DEFAULT 50,
  q2_time_slice INTEGER DEFAULT 100,
  break_duration INTEGER DEFAULT 5,
  sound_enabled BOOLEAN DEFAULT TRUE,
  notification_enabled BOOLEAN DEFAULT TRUE
);

COMMENT ON TABLE task_settings IS 'User preferences for task scheduler';
COMMENT ON COLUMN task_settings.q0_time_slice IS 'Q0 queue time slice in minutes (focus tasks)';
COMMENT ON COLUMN task_settings.q1_time_slice IS 'Q1 queue time slice in minutes (standard tasks)';
COMMENT ON COLUMN task_settings.q2_time_slice IS 'Q2 queue time slice in minutes (background tasks)';
COMMENT ON COLUMN task_settings.break_duration IS 'Break duration between tasks in minutes';

-- =====================================================
-- INDEXES
-- =====================================================

-- Scheduled tasks indexes
CREATE INDEX IF NOT EXISTS idx_scheduled_tasks_user_status ON scheduled_tasks(user_id, status);
CREATE INDEX IF NOT EXISTS idx_scheduled_tasks_user_queue_position ON scheduled_tasks(user_id, queue_level, position);
CREATE INDEX IF NOT EXISTS idx_scheduled_tasks_user_deleted ON scheduled_tasks(user_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_scheduled_tasks_user_deadline ON scheduled_tasks(user_id, deadline) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_scheduled_tasks_knowledge_point ON scheduled_tasks(knowledge_point_id) WHERE knowledge_point_id IS NOT NULL;

-- Task executions indexes
CREATE INDEX IF NOT EXISTS idx_task_executions_task ON task_executions(task_id);
CREATE INDEX IF NOT EXISTS idx_task_executions_user_started ON task_executions(user_id, started_at DESC);

-- Task tags indexes
CREATE INDEX IF NOT EXISTS idx_task_tags_user ON task_tags(user_id);
CREATE INDEX IF NOT EXISTS idx_task_tags_user_name ON task_tags(user_id, name);

-- Task settings indexes
CREATE INDEX IF NOT EXISTS idx_task_settings_user ON task_settings(user_id);

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

-- Scheduled tasks RLS
ALTER TABLE scheduled_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own scheduled tasks" 
  ON scheduled_tasks FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own scheduled tasks" 
  ON scheduled_tasks FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own scheduled tasks" 
  ON scheduled_tasks FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own scheduled tasks" 
  ON scheduled_tasks FOR DELETE 
  USING (auth.uid() = user_id);

-- Task executions RLS
ALTER TABLE task_executions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own task executions" 
  ON task_executions FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own task executions" 
  ON task_executions FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own task executions" 
  ON task_executions FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own task executions" 
  ON task_executions FOR DELETE 
  USING (auth.uid() = user_id);

-- Task tags RLS
ALTER TABLE task_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own task tags" 
  ON task_tags FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own task tags" 
  ON task_tags FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own task tags" 
  ON task_tags FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own task tags" 
  ON task_tags FOR DELETE 
  USING (auth.uid() = user_id);

-- Task settings RLS
ALTER TABLE task_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own task settings" 
  ON task_settings FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own task settings" 
  ON task_settings FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own task settings" 
  ON task_settings FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own task settings" 
  ON task_settings FOR DELETE 
  USING (auth.uid() = user_id);

-- =====================================================
-- FUNCTIONS
-- =====================================================

-- Auto-create task settings for new users
CREATE OR REPLACE FUNCTION handle_new_user_task_settings()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO task_settings (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_user_created_task_settings
  AFTER INSERT ON users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user_task_settings();

-- Update timestamp trigger for scheduled_tasks
CREATE OR REPLACE FUNCTION update_scheduled_tasks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER scheduled_tasks_updated_at
  BEFORE UPDATE ON scheduled_tasks
  FOR EACH ROW EXECUTE FUNCTION update_scheduled_tasks_updated_at();

-- =====================================================
-- GRANTS
-- =====================================================

GRANT ALL PRIVILEGES ON scheduled_tasks TO authenticated;
GRANT ALL PRIVILEGES ON task_executions TO authenticated;
GRANT ALL PRIVILEGES ON task_tags TO authenticated;
GRANT ALL PRIVILEGES ON task_settings TO authenticated;

GRANT SELECT ON scheduled_tasks TO anon;
GRANT SELECT ON task_executions TO anon;
GRANT SELECT ON task_tags TO anon;
GRANT SELECT ON task_settings TO anon;

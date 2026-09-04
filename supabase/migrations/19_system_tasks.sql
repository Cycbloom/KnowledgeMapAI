-- =====================================================
-- System Tasks Table
-- =====================================================

CREATE TABLE IF NOT EXISTS system_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'running', 'paused', 'completed', 'failed', 'cancelled')),
  priority INTEGER DEFAULT 5,
  input_data JSONB DEFAULT '{}',
  output_data JSONB DEFAULT '{}',
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  claimed_at TIMESTAMPTZ,
  runtime_progress JSONB DEFAULT '{}'::jsonb,
  scheduled_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE system_tasks IS 'System background tasks (graph expansion, AI generation, etc.) - not visible to users';
COMMENT ON COLUMN system_tasks.task_type IS 'Task type: graph_expansion, ai_generation, knowledge_sync, review_generation';
COMMENT ON COLUMN system_tasks.status IS 'Task status: pending, in_progress, running (claimed and executing), paused, completed, failed, cancelled';
COMMENT ON COLUMN system_tasks.input_data IS 'Input parameters for the task';
COMMENT ON COLUMN system_tasks.output_data IS 'Output/result of the task';
COMMENT ON COLUMN system_tasks.error_message IS 'Error message if task failed';
COMMENT ON COLUMN system_tasks.retry_count IS 'Number of retry attempts';
COMMENT ON COLUMN system_tasks.max_retries IS 'Maximum number of retries allowed';
COMMENT ON COLUMN system_tasks.claimed_at IS '任务被某实例原子 claim 的时间戳，用于乐观锁并发控制（P2-25 asyncTaskService 启动恢复 + 并发控制）';
COMMENT ON COLUMN system_tasks.runtime_progress IS 'Runtime progress for in_progress tasks: { stage, stageLabel, percent (0-100), current, completed, total }. Written by task processors and broadcast via SSE.';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_system_tasks_user_id ON system_tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_system_tasks_status ON system_tasks(status);
CREATE INDEX IF NOT EXISTS idx_system_tasks_task_type ON system_tasks(task_type);
CREATE INDEX IF NOT EXISTS idx_system_tasks_scheduled_at ON system_tasks(scheduled_at) WHERE status = 'pending';
-- 为 claim 查询优化：WHERE id = ? AND status = 'pending'
CREATE INDEX IF NOT EXISTS idx_system_tasks_claimed_at ON system_tasks(claimed_at) WHERE status = 'running';
CREATE INDEX IF NOT EXISTS idx_system_tasks_runtime_progress_gin
  ON system_tasks USING GIN (runtime_progress)
  WHERE runtime_progress IS NOT NULL AND runtime_progress <> '{}'::jsonb;

-- RLS Policies
ALTER TABLE system_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own system tasks"
  ON system_tasks FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own system tasks"
  ON system_tasks FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own system tasks"
  ON system_tasks FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all system tasks"
  ON system_tasks FOR ALL
  USING (auth.role() = 'service_role');

-- Trigger: auto-update updated_at
CREATE TRIGGER system_tasks_updated_at
  BEFORE UPDATE ON system_tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

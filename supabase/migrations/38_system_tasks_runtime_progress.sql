-- =====================================================
-- Add runtime_progress column to system_tasks
-- =====================================================
-- Background tasks (ai_generation / batch_generate_questions /
-- expand_graph / generate_quiz / embedding_generation ...)
-- compute progress per stage and broadcast it via SSE. To survive
-- page refresh / SSE reconnect and keep the progress bar always
-- visible in Task Center, we must persist it to the DB as well.
-- =====================================================

ALTER TABLE system_tasks
  ADD COLUMN IF NOT EXISTS runtime_progress JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN system_tasks.runtime_progress IS
  'Runtime progress for in_progress tasks: { stage, stageLabel, percent (0-100), current, completed, total }. Written by task processors and broadcast via SSE.';

CREATE INDEX IF NOT EXISTS idx_system_tasks_runtime_progress_gin
  ON system_tasks USING GIN (runtime_progress)
  WHERE runtime_progress IS NOT NULL AND runtime_progress <> '{}'::jsonb;

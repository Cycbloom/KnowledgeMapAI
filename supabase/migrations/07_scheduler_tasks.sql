-- =====================================================
-- Knowledge Map - Scheduler & Tasks
-- =====================================================

-- Queues table (configurable task queues)
CREATE TABLE IF NOT EXISTS queues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT 'blue',
  time_slice INTEGER NOT NULL DEFAULT 30,
  priority INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, priority)
);

COMMENT ON TABLE queues IS 'Configurable task queues for each user';
COMMENT ON COLUMN queues.name IS 'Queue display name';
COMMENT ON COLUMN queues.color IS 'Queue color for UI (e.g., cyan, emerald, amber)';
COMMENT ON COLUMN queues.time_slice IS 'Default time slice in minutes for tasks in this queue';
COMMENT ON COLUMN queues.priority IS 'Queue priority (lower = higher priority)';

-- User tasks table (tasks that participate in scheduling: queue-based, SM2, focus sessions)
CREATE TABLE IF NOT EXISTS user_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  queue_id UUID REFERENCES queues(id) ON DELETE SET NULL,
  queue_level INTEGER DEFAULT 0,
  position INTEGER NOT NULL DEFAULT 0,
  estimated_duration INTEGER,
  actual_duration INTEGER,
  deadline TIMESTAMPTZ,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'paused', 'completed', 'cancelled', 'failed')),
  tags TEXT[] DEFAULT '{}',
  knowledge_point_id UUID,
  priority INTEGER DEFAULT 0,
  task_type TEXT DEFAULT 'one_time',
  total_duration INTEGER,
  progress_mode TEXT CHECK (progress_mode IN ('average', 'decreasing', 'increasing', 'custom')),
  progress_percentage INTEGER DEFAULT 0,
  parent_task_id UUID REFERENCES user_tasks(id),
  context TEXT,
  scheduled_start TIMESTAMPTZ,
  scheduled_end TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

COMMENT ON TABLE user_tasks IS 'User tasks that participate in scheduling (queue-based, SM2, focus sessions)';
COMMENT ON COLUMN user_tasks.queue_id IS 'Reference to the queue this task belongs to';
COMMENT ON COLUMN user_tasks.queue_level IS 'Queue level: 0=Q0 (focus), 1=Q1 (standard), 2=Q2 (background)';
COMMENT ON COLUMN user_tasks.position IS 'Position within the queue for ordering';
COMMENT ON COLUMN user_tasks.estimated_duration IS 'Estimated duration in minutes';
COMMENT ON COLUMN user_tasks.actual_duration IS 'Actual duration in minutes';
COMMENT ON COLUMN user_tasks.task_type IS 'Task type: one_time, long_term, periodic, learning, graph_learning, async';
COMMENT ON COLUMN user_tasks.total_duration IS 'Total duration in minutes for long-term tasks';
COMMENT ON COLUMN user_tasks.progress_mode IS 'Progress distribution mode: average, decreasing, increasing, custom';
COMMENT ON COLUMN user_tasks.progress_percentage IS 'Current progress percentage (0-100)';
COMMENT ON COLUMN user_tasks.parent_task_id IS 'Parent task ID for periodic task instances';
COMMENT ON COLUMN user_tasks.context IS 'Task context and metadata (JSONB for flexible task-type-specific data)';

ALTER TABLE user_tasks DROP COLUMN IF EXISTS graph_id;
ALTER TABLE user_tasks DROP COLUMN IF EXISTS knowledge_point_count;
ALTER TABLE user_tasks DROP COLUMN IF EXISTS auto_calculated_duration;
ALTER TABLE user_tasks DROP COLUMN IF EXISTS auto_calculated_deadline;
ALTER TABLE user_tasks DROP COLUMN IF EXISTS context;
ALTER TABLE user_tasks ADD COLUMN IF NOT EXISTS context JSONB DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_user_tasks_context_graph_id ON user_tasks ((context->>'graph_id')) WHERE task_type = 'graph_learning';

-- Task executions table (execution history)
CREATE TABLE IF NOT EXISTS task_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES user_tasks(id) ON DELETE CASCADE,
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

-- Task dependencies table
CREATE TABLE IF NOT EXISTS task_dependencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES user_tasks(id) ON DELETE CASCADE,
  depends_on_task_id UUID NOT NULL REFERENCES user_tasks(id) ON DELETE CASCADE,
  dependency_type TEXT NOT NULL DEFAULT 'strict' CHECK (dependency_type IN ('strict', 'soft')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(task_id, depends_on_task_id)
);

COMMENT ON TABLE task_dependencies IS 'Task dependency relationships for task scheduling';
COMMENT ON COLUMN task_dependencies.dependency_type IS 'strict: must complete before starting, soft: recommended but not required';

-- Task schedules table (periodic task configuration)
CREATE TABLE IF NOT EXISTS task_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_template_id UUID NOT NULL REFERENCES user_tasks(id) ON DELETE CASCADE,
  schedule_type TEXT NOT NULL CHECK (schedule_type IN ('daily', 'weekly', 'custom', 'smart')),
  schedule_config JSONB DEFAULT '{}',
  next_run_at TIMESTAMPTZ,
  last_run_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE task_schedules IS 'Periodic task schedule configuration';
COMMENT ON COLUMN task_schedules.task_template_id IS 'Template task to create instances from';
COMMENT ON COLUMN task_schedules.schedule_type IS 'Schedule type: daily, weekly, custom, smart';
COMMENT ON COLUMN task_schedules.schedule_config IS 'JSON config for schedule (e.g., {"days": [1,3,5], "time": "09:00"})';

-- Task progress plans table
CREATE TABLE IF NOT EXISTS task_progress_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES user_tasks(id) ON DELETE CASCADE,
  plan_date DATE NOT NULL,
  planned_percentage INTEGER NOT NULL,
  actual_percentage INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'skipped')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(task_id, plan_date)
);

COMMENT ON TABLE task_progress_plans IS 'Daily progress plans for long-term tasks';
COMMENT ON COLUMN task_progress_plans.planned_percentage IS 'Planned progress percentage for this day';
COMMENT ON COLUMN task_progress_plans.actual_percentage IS 'Actual progress percentage achieved';

-- User time slots table
CREATE TABLE IF NOT EXISTS user_time_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day_of_week INTEGER CHECK (day_of_week BETWEEN 0 AND 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_available BOOLEAN DEFAULT TRUE,
  label TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, day_of_week, start_time)
);

COMMENT ON TABLE user_time_slots IS 'User available time slots for task scheduling';
COMMENT ON COLUMN user_time_slots.day_of_week IS 'Day of week (0=Sunday, 6=Saturday), null for all days';
COMMENT ON COLUMN user_time_slots.label IS 'Optional label for this time slot (e.g., "Morning Focus")';

-- Task subtasks table
CREATE TABLE IF NOT EXISTS task_subtasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES user_tasks(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
  priority INTEGER DEFAULT 0,
  position INTEGER DEFAULT 0,
  estimated_duration INTEGER,
  actual_duration INTEGER,
  due_date TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  learning_path_node_id UUID,
  knowledge_point_id UUID NOT NULL REFERENCES knowledge_points(id) ON DELETE CASCADE,
  learning_state TEXT DEFAULT 'learning' CHECK (learning_state IN ('learning', 'review', 'practice', 'quiz')),
  mastery_level DECIMAL(5,2) DEFAULT 0.00 CHECK (mastery_level >= 0 AND mastery_level <= 100),
  last_state_change_at TIMESTAMPTZ DEFAULT NOW(),
  state_history JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE task_subtasks IS 'Subtasks for breaking down main tasks, each subtask is bound to one knowledge point';
COMMENT ON COLUMN task_subtasks.learning_path_node_id IS 'Associated learning path node ID';
COMMENT ON COLUMN task_subtasks.knowledge_point_id IS 'Associated knowledge point ID (required, one-to-one binding)';
COMMENT ON COLUMN task_subtasks.learning_state IS 'Learning state machine: learning(once) -> review -> practice -> quiz -> review(cycle)';
COMMENT ON COLUMN task_subtasks.mastery_level IS 'Mastery level (0.00-100.00), synced with knowledge_points.mastery_level';
COMMENT ON COLUMN task_subtasks.last_state_change_at IS 'Timestamp of last learning state change';
COMMENT ON COLUMN task_subtasks.state_history IS 'History of learning state transitions';

-- Task links table
CREATE TABLE IF NOT EXISTS task_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES user_tasks(id) ON DELETE CASCADE,
  link_type TEXT NOT NULL DEFAULT 'web' CHECK (link_type IN ('web', 'file', 'api')),
  title TEXT,
  url TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  metadata JSONB DEFAULT '{}',
  position INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE task_links IS 'External links associated with tasks';
COMMENT ON COLUMN task_links.link_type IS 'Type of link: web (URL), file (local path), api (API endpoint)';

-- Task knowledge points table
CREATE TABLE IF NOT EXISTS task_knowledge_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES user_tasks(id) ON DELETE CASCADE,
  knowledge_point_id UUID NOT NULL REFERENCES knowledge_points(id) ON DELETE CASCADE,
  relevance_score INTEGER DEFAULT 100 CHECK (relevance_score BETWEEN 0 AND 100),
  is_primary BOOLEAN DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(task_id, knowledge_point_id)
);

COMMENT ON TABLE task_knowledge_points IS 'Association between tasks and knowledge points';
COMMENT ON COLUMN task_knowledge_points.relevance_score IS 'How relevant this knowledge point is to the task (0-100)';
COMMENT ON COLUMN task_knowledge_points.is_primary IS 'Whether this is the primary knowledge point for the task';

-- Task templates table
CREATE TABLE IF NOT EXISTS task_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'custom',
  title_template TEXT NOT NULL,
  description_template TEXT,
  estimated_duration INTEGER DEFAULT 25,
  tags TEXT[] DEFAULT '{}',
  priority INTEGER DEFAULT 2,
  is_default BOOLEAN DEFAULT FALSE,
  is_system BOOLEAN DEFAULT FALSE,
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE task_templates IS 'Task templates for quick task creation';
COMMENT ON COLUMN task_templates.category IS 'Template category: study, work, life, health, custom';
COMMENT ON COLUMN task_templates.title_template IS 'Template for task title, supports placeholders like {{topic}}';
COMMENT ON COLUMN task_templates.is_system IS 'Whether this is a system preset template';

-- Task reviews table
CREATE TABLE IF NOT EXISTS task_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_id UUID REFERENCES user_tasks(id) ON DELETE SET NULL,
  review_type TEXT NOT NULL CHECK (review_type IN ('daily', 'task', 'weekly')),
  content TEXT,
  mood TEXT CHECK (mood IN ('great', 'good', 'neutral', 'tired', 'stressed')),
  difficulties TEXT,
  improvements TEXT,
  learnings TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE task_reviews IS 'Task review records for reflection and improvement';
COMMENT ON COLUMN task_reviews.review_type IS 'Review type: daily, task, weekly';
COMMENT ON COLUMN task_reviews.mood IS 'Mood during review: great, good, neutral, tired, stressed';

-- Knowledge review tasks table (SM-2 spaced repetition)
CREATE TABLE IF NOT EXISTS knowledge_review_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  knowledge_point_id UUID NOT NULL REFERENCES knowledge_points(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES user_tasks(id) ON DELETE CASCADE,
  interval_days INTEGER NOT NULL DEFAULT 1,
  ease_factor DECIMAL(3,2) NOT NULL DEFAULT 2.5,
  repetitions INTEGER NOT NULL DEFAULT 0,
  next_review_date TIMESTAMPTZ NOT NULL,
  last_review_date TIMESTAMPTZ,
  last_quality_score INTEGER CHECK (last_quality_score BETWEEN 0 AND 5),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(knowledge_point_id, user_id)
);

COMMENT ON TABLE knowledge_review_tasks IS 'SM-2 间隔重复算法的复习任务记录';
COMMENT ON COLUMN knowledge_review_tasks.interval_days IS '当前复习间隔（天）';
COMMENT ON COLUMN knowledge_review_tasks.ease_factor IS '易遗忘因子 (EF)，默认 2.5，最小 1.3';
COMMENT ON COLUMN knowledge_review_tasks.repetitions IS '连续成功复习次数';
COMMENT ON COLUMN knowledge_review_tasks.next_review_date IS '下次复习日期';
COMMENT ON COLUMN knowledge_review_tasks.last_quality_score IS '上次复习评分 (0-5)';

ALTER TABLE knowledge_graphs ADD COLUMN IF NOT EXISTS task_id UUID REFERENCES user_tasks(id) ON DELETE SET NULL;

COMMENT ON COLUMN knowledge_graphs.task_id IS '关联的学习任务ID，创建图谱时自动创建';

-- =====================================================
-- Knowledge Map - Unified Database Schema
-- Generated: 2026-02-26 (Consolidated Migration)
-- =====================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS vector;

-- Create enum types
CREATE TYPE prompt_scope AS ENUM ('system', 'user', 'graph');
CREATE TYPE knowledge_point_visibility AS ENUM ('private', 'public', 'pending');
CREATE TYPE user_role AS ENUM ('user', 'admin');

-- =====================================================
-- TABLES
-- =====================================================

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255),
  name VARCHAR(100) DEFAULT 'User',
  plan VARCHAR(20) DEFAULT 'free' CHECK (plan IN ('free', 'premium')),
  settings JSONB DEFAULT '{}',
  xp INTEGER DEFAULT 0,
  level INTEGER DEFAULT 1,
  role user_role DEFAULT 'user',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON COLUMN users.role IS 'User role: user (default) or admin';

-- Knowledge graphs table
CREATE TABLE IF NOT EXISTS knowledge_graphs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(512) NOT NULL,
  description TEXT,
  settings JSONB DEFAULT '{}',
  is_public BOOLEAN DEFAULT false,
  is_favorite BOOLEAN DEFAULT false,
  podcast_script TEXT,
  parent_graph_id UUID REFERENCES knowledge_graphs(id) ON DELETE SET NULL,
  last_used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  embedding vector(1024),
  deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Knowledge points table (独立的知识点实体)
CREATE TABLE IF NOT EXISTS knowledge_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(512) NOT NULL,
  content TEXT,
  learning_material TEXT,
  properties JSONB DEFAULT '{}',
  embedding vector(1024),
  visibility knowledge_point_visibility DEFAULT 'private',
  owner_id UUID REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE knowledge_points IS '独立的知识点实体，支持跨图谱复用';
COMMENT ON COLUMN knowledge_points.visibility IS '知识点可见性：private(私有), public(公共), pending(待审核)';
COMMENT ON COLUMN knowledge_points.owner_id IS '知识点所有者，私有知识点仅所有者可见';

-- Graph nodes table (图谱-知识点关联)
CREATE TABLE IF NOT EXISTS graph_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  graph_id UUID NOT NULL REFERENCES knowledge_graphs(id) ON DELETE CASCADE,
  knowledge_point_id UUID NOT NULL REFERENCES knowledge_points(id) ON DELETE CASCADE,
  x_position FLOAT DEFAULT 0,
  y_position FLOAT DEFAULT 0,
  level VARCHAR(20) DEFAULT 'normal' CHECK (level IN ('root', 'core', 'sub', 'normal', 'leaf')),
  is_accepted BOOLEAN DEFAULT TRUE,
  deleted_at TIMESTAMPTZ DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(graph_id, knowledge_point_id)
);

COMMENT ON TABLE graph_nodes IS '图谱与知识点的关联表，存储图谱特定的属性';
COMMENT ON COLUMN graph_nodes.x_position IS '知识点在图谱中的X坐标';
COMMENT ON COLUMN graph_nodes.y_position IS '知识点在图谱中的Y坐标';
COMMENT ON COLUMN graph_nodes.level IS '知识点在图谱中的层级';

-- Edges table
CREATE TABLE IF NOT EXISTS edges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  graph_id UUID REFERENCES knowledge_graphs(id) ON DELETE CASCADE,
  source_knowledge_point_id UUID REFERENCES knowledge_points(id) ON DELETE CASCADE,
  target_knowledge_point_id UUID REFERENCES knowledge_points(id) ON DELETE CASCADE,
  relationship_type VARCHAR(50) DEFAULT 'related',
  weight INTEGER DEFAULT 1,
  custom_label TEXT,
  custom_color TEXT,
  custom_line_style TEXT DEFAULT 'solid',
  show_arrow BOOLEAN,
  deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(source_knowledge_point_id, target_knowledge_point_id, relationship_type),
  CONSTRAINT chk_line_style CHECK (custom_line_style IS NULL OR custom_line_style IN ('solid', 'dashed', 'dotted', 'double'))
);

COMMENT ON COLUMN edges.custom_label IS '自定义标签，覆盖默认的 relationship_type 显示';
COMMENT ON COLUMN edges.custom_color IS '自定义颜色，覆盖关系类型默认颜色';
COMMENT ON COLUMN edges.custom_line_style IS '线型：solid, dashed, dotted, double';
COMMENT ON COLUMN edges.show_arrow IS '是否显示箭头，null表示根据关系类型自动判断';

-- Study cards table
CREATE TABLE IF NOT EXISTS study_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  knowledge_point_id UUID REFERENCES knowledge_points(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  graph_id UUID REFERENCES knowledge_graphs(id) ON DELETE CASCADE,
  source_graph_id UUID REFERENCES knowledge_graphs(id) ON DELETE SET NULL,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  explanation TEXT,
  card_type VARCHAR(20) DEFAULT 'qa' CHECK (card_type IN ('qa', 'choice', 'true_false', 'multi_choice', 'fill_in_the_blank', 'essay')),
  options JSONB DEFAULT NULL,
  difficulty INTEGER DEFAULT 1 CHECK (difficulty BETWEEN 1 AND 5),
  last_reviewed TIMESTAMP WITH TIME ZONE,
  next_review TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  review_count INTEGER DEFAULT 0,
  fsrs_state INTEGER DEFAULT 0,
  fsrs_stability DOUBLE PRECISION DEFAULT 0,
  fsrs_difficulty DOUBLE PRECISION DEFAULT 0,
  fsrs_elapsed_days DOUBLE PRECISION DEFAULT 0,
  fsrs_scheduled_days DOUBLE PRECISION DEFAULT 0,
  fsrs_retrievability DOUBLE PRECISION DEFAULT 0,
  fsrs_last_review TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Study progress table
CREATE TABLE IF NOT EXISTS study_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  graph_id UUID REFERENCES knowledge_graphs(id) ON DELETE CASCADE,
  total_nodes INTEGER DEFAULT 0,
  mastered_nodes INTEGER DEFAULT 0,
  progress_percentage FLOAT DEFAULT 0,
  study_streak INTEGER DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, graph_id)
);

-- Tasks table
CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT,
  type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  payload JSONB DEFAULT '{}'::jsonb,
  result JSONB DEFAULT '{}'::jsonb,
  error TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Templates table
CREATE TABLE IF NOT EXISTS templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(20) NOT NULL CHECK (category IN ('learning', 'story', 'project', 'analysis', 'custom')),
  is_system BOOLEAN DEFAULT false,
  nodes JSONB NOT NULL,
  edges JSONB DEFAULT '[]',
  layout JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Prompt templates table
CREATE TABLE IF NOT EXISTS prompt_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT NOT NULL,
  scope prompt_scope NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  graph_id UUID REFERENCES knowledge_graphs(id) ON DELETE CASCADE,
  template_content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT prompt_templates_user_id_check CHECK (
    (scope = 'system' AND user_id IS NULL) OR
    (scope IN ('user', 'graph') AND user_id IS NOT NULL)
  ),
  CONSTRAINT prompt_templates_graph_id_check CHECK (
    (scope IN ('system', 'user') AND graph_id IS NULL) OR
    (scope = 'graph' AND graph_id IS NOT NULL)
  ),
  UNIQUE (code, scope, user_id, graph_id)
);

-- AI actions table
CREATE TABLE IF NOT EXISTS ai_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  icon VARCHAR(50),
  target_mode VARCHAR(50) NOT NULL CHECK (target_mode IN ('show_result', 'update_node', 'spawn_children')),
  scope VARCHAR(20) NOT NULL CHECK (scope IN ('system', 'user', 'graph')),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  graph_id UUID REFERENCES knowledge_graphs(id) ON DELETE CASCADE,
  prompt_template TEXT NOT NULL,
  variables JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- App settings table
CREATE TABLE IF NOT EXISTS app_settings (
  key VARCHAR(255) PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id)
);

-- Focus sessions table
CREATE TABLE IF NOT EXISTS focus_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  task_id UUID,
  start_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  end_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  duration INTEGER NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('focus', 'shortBreak', 'longBreak')),
  completed BOOLEAN DEFAULT TRUE,
  pomodoro_count INTEGER DEFAULT 0,
  white_noise_type TEXT,
  is_break BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

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

-- User achievements table
CREATE TABLE IF NOT EXISTS user_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  achievement_id UUID REFERENCES achievements(id) ON DELETE CASCADE,
  progress INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  unlocked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, achievement_id)
);

-- Daily tasks table
CREATE TABLE IF NOT EXISTS daily_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  task_date DATE NOT NULL DEFAULT CURRENT_DATE,
  task_type VARCHAR(50) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  progress INTEGER DEFAULT 0,
  target INTEGER DEFAULT 1,
  xp_reward INTEGER DEFAULT 50,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, task_date, task_type)
);

-- Graph relations table
CREATE TABLE IF NOT EXISTS graph_relations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_graph_id UUID REFERENCES knowledge_graphs(id) ON DELETE CASCADE,
  target_graph_id UUID REFERENCES knowledge_graphs(id) ON DELETE CASCADE,
  relation_type VARCHAR(50) NOT NULL CHECK (relation_type IN ('prerequisite', 'extension', 'related')),
  context TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(source_graph_id, target_graph_id, relation_type)
);

-- Backup snapshots table
CREATE TABLE IF NOT EXISTS backup_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(20) NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT DEFAULT 0,
  graphs_count INTEGER DEFAULT 0,
  nodes_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add comments
COMMENT ON TABLE graph_relations IS 'Stores relationships between knowledge graphs (prerequisite, extension, related)';
COMMENT ON COLUMN graph_relations.source_graph_id IS 'The graph that has the dependency';
COMMENT ON COLUMN graph_relations.target_graph_id IS 'The graph that is depended upon';
COMMENT ON COLUMN graph_relations.relation_type IS 'Type: prerequisite (must learn first), extension (advanced topic), related (connected topic)';
COMMENT ON COLUMN graph_relations.context IS 'Context or reason for the relationship';
COMMENT ON TABLE prompt_templates IS 'Prompt templates with priority: graph > user > system';

-- =====================================================
-- SCHEDULER TABLES
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

-- Scheduled tasks table (main task table)
CREATE TABLE IF NOT EXISTS scheduled_tasks (
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
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'paused', 'completed', 'cancelled')),
  tags TEXT[] DEFAULT '{}',
  knowledge_point_id UUID,
  priority INTEGER DEFAULT 0,
  task_type TEXT DEFAULT 'one_time' CHECK (task_type IN ('one_time', 'long_term', 'periodic', 'learning')),
  total_duration INTEGER,
  progress_mode TEXT CHECK (progress_mode IN ('average', 'decreasing', 'increasing', 'custom')),
  progress_percentage INTEGER DEFAULT 0,
  parent_task_id UUID REFERENCES scheduled_tasks(id),
  context TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

COMMENT ON TABLE scheduled_tasks IS 'Three-layer feedback queue task scheduler - main task table';
COMMENT ON COLUMN scheduled_tasks.queue_id IS 'Reference to the queue this task belongs to';
COMMENT ON COLUMN scheduled_tasks.queue_level IS 'Queue level: 0=Q0 (focus), 1=Q1 (standard), 2=Q2 (background) - kept for transition';
COMMENT ON COLUMN scheduled_tasks.position IS 'Position within the queue for ordering';
COMMENT ON COLUMN scheduled_tasks.estimated_duration IS 'Estimated duration in minutes';
COMMENT ON COLUMN scheduled_tasks.actual_duration IS 'Actual duration in minutes';
COMMENT ON COLUMN scheduled_tasks.status IS 'Task status: pending, in_progress, paused, completed, cancelled';
COMMENT ON COLUMN scheduled_tasks.task_type IS 'Task type: one_time (一次性), long_term (长期), periodic (周期性), learning (学习)';
COMMENT ON COLUMN scheduled_tasks.total_duration IS 'Total duration in minutes for long-term tasks';
COMMENT ON COLUMN scheduled_tasks.progress_mode IS 'Progress distribution mode: average, decreasing, increasing, custom';
COMMENT ON COLUMN scheduled_tasks.progress_percentage IS 'Current progress percentage (0-100)';
COMMENT ON COLUMN scheduled_tasks.parent_task_id IS 'Parent task ID for periodic task instances';
COMMENT ON COLUMN scheduled_tasks.context IS 'Task context description for AI assistance';

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

-- Task dependencies table
CREATE TABLE IF NOT EXISTS task_dependencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES scheduled_tasks(id) ON DELETE CASCADE,
  depends_on_task_id UUID NOT NULL REFERENCES scheduled_tasks(id) ON DELETE CASCADE,
  dependency_type TEXT NOT NULL DEFAULT 'strict' CHECK (dependency_type IN ('strict', 'soft')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(task_id, depends_on_task_id)
);

COMMENT ON TABLE task_dependencies IS 'Task dependency relationships for task scheduling';
COMMENT ON COLUMN task_dependencies.task_id IS 'The task that has the dependency';
COMMENT ON COLUMN task_dependencies.depends_on_task_id IS 'The task that must be completed first';
COMMENT ON COLUMN task_dependencies.dependency_type IS 'strict: must complete before starting, soft: recommended but not required';

-- Task schedules table (periodic task configuration)
CREATE TABLE IF NOT EXISTS task_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_template_id UUID NOT NULL REFERENCES scheduled_tasks(id) ON DELETE CASCADE,
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
COMMENT ON COLUMN task_schedules.next_run_at IS 'Next scheduled run time';
COMMENT ON COLUMN task_schedules.last_run_at IS 'Last run time';
COMMENT ON COLUMN task_schedules.is_active IS 'Whether the schedule is active';

-- Task progress plans table
CREATE TABLE IF NOT EXISTS task_progress_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES scheduled_tasks(id) ON DELETE CASCADE,
  plan_date DATE NOT NULL,
  planned_percentage INTEGER NOT NULL,
  actual_percentage INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'skipped')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(task_id, plan_date)
);

COMMENT ON TABLE task_progress_plans IS 'Daily progress plans for long-term tasks';
COMMENT ON COLUMN task_progress_plans.task_id IS 'Reference to the long-term task';
COMMENT ON COLUMN task_progress_plans.plan_date IS 'Date for this progress plan';
COMMENT ON COLUMN task_progress_plans.planned_percentage IS 'Planned progress percentage for this day';
COMMENT ON COLUMN task_progress_plans.actual_percentage IS 'Actual progress percentage achieved';
COMMENT ON COLUMN task_progress_plans.status IS 'Plan status: pending, completed, skipped';
COMMENT ON COLUMN task_progress_plans.notes IS 'Notes for this progress entry';

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
COMMENT ON COLUMN user_time_slots.start_time IS 'Start time of the slot';
COMMENT ON COLUMN user_time_slots.end_time IS 'End time of the slot';
COMMENT ON COLUMN user_time_slots.is_available IS 'Whether this slot is available for tasks';
COMMENT ON COLUMN user_time_slots.label IS 'Optional label for this time slot (e.g., "Morning Focus")';

-- =====================================================
-- RELATIONSHIP TYPES TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS relationship_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  display_name text NOT NULL,
  category text NOT NULL DEFAULT 'custom',
  color text NOT NULL DEFAULT '#6B7280',
  line_style text NOT NULL DEFAULT 'solid',
  show_arrow text NOT NULL DEFAULT 'auto',
  is_builtin boolean NOT NULL DEFAULT false,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  CONSTRAINT chk_relationship_line_style CHECK (line_style IN ('solid', 'dashed', 'dotted', 'double')),
  CONSTRAINT chk_show_arrow CHECK (show_arrow IN ('true', 'false', 'auto'))
);

COMMENT ON TABLE relationship_types IS '关系类型配置表，存储预设和用户自定义的关系类型';
COMMENT ON COLUMN relationship_types.name IS '关系类型名称，用于程序标识';
COMMENT ON COLUMN relationship_types.display_name IS '显示名称，用于UI展示';
COMMENT ON COLUMN relationship_types.category IS '分类：hierarchical, dependency, semantic, temporal, interaction, causal, custom';
COMMENT ON COLUMN relationship_types.color IS '默认颜色，十六进制格式';
COMMENT ON COLUMN relationship_types.line_style IS '默认线型';
COMMENT ON COLUMN relationship_types.show_arrow IS '箭头显示：true, false, auto';
COMMENT ON COLUMN relationship_types.is_builtin IS '是否为内置预设类型';
COMMENT ON COLUMN relationship_types.user_id IS '创建用户ID，内置类型为null';

-- =====================================================
-- USER FOCUS STATS TABLE
-- =====================================================

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

-- =====================================================
-- TASK TEMPLATES TABLE
-- =====================================================

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
COMMENT ON COLUMN task_templates.description_template IS 'Template for task description';
COMMENT ON COLUMN task_templates.is_default IS 'Whether this is a default template for the category';
COMMENT ON COLUMN task_templates.is_system IS 'Whether this is a system preset template';
COMMENT ON COLUMN task_templates.usage_count IS 'Number of times this template has been used';

-- =====================================================
-- TASK REVIEWS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS task_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_id UUID REFERENCES scheduled_tasks(id) ON DELETE SET NULL,
  review_type TEXT NOT NULL CHECK (review_type IN ('daily', 'task', 'weekly')),
  content TEXT,
  mood TEXT CHECK (mood IN ('great', 'good', 'neutral', 'tired', 'stressed')),
  difficulties TEXT,
  improvements TEXT,
  learnings TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- PERIODIC TASKS AND PASS SYSTEM
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
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_user_period_task UNIQUE (user_id, period_type, period_start, task_type)
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
  UNIQUE(user_id, pass_id, level)
);

COMMENT ON TABLE user_pass_progress IS 'Track which rewards user has claimed';

-- =====================================================
-- TASK SUBTASKS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS task_subtasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES scheduled_tasks(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
  priority INTEGER DEFAULT 0,
  position INTEGER DEFAULT 0,
  estimated_duration INTEGER,
  actual_duration INTEGER,
  due_date TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE task_subtasks IS 'Subtasks for breaking down main tasks';
COMMENT ON COLUMN task_subtasks.task_id IS 'Reference to the parent task';
COMMENT ON COLUMN task_subtasks.status IS 'Subtask status: pending, in_progress, completed';
COMMENT ON COLUMN task_subtasks.position IS 'Order position within the task';

-- =====================================================
-- TASK LINKS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS task_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES scheduled_tasks(id) ON DELETE CASCADE,
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
COMMENT ON COLUMN task_links.url IS 'URL or path for the link';
COMMENT ON COLUMN task_links.metadata IS 'Additional metadata (e.g., file size, last modified)';

-- =====================================================
-- TASK KNOWLEDGE POINTS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS task_knowledge_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES scheduled_tasks(id) ON DELETE CASCADE,
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

-- =====================================================
-- INDEXES
-- =====================================================

-- Users
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Knowledge graphs
CREATE INDEX IF NOT EXISTS idx_knowledge_graphs_user_id ON knowledge_graphs(user_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_graphs_is_public ON knowledge_graphs(is_public);
CREATE INDEX IF NOT EXISTS idx_knowledge_graphs_title_trgm ON knowledge_graphs USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_graphs_deleted_at ON knowledge_graphs(deleted_at);
CREATE INDEX IF NOT EXISTS idx_knowledge_graphs_last_used_at ON knowledge_graphs(last_used_at DESC);
CREATE INDEX IF NOT EXISTS idx_knowledge_graphs_user_deleted ON knowledge_graphs(user_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_knowledge_graphs_user_created ON knowledge_graphs(user_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_knowledge_graphs_public ON knowledge_graphs(id) WHERE is_public = true AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_knowledge_graphs_user_favorite ON knowledge_graphs(user_id, is_favorite DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS knowledge_graphs_embedding_idx ON knowledge_graphs USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Knowledge points
CREATE INDEX IF NOT EXISTS idx_knowledge_points_owner_id ON knowledge_points(owner_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_points_visibility ON knowledge_points(visibility);
CREATE INDEX IF NOT EXISTS idx_knowledge_points_title_trgm ON knowledge_points USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_knowledge_points_content_trgm ON knowledge_points USING gin (content gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_knowledge_points_embedding ON knowledge_points USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_knowledge_points_public ON knowledge_points(id) WHERE visibility = 'public';
CREATE INDEX IF NOT EXISTS idx_knowledge_points_owner_visibility ON knowledge_points(owner_id, visibility);
CREATE INDEX IF NOT EXISTS idx_knowledge_points_owner ON knowledge_points(owner_id);

-- Graph nodes
CREATE INDEX IF NOT EXISTS idx_graph_nodes_graph_id ON graph_nodes(graph_id);
CREATE INDEX IF NOT EXISTS idx_graph_nodes_knowledge_point_id ON graph_nodes(knowledge_point_id);
CREATE INDEX IF NOT EXISTS idx_graph_nodes_level ON graph_nodes(level);
CREATE INDEX IF NOT EXISTS idx_graph_nodes_deleted_at ON graph_nodes(deleted_at);
CREATE INDEX IF NOT EXISTS idx_graph_nodes_graph_deleted ON graph_nodes(graph_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_graph_nodes_kp_graph ON graph_nodes(knowledge_point_id, graph_id);

-- Edges
CREATE INDEX IF NOT EXISTS idx_edges_source ON edges(source_knowledge_point_id);
CREATE INDEX IF NOT EXISTS idx_edges_target ON edges(target_knowledge_point_id);
CREATE INDEX IF NOT EXISTS idx_edges_graph_id ON edges(graph_id);
CREATE INDEX IF NOT EXISTS idx_edges_deleted_at ON edges(deleted_at);
CREATE INDEX IF NOT EXISTS idx_edges_source_graph ON edges(source_knowledge_point_id, graph_id);
CREATE INDEX IF NOT EXISTS idx_edges_target_graph ON edges(target_knowledge_point_id, graph_id);
CREATE INDEX IF NOT EXISTS idx_edges_graph ON edges(graph_id);
CREATE INDEX IF NOT EXISTS idx_edges_graph_deleted ON edges(graph_id, deleted_at);

-- Study cards
CREATE INDEX IF NOT EXISTS idx_study_cards_user_next_review ON study_cards(user_id, next_review);
CREATE INDEX IF NOT EXISTS idx_study_cards_knowledge_point_id ON study_cards(knowledge_point_id);
CREATE INDEX IF NOT EXISTS idx_study_cards_next_review ON study_cards(next_review);
CREATE INDEX IF NOT EXISTS idx_study_cards_fsrs_state ON study_cards(fsrs_state);
CREATE INDEX IF NOT EXISTS idx_study_cards_user_graph ON study_cards(user_id, graph_id);
CREATE INDEX IF NOT EXISTS idx_study_cards_user_kp ON study_cards(user_id, knowledge_point_id);
CREATE INDEX IF NOT EXISTS idx_study_cards_user_state ON study_cards(user_id, fsrs_state);
CREATE INDEX IF NOT EXISTS idx_study_cards_user_last_reviewed ON study_cards(user_id, last_reviewed);
CREATE INDEX IF NOT EXISTS idx_study_cards_graph_id ON study_cards(graph_id);
CREATE INDEX IF NOT EXISTS idx_study_cards_user_id ON study_cards(user_id);
CREATE INDEX IF NOT EXISTS idx_study_cards_source_graph_id ON study_cards(source_graph_id);
CREATE INDEX IF NOT EXISTS idx_study_cards_next_review_filtered ON study_cards(next_review) WHERE next_review IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_study_cards_user_review ON study_cards(user_id, next_review) WHERE next_review IS NOT NULL;

-- Study progress
CREATE INDEX IF NOT EXISTS idx_study_progress_user ON study_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_study_progress_graph_id ON study_progress(graph_id);
CREATE INDEX IF NOT EXISTS idx_study_progress_user_graph ON study_progress(user_id, graph_id);

-- Tasks
CREATE INDEX IF NOT EXISTS tasks_user_id_idx ON tasks(user_id);
CREATE INDEX IF NOT EXISTS tasks_status_idx ON tasks(status);
CREATE INDEX IF NOT EXISTS tasks_created_at_idx ON tasks(created_at);
CREATE INDEX IF NOT EXISTS tasks_user_status_idx ON tasks(user_id, status);
CREATE INDEX IF NOT EXISTS idx_tasks_user_status ON tasks(user_id, status);
CREATE INDEX IF NOT EXISTS idx_tasks_user_created ON tasks(user_id, created_at DESC);

-- Templates
CREATE INDEX IF NOT EXISTS idx_templates_user_id ON templates(user_id);
CREATE INDEX IF NOT EXISTS idx_templates_category ON templates(category);
CREATE INDEX IF NOT EXISTS idx_templates_is_system ON templates(is_system);
CREATE INDEX IF NOT EXISTS idx_templates_user_category ON templates(user_id, category);

-- Prompt templates
CREATE INDEX IF NOT EXISTS idx_prompt_templates_code ON prompt_templates(code);
CREATE INDEX IF NOT EXISTS idx_prompt_templates_user ON prompt_templates(user_id);

-- AI actions
CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_actions_unique_name_scope 
  ON ai_actions (name, scope, COALESCE(user_id, '00000000-0000-0000-0000-000000000000'), COALESCE(graph_id, '00000000-0000-0000-0000-000000000000'));
CREATE INDEX IF NOT EXISTS idx_ai_actions_user ON ai_actions(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_actions_graph ON ai_actions(graph_id);

-- Focus sessions
CREATE INDEX IF NOT EXISTS focus_sessions_user_id_idx ON focus_sessions(user_id);
CREATE INDEX IF NOT EXISTS focus_sessions_created_at_idx ON focus_sessions(created_at);
CREATE INDEX IF NOT EXISTS idx_focus_sessions_user_date ON focus_sessions(user_id, start_time DESC);
CREATE INDEX IF NOT EXISTS idx_focus_sessions_user_completed ON focus_sessions(user_id, completed) WHERE completed = true;
CREATE INDEX IF NOT EXISTS idx_focus_sessions_user_started ON focus_sessions(user_id, start_time DESC);
CREATE INDEX IF NOT EXISTS idx_focus_sessions_task ON focus_sessions(task_id) WHERE task_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_focus_sessions_break ON focus_sessions(user_id, is_break);
CREATE INDEX IF NOT EXISTS idx_focus_sessions_user_completed_2 ON focus_sessions(user_id, completed);

-- Achievements
CREATE INDEX IF NOT EXISTS idx_achievements_code ON achievements(code);
CREATE INDEX IF NOT EXISTS idx_achievements_category ON achievements(category);

-- User achievements
CREATE INDEX IF NOT EXISTS idx_user_achievements_user ON user_achievements(user_id);
CREATE INDEX IF NOT EXISTS idx_user_achievements_achievement ON user_achievements(achievement_id);
CREATE INDEX IF NOT EXISTS idx_user_achievements_unlocked ON user_achievements(user_id, unlocked_at DESC);

-- Daily tasks
CREATE INDEX IF NOT EXISTS idx_daily_tasks_user_date ON daily_tasks(user_id, task_date);

-- Graph relations
CREATE INDEX IF NOT EXISTS idx_graph_relations_source ON graph_relations(source_graph_id);
CREATE INDEX IF NOT EXISTS idx_graph_relations_target ON graph_relations(target_graph_id);
CREATE INDEX IF NOT EXISTS idx_graph_relations_type ON graph_relations(relation_type);

-- Backup snapshots
CREATE INDEX IF NOT EXISTS idx_backup_snapshots_user_id ON backup_snapshots(user_id);

-- Task subtasks
CREATE INDEX IF NOT EXISTS idx_task_subtasks_task_id ON task_subtasks(task_id);
CREATE INDEX IF NOT EXISTS idx_task_subtasks_status ON task_subtasks(status);
CREATE INDEX IF NOT EXISTS idx_task_subtasks_position ON task_subtasks(task_id, position);

-- Task links
CREATE INDEX IF NOT EXISTS idx_task_links_task_id ON task_links(task_id);
CREATE INDEX IF NOT EXISTS idx_task_links_type ON task_links(link_type);
CREATE INDEX IF NOT EXISTS idx_task_links_position ON task_links(task_id, position);

-- Task knowledge points
CREATE INDEX IF NOT EXISTS idx_task_kp_task_id ON task_knowledge_points(task_id);
CREATE INDEX IF NOT EXISTS idx_task_kp_kp_id ON task_knowledge_points(knowledge_point_id);
CREATE INDEX IF NOT EXISTS idx_task_kp_primary ON task_knowledge_points(task_id) WHERE is_primary = true;
CREATE INDEX IF NOT EXISTS idx_backup_snapshots_type ON backup_snapshots(type);
CREATE INDEX IF NOT EXISTS idx_backup_snapshots_user_created ON backup_snapshots(user_id, created_at DESC);

-- Queues indexes
CREATE INDEX IF NOT EXISTS idx_queues_user_id ON queues(user_id);
CREATE INDEX IF NOT EXISTS idx_queues_priority ON queues(user_id, priority);

-- Scheduled tasks indexes
CREATE INDEX IF NOT EXISTS idx_scheduled_tasks_user_status ON scheduled_tasks(user_id, status);
CREATE INDEX IF NOT EXISTS idx_scheduled_tasks_user_queue_position ON scheduled_tasks(user_id, queue_level, position);
CREATE INDEX IF NOT EXISTS idx_scheduled_tasks_user_deleted ON scheduled_tasks(user_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_scheduled_tasks_user_deadline ON scheduled_tasks(user_id, deadline) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_scheduled_tasks_knowledge_point ON scheduled_tasks(knowledge_point_id) WHERE knowledge_point_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_scheduled_tasks_queue_id ON scheduled_tasks(queue_id) WHERE queue_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_scheduled_tasks_task_type ON scheduled_tasks(user_id, task_type) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_scheduled_tasks_parent_task ON scheduled_tasks(parent_task_id) WHERE parent_task_id IS NOT NULL;

-- Task dependencies indexes
CREATE INDEX IF NOT EXISTS idx_task_dependencies_task ON task_dependencies(task_id);
CREATE INDEX IF NOT EXISTS idx_task_dependencies_depends_on ON task_dependencies(depends_on_task_id);
CREATE INDEX IF NOT EXISTS idx_task_dependencies_type ON task_dependencies(dependency_type);

-- Task schedules indexes
CREATE INDEX IF NOT EXISTS idx_task_schedules_user ON task_schedules(user_id);
CREATE INDEX IF NOT EXISTS idx_task_schedules_template ON task_schedules(task_template_id);
CREATE INDEX IF NOT EXISTS idx_task_schedules_next_run ON task_schedules(next_run_at) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_task_schedules_active ON task_schedules(user_id, is_active);

-- Task progress plans indexes
CREATE INDEX IF NOT EXISTS idx_task_progress_plans_task ON task_progress_plans(task_id);
CREATE INDEX IF NOT EXISTS idx_task_progress_plans_date ON task_progress_plans(plan_date);
CREATE INDEX IF NOT EXISTS idx_task_progress_plans_task_date ON task_progress_plans(task_id, plan_date);
CREATE INDEX IF NOT EXISTS idx_task_progress_plans_status ON task_progress_plans(task_id, status);

-- User time slots indexes
CREATE INDEX IF NOT EXISTS idx_user_time_slots_user ON user_time_slots(user_id);
CREATE INDEX IF NOT EXISTS idx_user_time_slots_day ON user_time_slots(user_id, day_of_week);
CREATE INDEX IF NOT EXISTS idx_user_time_slots_available ON user_time_slots(user_id, is_available) WHERE is_available = TRUE;

-- Task executions indexes
CREATE INDEX IF NOT EXISTS idx_task_executions_task ON task_executions(task_id);
CREATE INDEX IF NOT EXISTS idx_task_executions_user_started ON task_executions(user_id, started_at DESC);

-- Task tags indexes
CREATE INDEX IF NOT EXISTS idx_task_tags_user ON task_tags(user_id);
CREATE INDEX IF NOT EXISTS idx_task_tags_user_name ON task_tags(user_id, name);

-- Task settings indexes
CREATE INDEX IF NOT EXISTS idx_task_settings_user ON task_settings(user_id);

-- Relationship types indexes
CREATE INDEX IF NOT EXISTS idx_relationship_types_category ON relationship_types(category);
CREATE INDEX IF NOT EXISTS idx_relationship_types_user ON relationship_types(user_id);

-- User focus stats indexes
CREATE INDEX IF NOT EXISTS idx_user_focus_stats_user ON user_focus_stats(user_id);

-- Task templates indexes
CREATE INDEX IF NOT EXISTS idx_task_templates_user ON task_templates(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_task_templates_category ON task_templates(category);
CREATE INDEX IF NOT EXISTS idx_task_templates_system ON task_templates(is_system) WHERE is_system = TRUE;
CREATE INDEX IF NOT EXISTS idx_task_templates_user_category ON task_templates(user_id, category) WHERE user_id IS NOT NULL;

-- Task reviews indexes
CREATE INDEX IF NOT EXISTS idx_task_reviews_user_id ON task_reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_task_reviews_task_id ON task_reviews(task_id);
CREATE INDEX IF NOT EXISTS idx_task_reviews_type ON task_reviews(review_type);
CREATE INDEX IF NOT EXISTS idx_task_reviews_created_at ON task_reviews(created_at DESC);

-- Periodic tasks indexes
CREATE INDEX IF NOT EXISTS idx_periodic_tasks_user ON periodic_tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_periodic_tasks_period ON periodic_tasks(user_id, period_type, period_start);
CREATE INDEX IF NOT EXISTS idx_periodic_tasks_status ON periodic_tasks(user_id, status);

-- Periodic passes indexes
CREATE INDEX IF NOT EXISTS idx_periodic_passes_user ON periodic_passes(user_id);
CREATE INDEX IF NOT EXISTS idx_periodic_passes_period ON periodic_passes(user_id, period_type, period_start);

-- Pass rewards indexes
CREATE INDEX IF NOT EXISTS idx_pass_rewards_period ON pass_rewards(period_type, level);

-- User pass progress indexes
CREATE INDEX IF NOT EXISTS idx_user_pass_progress_pass ON user_pass_progress(pass_id);
CREATE INDEX IF NOT EXISTS idx_user_pass_progress_user ON user_pass_progress(user_id);

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

-- Users
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile" ON users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON users FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON users FOR UPDATE USING (auth.uid() = id);

-- Knowledge Graphs
ALTER TABLE knowledge_graphs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own graphs" ON knowledge_graphs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own graphs" ON knowledge_graphs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own graphs" ON knowledge_graphs FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own graphs" ON knowledge_graphs FOR DELETE USING (auth.uid() = user_id);

-- Knowledge Points
ALTER TABLE knowledge_points ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view public knowledge points" ON knowledge_points FOR SELECT USING (visibility = 'public');
CREATE POLICY "Users can view own knowledge points" ON knowledge_points FOR SELECT USING (auth.uid() = owner_id);
CREATE POLICY "Users can insert own knowledge points" ON knowledge_points FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Users can update own knowledge points" ON knowledge_points FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "Users can delete own knowledge points" ON knowledge_points FOR DELETE USING (auth.uid() = owner_id);

-- Graph Nodes
ALTER TABLE graph_nodes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view graph_nodes of own graphs" ON graph_nodes FOR SELECT USING (EXISTS (
  SELECT 1 FROM knowledge_graphs WHERE knowledge_graphs.id = graph_nodes.graph_id AND knowledge_graphs.user_id = auth.uid()
));
CREATE POLICY "Users can insert graph_nodes to own graphs" ON graph_nodes FOR INSERT WITH CHECK (EXISTS (
  SELECT 1 FROM knowledge_graphs WHERE knowledge_graphs.id = graph_nodes.graph_id AND knowledge_graphs.user_id = auth.uid()
));
CREATE POLICY "Users can update graph_nodes of own graphs" ON graph_nodes FOR UPDATE USING (EXISTS (
  SELECT 1 FROM knowledge_graphs WHERE knowledge_graphs.id = graph_nodes.graph_id AND knowledge_graphs.user_id = auth.uid()
));
CREATE POLICY "Users can delete graph_nodes of own graphs" ON graph_nodes FOR DELETE USING (EXISTS (
  SELECT 1 FROM knowledge_graphs WHERE knowledge_graphs.id = graph_nodes.graph_id AND knowledge_graphs.user_id = auth.uid()
));

-- Edges
ALTER TABLE edges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view edges of own graphs" ON edges FOR SELECT USING (EXISTS (
  SELECT 1 FROM knowledge_graphs WHERE knowledge_graphs.id = edges.graph_id AND knowledge_graphs.user_id = auth.uid()
));
CREATE POLICY "Users can insert edges to own graphs" ON edges FOR INSERT WITH CHECK (EXISTS (
  SELECT 1 FROM knowledge_graphs WHERE knowledge_graphs.id = edges.graph_id AND knowledge_graphs.user_id = auth.uid()
));
CREATE POLICY "Users can update edges of own graphs" ON edges FOR UPDATE USING (EXISTS (
  SELECT 1 FROM knowledge_graphs WHERE knowledge_graphs.id = edges.graph_id AND knowledge_graphs.user_id = auth.uid()
));
CREATE POLICY "Users can delete edges of own graphs" ON edges FOR DELETE USING (EXISTS (
  SELECT 1 FROM knowledge_graphs WHERE knowledge_graphs.id = edges.graph_id AND knowledge_graphs.user_id = auth.uid()
));

-- Study Cards
ALTER TABLE study_cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own study cards" ON study_cards FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own study cards" ON study_cards FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own study cards" ON study_cards FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own study cards" ON study_cards FOR DELETE USING (auth.uid() = user_id);

-- Study Progress
ALTER TABLE study_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own study progress" ON study_progress FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own study progress" ON study_progress FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own study progress" ON study_progress FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own study progress" ON study_progress FOR DELETE USING (auth.uid() = user_id);

-- Tasks
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own tasks" ON tasks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own tasks" ON tasks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own tasks" ON tasks FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own tasks" ON tasks FOR DELETE USING (auth.uid() = user_id);

-- Templates
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view templates" ON templates FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create custom templates" ON templates FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own templates" ON templates FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own templates" ON templates FOR DELETE USING (auth.uid() = user_id OR is_system = false);

-- Prompt Templates
ALTER TABLE prompt_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "System templates are viewable by everyone" ON prompt_templates FOR SELECT USING (scope = 'system');
CREATE POLICY "Users can view their own templates" ON prompt_templates FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own templates" ON prompt_templates FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own templates" ON prompt_templates FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own templates" ON prompt_templates FOR DELETE USING (auth.uid() = user_id);

-- AI Actions
ALTER TABLE ai_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "System actions are viewable by everyone" ON ai_actions FOR SELECT USING (scope = 'system');
CREATE POLICY "Users can view their own actions" ON ai_actions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can view actions for their graphs" ON ai_actions FOR SELECT USING (
  scope = 'graph' AND graph_id IN (SELECT id FROM knowledge_graphs WHERE user_id = auth.uid())
);
CREATE POLICY "Users can manage their own actions" ON ai_actions FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage actions for their graphs" ON ai_actions FOR ALL USING (
  scope = 'graph' AND graph_id IN (SELECT id FROM knowledge_graphs WHERE user_id = auth.uid())
);

-- App Settings
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow read access for authenticated users" ON app_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow all access for authenticated users" ON app_settings FOR ALL TO authenticated USING (true);

-- Focus Sessions
ALTER TABLE focus_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own focus sessions" ON focus_sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own focus sessions" ON focus_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own focus sessions" ON focus_sessions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own focus sessions" ON focus_sessions FOR DELETE USING (auth.uid() = user_id);

-- Achievements
ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view achievements" ON achievements FOR SELECT USING (TRUE);
CREATE POLICY "Only admins can manage achievements" ON achievements FOR ALL USING (
  EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
  )
);

-- User Achievements
ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own achievements" ON user_achievements FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own achievements" ON user_achievements FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own achievements" ON user_achievements FOR UPDATE USING (auth.uid() = user_id);

-- Daily Tasks
ALTER TABLE daily_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own daily tasks" ON daily_tasks FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Graph Relations
ALTER TABLE graph_relations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view relations for graphs they own or are public"
  ON graph_relations FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM knowledge_graphs WHERE id = source_graph_id AND (user_id = auth.uid() OR is_public = true))
    OR EXISTS (SELECT 1 FROM knowledge_graphs WHERE id = target_graph_id AND (user_id = auth.uid() OR is_public = true))
  );
CREATE POLICY "Users can insert relations for graphs they own"
  ON graph_relations FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM knowledge_graphs WHERE id = source_graph_id AND user_id = auth.uid())
  );
CREATE POLICY "Users can delete relations for graphs they own"
  ON graph_relations FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM knowledge_graphs WHERE id = source_graph_id AND user_id = auth.uid())
  );

-- Backup Snapshots
ALTER TABLE backup_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own backup snapshots" ON backup_snapshots FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own backup snapshots" ON backup_snapshots FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own backup snapshots" ON backup_snapshots FOR DELETE USING (auth.uid() = user_id);

-- Queues RLS
ALTER TABLE queues ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own queues" ON queues FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own queues" ON queues FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own queues" ON queues FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own queues" ON queues FOR DELETE USING (auth.uid() = user_id);

-- Scheduled tasks RLS
ALTER TABLE scheduled_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own scheduled tasks" ON scheduled_tasks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own scheduled tasks" ON scheduled_tasks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own scheduled tasks" ON scheduled_tasks FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own scheduled tasks" ON scheduled_tasks FOR DELETE USING (auth.uid() = user_id);

-- Task executions RLS
ALTER TABLE task_executions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own task executions" ON task_executions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own task executions" ON task_executions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own task executions" ON task_executions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own task executions" ON task_executions FOR DELETE USING (auth.uid() = user_id);

-- Task tags RLS
ALTER TABLE task_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own task tags" ON task_tags FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own task tags" ON task_tags FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own task tags" ON task_tags FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own task tags" ON task_tags FOR DELETE USING (auth.uid() = user_id);

-- Task settings RLS
ALTER TABLE task_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own task settings" ON task_settings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own task settings" ON task_settings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own task settings" ON task_settings FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own task settings" ON task_settings FOR DELETE USING (auth.uid() = user_id);

-- Relationship types RLS
ALTER TABLE relationship_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view builtin relationship types" ON relationship_types FOR SELECT USING (is_builtin = true);
CREATE POLICY "Users can view own relationship types" ON relationship_types FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert own relationship types" ON relationship_types FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own relationship types" ON relationship_types FOR UPDATE USING (user_id = auth.uid() AND is_builtin = false);
CREATE POLICY "Users can delete own relationship types" ON relationship_types FOR DELETE USING (user_id = auth.uid() AND is_builtin = false);

-- User focus stats RLS
ALTER TABLE user_focus_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own focus stats" ON user_focus_stats FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own focus stats" ON user_focus_stats FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own focus stats" ON user_focus_stats FOR UPDATE USING (auth.uid() = user_id);

-- Task templates RLS
ALTER TABLE task_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own task templates" ON task_templates FOR SELECT USING (auth.uid() = user_id OR is_system = TRUE);
CREATE POLICY "Users can insert own task templates" ON task_templates FOR INSERT WITH CHECK (auth.uid() = user_id OR is_system = TRUE);
CREATE POLICY "Users can update own task templates" ON task_templates FOR UPDATE USING (auth.uid() = user_id AND is_system = FALSE);
CREATE POLICY "Users can delete own task templates" ON task_templates FOR DELETE USING (auth.uid() = user_id AND is_system = FALSE);

-- Periodic tasks RLS
ALTER TABLE periodic_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own periodic tasks" ON periodic_tasks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own periodic tasks" ON periodic_tasks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own periodic tasks" ON periodic_tasks FOR UPDATE USING (auth.uid() = user_id);

-- Periodic passes RLS
ALTER TABLE periodic_passes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own periodic passes" ON periodic_passes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own periodic passes" ON periodic_passes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own periodic passes" ON periodic_passes FOR UPDATE USING (auth.uid() = user_id);

-- Pass rewards RLS
ALTER TABLE pass_rewards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view pass rewards" ON pass_rewards FOR SELECT USING (TRUE);

-- User pass progress RLS
ALTER TABLE user_pass_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own pass progress" ON user_pass_progress FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own pass progress" ON user_pass_progress FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own pass progress" ON user_pass_progress FOR UPDATE USING (auth.uid() = user_id);

-- Task dependencies RLS
ALTER TABLE task_dependencies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own task dependencies" ON task_dependencies FOR SELECT USING (
  EXISTS (SELECT 1 FROM scheduled_tasks WHERE scheduled_tasks.id = task_dependencies.task_id AND scheduled_tasks.user_id = auth.uid())
);
CREATE POLICY "Users can insert own task dependencies" ON task_dependencies FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM scheduled_tasks WHERE scheduled_tasks.id = task_dependencies.task_id AND scheduled_tasks.user_id = auth.uid())
  AND EXISTS (SELECT 1 FROM scheduled_tasks WHERE scheduled_tasks.id = task_dependencies.depends_on_task_id AND scheduled_tasks.user_id = auth.uid())
);
CREATE POLICY "Users can delete own task dependencies" ON task_dependencies FOR DELETE USING (
  EXISTS (SELECT 1 FROM scheduled_tasks WHERE scheduled_tasks.id = task_dependencies.task_id AND scheduled_tasks.user_id = auth.uid())
);

-- Task schedules RLS
ALTER TABLE task_schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own task schedules" ON task_schedules FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own task schedules" ON task_schedules FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own task schedules" ON task_schedules FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own task schedules" ON task_schedules FOR DELETE USING (auth.uid() = user_id);

-- Task progress plans RLS
ALTER TABLE task_progress_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own task progress plans" ON task_progress_plans FOR SELECT USING (
  EXISTS (SELECT 1 FROM scheduled_tasks WHERE scheduled_tasks.id = task_progress_plans.task_id AND scheduled_tasks.user_id = auth.uid())
);
CREATE POLICY "Users can insert own task progress plans" ON task_progress_plans FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM scheduled_tasks WHERE scheduled_tasks.id = task_progress_plans.task_id AND scheduled_tasks.user_id = auth.uid())
);
CREATE POLICY "Users can update own task progress plans" ON task_progress_plans FOR UPDATE USING (
  EXISTS (SELECT 1 FROM scheduled_tasks WHERE scheduled_tasks.id = task_progress_plans.task_id AND scheduled_tasks.user_id = auth.uid())
);
CREATE POLICY "Users can delete own task progress plans" ON task_progress_plans FOR DELETE USING (
  EXISTS (SELECT 1 FROM scheduled_tasks WHERE scheduled_tasks.id = task_progress_plans.task_id AND scheduled_tasks.user_id = auth.uid())
);

-- User time slots RLS
ALTER TABLE user_time_slots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own time slots" ON user_time_slots FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own time slots" ON user_time_slots FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own time slots" ON user_time_slots FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own time slots" ON user_time_slots FOR DELETE USING (auth.uid() = user_id);

-- Task subtasks RLS
ALTER TABLE task_subtasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own task subtasks" ON task_subtasks FOR SELECT USING (
  EXISTS (SELECT 1 FROM scheduled_tasks WHERE scheduled_tasks.id = task_subtasks.task_id AND scheduled_tasks.user_id = auth.uid())
);
CREATE POLICY "Users can insert own task subtasks" ON task_subtasks FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM scheduled_tasks WHERE scheduled_tasks.id = task_subtasks.task_id AND scheduled_tasks.user_id = auth.uid())
);
CREATE POLICY "Users can update own task subtasks" ON task_subtasks FOR UPDATE USING (
  EXISTS (SELECT 1 FROM scheduled_tasks WHERE scheduled_tasks.id = task_subtasks.task_id AND scheduled_tasks.user_id = auth.uid())
);
CREATE POLICY "Users can delete own task subtasks" ON task_subtasks FOR DELETE USING (
  EXISTS (SELECT 1 FROM scheduled_tasks WHERE scheduled_tasks.id = task_subtasks.task_id AND scheduled_tasks.user_id = auth.uid())
);

-- Task links RLS
ALTER TABLE task_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own task links" ON task_links FOR SELECT USING (
  EXISTS (SELECT 1 FROM scheduled_tasks WHERE scheduled_tasks.id = task_links.task_id AND scheduled_tasks.user_id = auth.uid())
);
CREATE POLICY "Users can insert own task links" ON task_links FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM scheduled_tasks WHERE scheduled_tasks.id = task_links.task_id AND scheduled_tasks.user_id = auth.uid())
);
CREATE POLICY "Users can update own task links" ON task_links FOR UPDATE USING (
  EXISTS (SELECT 1 FROM scheduled_tasks WHERE scheduled_tasks.id = task_links.task_id AND scheduled_tasks.user_id = auth.uid())
);
CREATE POLICY "Users can delete own task links" ON task_links FOR DELETE USING (
  EXISTS (SELECT 1 FROM scheduled_tasks WHERE scheduled_tasks.id = task_links.task_id AND scheduled_tasks.user_id = auth.uid())
);

-- Task knowledge points RLS
ALTER TABLE task_knowledge_points ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own task knowledge points" ON task_knowledge_points FOR SELECT USING (
  EXISTS (SELECT 1 FROM scheduled_tasks WHERE scheduled_tasks.id = task_knowledge_points.task_id AND scheduled_tasks.user_id = auth.uid())
);
CREATE POLICY "Users can insert own task knowledge points" ON task_knowledge_points FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM scheduled_tasks WHERE scheduled_tasks.id = task_knowledge_points.task_id AND scheduled_tasks.user_id = auth.uid())
);
CREATE POLICY "Users can update own task knowledge points" ON task_knowledge_points FOR UPDATE USING (
  EXISTS (SELECT 1 FROM scheduled_tasks WHERE scheduled_tasks.id = task_knowledge_points.task_id AND scheduled_tasks.user_id = auth.uid())
);
CREATE POLICY "Users can delete own task knowledge points" ON task_knowledge_points FOR DELETE USING (
  EXISTS (SELECT 1 FROM scheduled_tasks WHERE scheduled_tasks.id = task_knowledge_points.task_id AND scheduled_tasks.user_id = auth.uid())
);

-- =====================================================
-- NOTIFICATIONS TABLE
-- =====================================================

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

-- =====================================================
-- INDEXES (continued)
-- =====================================================

-- Notifications
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read_at ON notifications(read_at);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notification_settings_user_id ON notification_settings(user_id);

-- =====================================================
-- RLS POLICIES (continued)
-- =====================================================

-- Notifications
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications" ON notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own notifications" ON notifications FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own notifications" ON notifications FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own notifications" ON notifications FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own notification settings" ON notification_settings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own notification settings" ON notification_settings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own notification settings" ON notification_settings FOR UPDATE USING (auth.uid() = user_id);

-- =====================================================
-- FUNCTIONS
-- =====================================================

-- User sync trigger (Auth -> Public)
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, name)
  VALUES (
    new.id, 
    new.email, 
    COALESCE(new.raw_user_meta_data->>'name', 'User')
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    name = COALESCE(EXCLUDED.name, users.name);
  
  -- Create default notification settings for new user
  INSERT INTO public.notification_settings (user_id)
  VALUES (new.id)
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Match knowledge points function for semantic search
CREATE OR REPLACE FUNCTION match_knowledge_points (
  query_embedding vector(1024),
  match_threshold float,
  match_count int,
  p_user_id uuid
)
RETURNS TABLE (
  id uuid,
  title varchar(255),
  content text,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    kp.id,
    kp.title,
    kp.content,
    1 - (kp.embedding <=> query_embedding) as similarity
  FROM knowledge_points kp
  WHERE (kp.visibility = 'public' OR kp.owner_id = p_user_id)
    AND kp.embedding IS NOT NULL
    AND 1 - (kp.embedding <=> query_embedding) > match_threshold
  ORDER BY kp.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Get user study stats function
CREATE OR REPLACE FUNCTION get_user_study_stats(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'metrics', (
            SELECT jsonb_build_object(
                'totalCards', COUNT(*),
                'dueToday', COUNT(*) FILTER (WHERE next_review <= (CURRENT_DATE + TIME '23:59:59')),
                'learning', COUNT(*) FILTER (WHERE fsrs_state IN (1, 3)),
                'avgStability', COALESCE(ROUND(AVG(fsrs_stability) FILTER (WHERE fsrs_state != 0)::numeric, 1), 0.0)
            )
            FROM study_cards
            WHERE user_id = p_user_id
        ),
        'distribution', (
            SELECT jsonb_agg(item)
            FROM (
                SELECT fsrs_state, COUNT(*) as count
                FROM study_cards
                WHERE user_id = p_user_id
                GROUP BY fsrs_state
            ) t CROSS JOIN LATERAL (
                SELECT jsonb_build_object('state', fsrs_state, 'count', count) as item
            ) sub
        ),
        'heatmap', (
            SELECT COALESCE(jsonb_agg(jsonb_build_object('date', date, 'count', count)), '[]'::jsonb)
            FROM (
                SELECT last_reviewed::date as date, COUNT(*) as count
                FROM study_cards
                WHERE user_id = p_user_id 
                AND last_reviewed >= (CURRENT_DATE - INTERVAL '365 days')
                AND last_reviewed IS NOT NULL
                GROUP BY last_reviewed::date
            ) t
        ),
        'growth', (
            SELECT COALESCE(jsonb_agg(jsonb_build_object('date', date, 'count', count)), '[]'::jsonb)
            FROM (
                SELECT created_at::date as date, COUNT(*) as count
                FROM study_cards
                WHERE user_id = p_user_id 
                AND created_at >= (CURRENT_DATE - INTERVAL '30 days')
                GROUP BY created_at::date
            ) t
        ),
        'forecast', (
            SELECT COALESCE(jsonb_agg(jsonb_build_object('date', date, 'count', count)), '[]'::jsonb)
            FROM (
                SELECT next_review::date as date, COUNT(*) as count
                FROM study_cards
                WHERE user_id = p_user_id 
                AND next_review >= CURRENT_DATE 
                AND next_review <= (CURRENT_DATE + INTERVAL '7 days')
                GROUP BY next_review::date
            ) t
        )
    ) INTO result;
    RETURN result;
END;
$$;

-- Get user graphs with node counts in a single query
CREATE OR REPLACE FUNCTION get_user_graphs_with_counts(p_user_id UUID)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  title VARCHAR(512),
  description TEXT,
  is_public BOOLEAN,
  is_favorite BOOLEAN,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  nodes_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    g.id,
    g.user_id,
    g.title,
    g.description,
    g.is_public,
    COALESCE(g.is_favorite, false) as is_favorite,
    g.created_at,
    g.updated_at,
    g.deleted_at,
    g.last_used_at,
    COALESCE(n.count, 0) as nodes_count
  FROM knowledge_graphs g
  LEFT JOIN (
    SELECT graph_id, COUNT(*) as count
    FROM graph_nodes gn
    WHERE gn.deleted_at IS NULL
    GROUP BY graph_id
  ) n ON n.graph_id = g.id
  WHERE g.user_id = p_user_id
    AND g.deleted_at IS NULL
  ORDER BY COALESCE(g.is_favorite, false) DESC, g.last_used_at DESC NULLS LAST;
END;
$$ LANGUAGE plpgsql STABLE;

-- Get user trashed graphs with node counts
CREATE OR REPLACE FUNCTION get_user_trashed_graphs(p_user_id UUID)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  title VARCHAR(512),
  description TEXT,
  is_public BOOLEAN,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  nodes_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    g.id,
    g.user_id,
    g.title,
    g.description,
    g.is_public,
    g.created_at,
    g.updated_at,
    g.deleted_at,
    COALESCE(n.count, 0) as nodes_count
  FROM knowledge_graphs g
  LEFT JOIN (
    SELECT graph_id, COUNT(*) as count
    FROM graph_nodes gn
    WHERE gn.deleted_at IS NULL
    GROUP BY graph_id
  ) n ON n.graph_id = g.id
  WHERE g.user_id = p_user_id
    AND g.deleted_at IS NOT NULL
  ORDER BY g.deleted_at DESC;
END;
$$ LANGUAGE plpgsql STABLE;

-- Batch update node positions
CREATE OR REPLACE FUNCTION batch_update_positions(
  p_positions JSONB
) RETURNS void AS $$
DECLARE
  pos JSONB;
BEGIN
  FOR pos IN SELECT * FROM jsonb_array_elements(p_positions)
  LOOP
    UPDATE graph_nodes
    SET 
      x_position = (pos->>'x')::INTEGER,
      y_position = (pos->>'y')::INTEGER,
      updated_at = NOW()
    WHERE id = (pos->>'id')::UUID;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Get accessible knowledge points (public + own private)
CREATE OR REPLACE FUNCTION get_accessible_knowledge_points(p_user_id UUID)
RETURNS TABLE (
  id UUID,
  title VARCHAR(512),
  content TEXT,
  learning_material TEXT,
  properties JSONB,
  visibility knowledge_point_visibility,
  owner_id UUID,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    kp.id,
    kp.title,
    kp.content,
    kp.learning_material,
    kp.properties,
    kp.visibility,
    kp.owner_id,
    kp.created_at,
    kp.updated_at
  FROM knowledge_points kp
  WHERE kp.visibility = 'public' OR kp.owner_id = p_user_id
  ORDER BY kp.updated_at DESC;
END;
$$ LANGUAGE plpgsql STABLE;

-- Search similar knowledge points (for AI reuse)
CREATE OR REPLACE FUNCTION search_similar_knowledge_points(
  p_query_embedding vector(1024),
  p_user_id UUID,
  p_match_threshold FLOAT DEFAULT 0.8,
  p_match_count INT DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  title VARCHAR(512),
  content TEXT,
  similarity FLOAT,
  visibility knowledge_point_visibility
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    kp.id,
    kp.title,
    kp.content,
    1 - (kp.embedding <=> p_query_embedding) as similarity,
    kp.visibility
  FROM knowledge_points kp
  WHERE (kp.visibility = 'public' OR kp.owner_id = p_user_id)
    AND (1 - (kp.embedding <=> p_query_embedding)) > p_match_threshold
  ORDER BY kp.embedding <=> p_query_embedding
  LIMIT p_match_count;
END;
$$ LANGUAGE plpgsql STABLE;

-- Get knowledge point graphs
CREATE OR REPLACE FUNCTION get_knowledge_point_graphs(p_knowledge_point_id UUID, p_user_id UUID)
RETURNS TABLE (
  graph_id UUID,
  graph_title VARCHAR(512),
  x_position FLOAT,
  y_position FLOAT,
  level VARCHAR(20)
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    kg.id,
    kg.title,
    gn.x_position,
    gn.y_position,
    gn.level
  FROM graph_nodes gn
  JOIN knowledge_graphs kg ON gn.graph_id = kg.id
  WHERE gn.knowledge_point_id = p_knowledge_point_id
    AND gn.deleted_at IS NULL
    AND kg.user_id = p_user_id;
END;
$$ LANGUAGE plpgsql STABLE;

-- Soft delete graph node (remove from graph)
CREATE OR REPLACE FUNCTION soft_delete_graph_node(
  p_graph_node_id UUID,
  p_user_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  v_graph_id UUID;
BEGIN
  SELECT gn.graph_id INTO v_graph_id
  FROM graph_nodes gn
  JOIN knowledge_graphs kg ON gn.graph_id = kg.id
  WHERE gn.id = p_graph_node_id AND kg.user_id = p_user_id;
  
  IF v_graph_id IS NULL THEN
    RETURN FALSE;
  END IF;
  
  DELETE FROM edges 
  WHERE (source_knowledge_point_id IN (
      SELECT knowledge_point_id FROM graph_nodes WHERE id = p_graph_node_id
    ) OR target_knowledge_point_id IN (
      SELECT knowledge_point_id FROM graph_nodes WHERE id = p_graph_node_id
    ))
    AND graph_id = v_graph_id;
  
  UPDATE graph_nodes 
  SET deleted_at = NOW(), updated_at = NOW()
  WHERE id = p_graph_node_id;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Hard delete knowledge point (complete deletion)
CREATE OR REPLACE FUNCTION hard_delete_knowledge_point(
  p_knowledge_point_id UUID,
  p_user_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_graph_count INT;
  v_deleted_graph_nodes INT;
  v_deleted_edges INT;
  v_deleted_cards INT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM knowledge_points WHERE id = p_knowledge_point_id AND owner_id = p_user_id) THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Permission denied');
  END IF;
  
  SELECT COUNT(*) INTO v_graph_count
  FROM graph_nodes 
  WHERE knowledge_point_id = p_knowledge_point_id AND deleted_at IS NULL;
  
  DELETE FROM edges e
  WHERE EXISTS (
    SELECT 1 FROM graph_nodes gn
    WHERE gn.knowledge_point_id = p_knowledge_point_id
      AND (e.source_knowledge_point_id = gn.knowledge_point_id OR e.target_knowledge_point_id = gn.knowledge_point_id)
  );
  
  GET DIAGNOSTICS v_deleted_edges = ROW_COUNT;
  
  DELETE FROM graph_nodes WHERE knowledge_point_id = p_knowledge_point_id;
  GET DIAGNOSTICS v_deleted_graph_nodes = ROW_COUNT;
  
  DELETE FROM study_cards WHERE knowledge_point_id = p_knowledge_point_id;
  GET DIAGNOSTICS v_deleted_cards = ROW_COUNT;
  
  DELETE FROM knowledge_points WHERE id = p_knowledge_point_id;
  
  RETURN jsonb_build_object(
    'success', TRUE,
    'affected_graphs', v_graph_count,
    'deleted_graph_nodes', v_deleted_graph_nodes,
    'deleted_edges', v_deleted_edges,
    'deleted_cards', v_deleted_cards
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Search similar graphs by topic embedding
CREATE OR REPLACE FUNCTION search_similar_graphs(
  p_query_embedding vector(1024),
  p_user_id UUID,
  p_match_threshold FLOAT DEFAULT 0.85,
  p_match_count INT DEFAULT 10,
  p_exclude_graph_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  title VARCHAR(512),
  description TEXT,
  similarity FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    kg.id,
    kg.title,
    kg.description,
    1 - (kg.embedding <=> p_query_embedding) as similarity
  FROM knowledge_graphs kg
  WHERE kg.user_id = p_user_id
    AND kg.deleted_at IS NULL
    AND kg.embedding IS NOT NULL
    AND (p_exclude_graph_id IS NULL OR kg.id != p_exclude_graph_id)
    AND (1 - (kg.embedding <=> p_query_embedding)) > p_match_threshold
  ORDER BY kg.embedding <=> p_query_embedding
  LIMIT p_match_count;
END;
$$ LANGUAGE plpgsql STABLE;

-- Check if a topic is duplicate
CREATE OR REPLACE FUNCTION check_duplicate_graph_topic(
  p_topic VARCHAR(255),
  p_user_id UUID,
  p_threshold FLOAT DEFAULT 0.85,
  p_exclude_graph_id UUID DEFAULT NULL
)
RETURNS TABLE (
  is_duplicate BOOLEAN,
  similar_graph_id UUID,
  similar_graph_title VARCHAR(512),
  similarity FLOAT
) AS $$
DECLARE
  v_embedding vector(1024);
  v_similar record;
BEGIN
  RETURN QUERY
  SELECT 
    FALSE as is_duplicate,
    NULL::UUID as similar_graph_id,
    NULL::VARCHAR(512) as similar_graph_title,
    0.0::FLOAT as similarity;
END;
$$ LANGUAGE plpgsql STABLE;

-- Auto-create task settings for new users
CREATE OR REPLACE FUNCTION handle_new_user_task_settings()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO task_settings (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

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

-- Update timestamp trigger for queues
CREATE OR REPLACE FUNCTION update_queues_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER queues_updated_at
  BEFORE UPDATE ON queues
  FOR EACH ROW EXECUTE FUNCTION update_queues_updated_at();

-- Update timestamp trigger for relationship_types
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_relationship_types_updated_at
  BEFORE UPDATE ON relationship_types
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Update user focus stats
CREATE OR REPLACE FUNCTION update_user_focus_stats()
RETURNS TRIGGER AS $$
DECLARE
  focus_date DATE;
  prev_focus_date DATE;
  new_streak INTEGER;
BEGIN
  focus_date := NEW.start_time::date;
  
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

CREATE TRIGGER on_focus_session_created
  AFTER INSERT ON focus_sessions
  FOR EACH ROW
  WHEN (NEW.is_break = FALSE OR NEW.is_break IS NULL)
  EXECUTE FUNCTION update_user_focus_stats();

-- Update stats on task complete
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

CREATE TRIGGER on_task_completed
  AFTER UPDATE ON scheduled_tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_stats_on_task_complete();

-- Update timestamp trigger for user_focus_stats
CREATE OR REPLACE FUNCTION update_focus_stats_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_focus_stats_updated_at
  BEFORE UPDATE ON user_focus_stats
  FOR EACH ROW EXECUTE FUNCTION update_focus_stats_updated_at();

-- Update timestamp trigger for task_templates
CREATE OR REPLACE FUNCTION update_task_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER task_templates_updated_at
  BEFORE UPDATE ON task_templates
  FOR EACH ROW EXECUTE FUNCTION update_task_templates_updated_at();

-- Update timestamp trigger for task_reviews
CREATE OR REPLACE FUNCTION update_task_reviews_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_task_reviews_updated_at
  BEFORE UPDATE ON task_reviews
  FOR EACH ROW
  EXECUTE FUNCTION update_task_reviews_updated_at();

-- Update timestamp trigger for periodic_tasks
CREATE OR REPLACE FUNCTION update_periodic_tasks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER periodic_tasks_updated_at
  BEFORE UPDATE ON periodic_tasks
  FOR EACH ROW EXECUTE FUNCTION update_periodic_tasks_updated_at();

CREATE TRIGGER periodic_passes_updated_at
  BEFORE UPDATE ON periodic_passes
  FOR EACH ROW EXECUTE FUNCTION update_periodic_tasks_updated_at();

-- =====================================================
-- GRANTS
-- =====================================================

GRANT SELECT ON users TO anon;
GRANT ALL PRIVILEGES ON users TO authenticated;
GRANT SELECT ON knowledge_graphs TO anon;
GRANT ALL PRIVILEGES ON knowledge_graphs TO authenticated;
GRANT SELECT ON knowledge_points TO anon;
GRANT ALL PRIVILEGES ON knowledge_points TO authenticated;
GRANT SELECT ON graph_nodes TO anon;
GRANT ALL PRIVILEGES ON graph_nodes TO authenticated;
GRANT SELECT ON edges TO anon;
GRANT ALL PRIVILEGES ON edges TO authenticated;
GRANT SELECT ON study_cards TO anon;
GRANT ALL PRIVILEGES ON study_cards TO authenticated;
GRANT SELECT ON study_progress TO anon;
GRANT ALL PRIVILEGES ON study_progress TO authenticated;
GRANT SELECT ON templates TO anon;
GRANT ALL PRIVILEGES ON templates TO authenticated;
GRANT ALL ON backup_snapshots TO authenticated;

GRANT ALL PRIVILEGES ON scheduled_tasks TO authenticated;
GRANT ALL PRIVILEGES ON task_executions TO authenticated;
GRANT ALL PRIVILEGES ON task_tags TO authenticated;
GRANT ALL PRIVILEGES ON task_settings TO authenticated;
GRANT ALL PRIVILEGES ON queues TO authenticated;
GRANT SELECT ON scheduled_tasks TO anon;
GRANT SELECT ON task_executions TO anon;
GRANT SELECT ON task_tags TO anon;
GRANT SELECT ON task_settings TO anon;
GRANT SELECT ON queues TO anon;

GRANT ALL PRIVILEGES ON focus_sessions TO authenticated;
GRANT ALL PRIVILEGES ON user_achievements TO authenticated;
GRANT ALL PRIVILEGES ON user_focus_stats TO authenticated;
GRANT SELECT ON achievements TO authenticated;
GRANT SELECT ON focus_sessions TO anon;
GRANT SELECT ON achievements TO anon;
GRANT SELECT ON user_achievements TO anon;
GRANT SELECT ON user_focus_stats TO anon;

GRANT ALL PRIVILEGES ON task_templates TO authenticated;
GRANT SELECT ON task_templates TO anon;

GRANT ALL PRIVILEGES ON periodic_tasks TO authenticated;
GRANT ALL PRIVILEGES ON periodic_passes TO authenticated;
GRANT ALL PRIVILEGES ON user_pass_progress TO authenticated;
GRANT SELECT ON pass_rewards TO authenticated;
GRANT SELECT ON periodic_tasks TO anon;
GRANT SELECT ON periodic_passes TO anon;
GRANT SELECT ON pass_rewards TO anon;
GRANT SELECT ON user_pass_progress TO anon;

GRANT ALL PRIVILEGES ON task_dependencies TO authenticated;
GRANT ALL PRIVILEGES ON task_schedules TO authenticated;
GRANT ALL PRIVILEGES ON task_progress_plans TO authenticated;
GRANT ALL PRIVILEGES ON user_time_slots TO authenticated;
GRANT SELECT ON task_dependencies TO anon;
GRANT SELECT ON task_schedules TO anon;
GRANT SELECT ON task_progress_plans TO anon;
GRANT SELECT ON user_time_slots TO anon;

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION get_user_graphs_with_counts(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_trashed_graphs(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION batch_update_positions(JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION match_knowledge_points(vector(1024), float, int, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_accessible_knowledge_points(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION search_similar_knowledge_points(vector(1024), UUID, FLOAT, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_knowledge_point_graphs(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION soft_delete_graph_node(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION hard_delete_knowledge_point(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION search_similar_graphs(vector(1024), UUID, FLOAT, INT, UUID) TO authenticated;

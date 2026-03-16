-- =====================================================
-- Knowledge Map - SQLite Database Schema
-- Converted from Supabase PostgreSQL Schema
-- =====================================================

-- Enable foreign keys
PRAGMA foreign_keys = ON;

-- =====================================================
-- CORE TABLES
-- =====================================================

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT,
  name TEXT DEFAULT 'User',
  plan TEXT DEFAULT 'free' CHECK (plan IN ('free', 'premium')),
  settings TEXT DEFAULT '{}',
  xp INTEGER DEFAULT 0,
  level INTEGER DEFAULT 1,
  role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Knowledge graphs table
CREATE TABLE IF NOT EXISTS knowledge_graphs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  settings TEXT DEFAULT '{}',
  is_public INTEGER DEFAULT 0,
  is_favorite INTEGER DEFAULT 0,
  podcast_script TEXT,
  parent_graph_id TEXT REFERENCES knowledge_graphs(id) ON DELETE SET NULL,
  last_used_at TEXT DEFAULT (datetime('now')),
  embedding TEXT,
  deleted_at TEXT DEFAULT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Knowledge points table
CREATE TABLE IF NOT EXISTS knowledge_points (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT,
  learning_material TEXT,
  properties TEXT DEFAULT '{}',
  embedding TEXT,
  visibility TEXT DEFAULT 'private' CHECK (visibility IN ('private', 'public', 'pending')),
  owner_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Knowledge point versions table
CREATE TABLE IF NOT EXISTS knowledge_point_versions (
  id TEXT PRIMARY KEY,
  knowledge_point_id TEXT NOT NULL REFERENCES knowledge_points(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  title TEXT NOT NULL,
  content TEXT,
  learning_material TEXT,
  properties TEXT DEFAULT '{}',
  change_summary TEXT,
  changed_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(knowledge_point_id, version_number)
);

-- Graph nodes table
CREATE TABLE IF NOT EXISTS graph_nodes (
  id TEXT PRIMARY KEY,
  graph_id TEXT NOT NULL REFERENCES knowledge_graphs(id) ON DELETE CASCADE,
  knowledge_point_id TEXT NOT NULL REFERENCES knowledge_points(id) ON DELETE CASCADE,
  x_position REAL DEFAULT 0,
  y_position REAL DEFAULT 0,
  level TEXT DEFAULT 'normal' CHECK (level IN ('root', 'core', 'sub', 'normal', 'leaf')),
  is_accepted INTEGER DEFAULT 1,
  deleted_at TEXT DEFAULT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(graph_id, knowledge_point_id)
);

-- Edges table
CREATE TABLE IF NOT EXISTS edges (
  id TEXT PRIMARY KEY,
  graph_id TEXT REFERENCES knowledge_graphs(id) ON DELETE CASCADE,
  source_knowledge_point_id TEXT REFERENCES knowledge_points(id) ON DELETE CASCADE,
  target_knowledge_point_id TEXT REFERENCES knowledge_points(id) ON DELETE CASCADE,
  relationship_type TEXT DEFAULT 'related',
  weight INTEGER DEFAULT 1,
  custom_label TEXT,
  custom_color TEXT,
  custom_line_style TEXT DEFAULT 'solid',
  show_arrow INTEGER,
  deleted_at TEXT DEFAULT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(source_knowledge_point_id, target_knowledge_point_id, relationship_type),
  CONSTRAINT chk_line_style CHECK (custom_line_style IS NULL OR custom_line_style IN ('solid', 'dashed', 'dotted', 'double'))
);

-- Quiz sets table
CREATE TABLE IF NOT EXISTS quiz_sets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  graph_id TEXT REFERENCES knowledge_graphs(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  config TEXT DEFAULT '{}',
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'generating', 'ready')),
  card_count INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Study cards table
CREATE TABLE IF NOT EXISTS study_cards (
  id TEXT PRIMARY KEY,
  knowledge_point_id TEXT REFERENCES knowledge_points(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  graph_id TEXT REFERENCES knowledge_graphs(id) ON DELETE CASCADE,
  source_graph_id TEXT REFERENCES knowledge_graphs(id) ON DELETE SET NULL,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  explanation TEXT,
  card_type TEXT DEFAULT 'qa' CHECK (card_type IN ('qa', 'choice', 'true_false', 'multi_choice', 'fill_in_the_blank', 'essay')),
  options TEXT DEFAULT NULL,
  difficulty INTEGER DEFAULT 1 CHECK (difficulty BETWEEN 1 AND 5),
  last_reviewed TEXT,
  next_review TEXT DEFAULT (datetime('now')),
  review_count INTEGER DEFAULT 0,
  fsrs_state INTEGER DEFAULT 0,
  fsrs_stability REAL DEFAULT 0,
  fsrs_difficulty REAL DEFAULT 0,
  fsrs_elapsed_days REAL DEFAULT 0,
  fsrs_scheduled_days REAL DEFAULT 0,
  fsrs_retrievability REAL DEFAULT 0,
  fsrs_last_review TEXT,
  quiz_set_id TEXT REFERENCES quiz_sets(id) ON DELETE SET NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Quiz set cards table
CREATE TABLE IF NOT EXISTS quiz_set_cards (
  id TEXT PRIMARY KEY,
  quiz_set_id TEXT NOT NULL REFERENCES quiz_sets(id) ON DELETE CASCADE,
  card_id TEXT NOT NULL REFERENCES study_cards(id) ON DELETE CASCADE,
  display_order INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(quiz_set_id, card_id)
);

-- Study progress table
CREATE TABLE IF NOT EXISTS study_progress (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  graph_id TEXT REFERENCES knowledge_graphs(id) ON DELETE CASCADE,
  total_nodes INTEGER DEFAULT 0,
  mastered_nodes INTEGER DEFAULT 0,
  progress_percentage REAL DEFAULT 0,
  study_streak INTEGER DEFAULT 0,
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(user_id, graph_id)
);

-- Tasks table (async tasks)
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT,
  type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  payload TEXT DEFAULT '{}',
  result TEXT DEFAULT '{}',
  error TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Templates table
CREATE TABLE IF NOT EXISTS templates (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL CHECK (category IN ('learning', 'story', 'project', 'analysis', 'custom')),
  is_system INTEGER DEFAULT 0,
  nodes TEXT NOT NULL,
  edges TEXT DEFAULT '[]',
  layout TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Prompt templates table
CREATE TABLE IF NOT EXISTS prompt_templates (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL,
  scope TEXT NOT NULL CHECK (scope IN ('system', 'user', 'graph')),
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  graph_id TEXT REFERENCES knowledge_graphs(id) ON DELETE CASCADE,
  template_content TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
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
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  target_mode TEXT NOT NULL CHECK (target_mode IN ('show_result', 'update_node', 'spawn_children')),
  scope TEXT NOT NULL CHECK (scope IN ('system', 'user', 'graph')),
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  graph_id TEXT REFERENCES knowledge_graphs(id) ON DELETE CASCADE,
  prompt_template TEXT NOT NULL,
  variables TEXT DEFAULT '{}',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- App settings table
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  updated_at TEXT DEFAULT (datetime('now')),
  updated_by TEXT REFERENCES users(id)
);

-- Focus sessions table
CREATE TABLE IF NOT EXISTS focus_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  task_id TEXT,
  start_time TEXT NOT NULL DEFAULT (datetime('now')),
  end_time TEXT NOT NULL DEFAULT (datetime('now')),
  duration INTEGER NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('focus', 'shortBreak', 'longBreak')),
  completed INTEGER DEFAULT 1,
  pomodoro_count INTEGER DEFAULT 0,
  white_noise_type TEXT,
  is_break INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Achievements table
CREATE TABLE IF NOT EXISTS achievements (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  icon TEXT,
  color TEXT DEFAULT '#3B82F6',
  xp_reward INTEGER DEFAULT 100,
  condition_type TEXT NOT NULL,
  condition_value INTEGER NOT NULL,
  is_hidden INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

-- User achievements table
CREATE TABLE IF NOT EXISTS user_achievements (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  achievement_id TEXT REFERENCES achievements(id) ON DELETE CASCADE,
  progress INTEGER DEFAULT 0,
  metadata TEXT DEFAULT '{}',
  unlocked_at TEXT DEFAULT (datetime('now')),
  UNIQUE(user_id, achievement_id)
);

-- Daily tasks table
CREATE TABLE IF NOT EXISTS daily_tasks (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  task_date TEXT NOT NULL DEFAULT (date('now')),
  task_type TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  progress INTEGER DEFAULT 0,
  target INTEGER DEFAULT 1,
  xp_reward INTEGER DEFAULT 50,
  completed_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(user_id, task_date, task_type)
);

-- Graph relations table
CREATE TABLE IF NOT EXISTS graph_relations (
  id TEXT PRIMARY KEY,
  source_graph_id TEXT REFERENCES knowledge_graphs(id) ON DELETE CASCADE,
  target_graph_id TEXT REFERENCES knowledge_graphs(id) ON DELETE CASCADE,
  relation_type TEXT NOT NULL CHECK (relation_type IN ('prerequisite', 'extension', 'related')),
  context TEXT,
  metadata TEXT DEFAULT '{}',
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(source_graph_id, target_graph_id, relation_type)
);

-- Backup snapshots table
CREATE TABLE IF NOT EXISTS backup_snapshots (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER DEFAULT 0,
  graphs_count INTEGER DEFAULT 0,
  nodes_count INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Graph collaborators table
CREATE TABLE IF NOT EXISTS graph_collaborators (
  id TEXT PRIMARY KEY,
  graph_id TEXT NOT NULL REFERENCES knowledge_graphs(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('owner', 'editor', 'viewer')),
  invited_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  invitation_token TEXT DEFAULT (lower(hex(randomblob(16)))),
  invited_at TEXT DEFAULT (datetime('now')),
  accepted_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(graph_id, user_id)
);

-- =====================================================
-- SCHEDULER TABLES
-- =====================================================

-- Queues table
CREATE TABLE IF NOT EXISTS queues (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT 'blue',
  time_slice INTEGER NOT NULL DEFAULT 30,
  priority INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, priority)
);

-- Scheduled tasks table
CREATE TABLE IF NOT EXISTS scheduled_tasks (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  queue_id TEXT REFERENCES queues(id) ON DELETE SET NULL,
  queue_level INTEGER DEFAULT 0,
  position INTEGER NOT NULL DEFAULT 0,
  estimated_duration INTEGER,
  actual_duration INTEGER,
  deadline TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'paused', 'completed', 'cancelled')),
  tags TEXT DEFAULT '[]',
  knowledge_point_id TEXT,
  priority INTEGER DEFAULT 0,
  task_type TEXT DEFAULT 'one_time' CHECK (task_type IN ('one_time', 'long_term', 'periodic', 'learning')),
  total_duration INTEGER,
  progress_mode TEXT CHECK (progress_mode IN ('average', 'decreasing', 'increasing', 'custom')),
  progress_percentage INTEGER DEFAULT 0,
  parent_task_id TEXT REFERENCES scheduled_tasks(id),
  context TEXT,
  scheduled_start TEXT,
  scheduled_end TEXT,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  deleted_at TEXT,
  completed_at TEXT
);

-- Task executions table
CREATE TABLE IF NOT EXISTS task_executions (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES scheduled_tasks(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  started_at TEXT NOT NULL,
  ended_at TEXT,
  duration INTEGER,
  queue_level INTEGER,
  status TEXT CHECK (status IN ('completed', 'interrupted', 'time_slice_ended'))
);

-- Task tags table
CREATE TABLE IF NOT EXISTS task_tags (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#3B82F6',
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(user_id, name)
);

-- Task settings table
CREATE TABLE IF NOT EXISTS task_settings (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  q0_time_slice INTEGER DEFAULT 25,
  q1_time_slice INTEGER DEFAULT 50,
  q2_time_slice INTEGER DEFAULT 100,
  break_duration INTEGER DEFAULT 5,
  sound_enabled INTEGER DEFAULT 1,
  notification_enabled INTEGER DEFAULT 1
);

-- Task dependencies table
CREATE TABLE IF NOT EXISTS task_dependencies (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES scheduled_tasks(id) ON DELETE CASCADE,
  depends_on_task_id TEXT NOT NULL REFERENCES scheduled_tasks(id) ON DELETE CASCADE,
  dependency_type TEXT NOT NULL DEFAULT 'strict' CHECK (dependency_type IN ('strict', 'soft')),
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(task_id, depends_on_task_id)
);

-- Task schedules table
CREATE TABLE IF NOT EXISTS task_schedules (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  task_template_id TEXT NOT NULL REFERENCES scheduled_tasks(id) ON DELETE CASCADE,
  schedule_type TEXT NOT NULL CHECK (schedule_type IN ('daily', 'weekly', 'custom', 'smart')),
  schedule_config TEXT DEFAULT '{}',
  next_run_at TEXT,
  last_run_at TEXT,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Task progress plans table
CREATE TABLE IF NOT EXISTS task_progress_plans (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES scheduled_tasks(id) ON DELETE CASCADE,
  plan_date TEXT NOT NULL,
  planned_percentage INTEGER NOT NULL,
  actual_percentage INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'skipped')),
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(task_id, plan_date)
);

-- User time slots table
CREATE TABLE IF NOT EXISTS user_time_slots (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day_of_week INTEGER CHECK (day_of_week BETWEEN 0 AND 6),
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  is_available INTEGER DEFAULT 1,
  label TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(user_id, day_of_week, start_time)
);

-- =====================================================
-- RELATIONSHIP TYPES TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS relationship_types (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'custom',
  color TEXT NOT NULL DEFAULT '#6B7280',
  line_style TEXT NOT NULL DEFAULT 'solid',
  show_arrow TEXT NOT NULL DEFAULT 'auto',
  is_builtin INTEGER NOT NULL DEFAULT 0,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  CONSTRAINT chk_relationship_line_style CHECK (line_style IN ('solid', 'dashed', 'dotted', 'double')),
  CONSTRAINT chk_show_arrow CHECK (show_arrow IN ('true', 'false', 'auto'))
);

-- =====================================================
-- USER FOCUS STATS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS user_focus_stats (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  total_focus_seconds INTEGER DEFAULT 0,
  total_sessions INTEGER DEFAULT 0,
  total_pomodoros INTEGER DEFAULT 0,
  total_tasks_completed INTEGER DEFAULT 0,
  current_streak INTEGER DEFAULT 0,
  longest_streak INTEGER DEFAULT 0,
  weekly_streak INTEGER DEFAULT 0,
  monthly_streak INTEGER DEFAULT 0,
  quarterly_streak INTEGER DEFAULT 0,
  daily_task_streak INTEGER DEFAULT 0,
  last_daily_completion TEXT,
  last_focus_date TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- =====================================================
-- TASK TEMPLATES TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS task_templates (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'custom',
  title_template TEXT NOT NULL,
  description_template TEXT,
  estimated_duration INTEGER DEFAULT 25,
  tags TEXT DEFAULT '[]',
  priority INTEGER DEFAULT 2,
  is_default INTEGER DEFAULT 0,
  is_system INTEGER DEFAULT 0,
  usage_count INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- =====================================================
-- TASK REVIEWS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS task_reviews (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  task_id TEXT REFERENCES scheduled_tasks(id) ON DELETE SET NULL,
  review_type TEXT NOT NULL CHECK (review_type IN ('daily', 'task', 'weekly')),
  content TEXT,
  mood TEXT CHECK (mood IN ('great', 'good', 'neutral', 'tired', 'stressed')),
  difficulties TEXT,
  improvements TEXT,
  learnings TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- =====================================================
-- PERIODIC TASKS AND PASS SYSTEM
-- =====================================================

CREATE TABLE IF NOT EXISTS periodic_tasks (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  period_type TEXT NOT NULL CHECK (period_type IN ('weekly', 'monthly', 'quarterly')),
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  task_type TEXT NOT NULL CHECK (task_type IN ('focus', 'study', 'create', 'tasks')),
  target INTEGER NOT NULL,
  progress INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),
  xp_reward INTEGER NOT NULL,
  pass_points INTEGER NOT NULL DEFAULT 10,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  CONSTRAINT unique_user_period_task UNIQUE (user_id, period_type, period_start, task_type)
);

CREATE TABLE IF NOT EXISTS periodic_passes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  period_type TEXT NOT NULL CHECK (period_type IN ('weekly', 'monthly', 'quarterly')),
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  total_points INTEGER DEFAULT 0,
  current_level INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(user_id, period_type, period_start)
);

CREATE TABLE IF NOT EXISTS pass_rewards (
  id TEXT PRIMARY KEY,
  period_type TEXT NOT NULL CHECK (period_type IN ('weekly', 'monthly', 'quarterly')),
  level INTEGER NOT NULL,
  points_required INTEGER NOT NULL,
  reward_type TEXT NOT NULL CHECK (reward_type IN ('xp', 'achievement', 'badge')),
  reward_value INTEGER,
  achievement_code TEXT,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT DEFAULT '🎁',
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(period_type, level)
);

CREATE TABLE IF NOT EXISTS user_pass_progress (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pass_id TEXT NOT NULL REFERENCES periodic_passes(id) ON DELETE CASCADE,
  level INTEGER NOT NULL,
  claimed INTEGER DEFAULT 0,
  claimed_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(user_id, pass_id, level)
);

-- =====================================================
-- TASK SUBTASKS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS task_subtasks (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES scheduled_tasks(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
  priority INTEGER DEFAULT 0,
  position INTEGER DEFAULT 0,
  estimated_duration INTEGER,
  actual_duration INTEGER,
  due_date TEXT,
  completed_at TEXT,
  learning_path_node_id TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- =====================================================
-- TASK LINKS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS task_links (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES scheduled_tasks(id) ON DELETE CASCADE,
  link_type TEXT NOT NULL DEFAULT 'web' CHECK (link_type IN ('web', 'file', 'api')),
  title TEXT,
  url TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  metadata TEXT DEFAULT '{}',
  position INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- =====================================================
-- TASK KNOWLEDGE POINTS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS task_knowledge_points (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES scheduled_tasks(id) ON DELETE CASCADE,
  knowledge_point_id TEXT NOT NULL REFERENCES knowledge_points(id) ON DELETE CASCADE,
  relevance_score INTEGER DEFAULT 100 CHECK (relevance_score BETWEEN 0 AND 100),
  is_primary INTEGER DEFAULT 0,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(task_id, knowledge_point_id)
);

-- =====================================================
-- LEARNING PATHS TABLES
-- =====================================================

CREATE TABLE IF NOT EXISTS learning_paths (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  goal TEXT,
  target_date TEXT,
  source_graph_id TEXT REFERENCES knowledge_graphs(id) ON DELETE SET NULL,
  total_estimated_time INTEGER DEFAULT 0,
  ai_generated INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'paused', 'archived')),
  daily_minutes_target INTEGER DEFAULT 30,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS learning_path_nodes (
  id TEXT PRIMARY KEY,
  path_id TEXT NOT NULL REFERENCES learning_paths(id) ON DELETE CASCADE,
  knowledge_point_id TEXT REFERENCES knowledge_points(id) ON DELETE SET NULL,
  order_index INTEGER NOT NULL DEFAULT 0,
  title TEXT NOT NULL,
  description TEXT,
  estimated_time INTEGER DEFAULT 30,
  is_milestone INTEGER DEFAULT 0,
  prerequisites TEXT DEFAULT '[]',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'skipped')),
  started_at TEXT,
  completed_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS learning_path_progress (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  path_id TEXT NOT NULL REFERENCES learning_paths(id) ON DELETE CASCADE,
  node_id TEXT NOT NULL REFERENCES learning_path_nodes(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'skipped')),
  progress_percentage INTEGER DEFAULT 0 CHECK (progress_percentage BETWEEN 0 AND 100),
  time_spent INTEGER DEFAULT 0,
  notes TEXT,
  started_at TEXT,
  completed_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(user_id, path_id, node_id)
);

CREATE TABLE IF NOT EXISTS learning_plans (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  path_id TEXT NOT NULL REFERENCES learning_paths(id) ON DELETE CASCADE,
  plan_date TEXT NOT NULL,
  planned_nodes TEXT NOT NULL DEFAULT '[]',
  planned_duration INTEGER DEFAULT 0,
  actual_duration INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'partial', 'skipped')),
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(user_id, path_id, plan_date)
);

-- =====================================================
-- NOTIFICATIONS TABLES
-- =====================================================

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  data TEXT DEFAULT '{}',
  read_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  expires_at TEXT
);

CREATE TABLE IF NOT EXISTS notification_settings (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  browser_enabled INTEGER DEFAULT 1,
  sound_enabled INTEGER DEFAULT 1,
  sound_volume INTEGER DEFAULT 50,
  task_start_enabled INTEGER DEFAULT 1,
  task_complete_enabled INTEGER DEFAULT 1,
  time_slice_end_enabled INTEGER DEFAULT 0,
  deadline_enabled INTEGER DEFAULT 1,
  break_enabled INTEGER DEFAULT 1,
  daily_summary_enabled INTEGER DEFAULT 0,
  deadline_reminder_minutes TEXT DEFAULT '[30, 60]',
  do_not_disturb_enabled INTEGER DEFAULT 0,
  do_not_disturb_start TEXT DEFAULT '22:00',
  do_not_disturb_end TEXT DEFAULT '08:00',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- =====================================================
-- INDEXES
-- =====================================================

-- Users
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Knowledge graphs
CREATE INDEX IF NOT EXISTS idx_knowledge_graphs_user_id ON knowledge_graphs(user_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_graphs_is_public ON knowledge_graphs(is_public);
CREATE INDEX IF NOT EXISTS idx_graphs_deleted_at ON knowledge_graphs(deleted_at);
CREATE INDEX IF NOT EXISTS idx_knowledge_graphs_last_used_at ON knowledge_graphs(last_used_at);
CREATE INDEX IF NOT EXISTS idx_knowledge_graphs_user_deleted ON knowledge_graphs(user_id) WHERE deleted_at IS NULL;

-- Knowledge points
CREATE INDEX IF NOT EXISTS idx_knowledge_points_owner_id ON knowledge_points(owner_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_points_visibility ON knowledge_points(visibility);

-- Knowledge point versions
CREATE INDEX IF NOT EXISTS idx_knowledge_point_versions_kp_id ON knowledge_point_versions(knowledge_point_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_point_versions_version ON knowledge_point_versions(knowledge_point_id, version_number);

-- Graph nodes
CREATE INDEX IF NOT EXISTS idx_graph_nodes_graph_id ON graph_nodes(graph_id);
CREATE INDEX IF NOT EXISTS idx_graph_nodes_knowledge_point_id ON graph_nodes(knowledge_point_id);
CREATE INDEX IF NOT EXISTS idx_graph_nodes_level ON graph_nodes(level);
CREATE INDEX IF NOT EXISTS idx_graph_nodes_deleted_at ON graph_nodes(deleted_at);

-- Edges
CREATE INDEX IF NOT EXISTS idx_edges_source ON edges(source_knowledge_point_id);
CREATE INDEX IF NOT EXISTS idx_edges_target ON edges(target_knowledge_point_id);
CREATE INDEX IF NOT EXISTS idx_edges_graph_id ON edges(graph_id);
CREATE INDEX IF NOT EXISTS idx_edges_deleted_at ON edges(deleted_at);

-- Study cards
CREATE INDEX IF NOT EXISTS idx_study_cards_user_next_review ON study_cards(user_id, next_review);
CREATE INDEX IF NOT EXISTS idx_study_cards_knowledge_point_id ON study_cards(knowledge_point_id);
CREATE INDEX IF NOT EXISTS idx_study_cards_next_review ON study_cards(next_review);
CREATE INDEX IF NOT EXISTS idx_study_cards_fsrs_state ON study_cards(fsrs_state);
CREATE INDEX IF NOT EXISTS idx_study_cards_user_graph ON study_cards(user_id, graph_id);
CREATE INDEX IF NOT EXISTS idx_study_cards_quiz_set_id ON study_cards(quiz_set_id);

-- Quiz sets
CREATE INDEX IF NOT EXISTS idx_quiz_sets_user_id ON quiz_sets(user_id);
CREATE INDEX IF NOT EXISTS idx_quiz_sets_graph_id ON quiz_sets(graph_id);
CREATE INDEX IF NOT EXISTS idx_quiz_sets_status ON quiz_sets(status);

-- Quiz set cards
CREATE INDEX IF NOT EXISTS idx_quiz_set_cards_quiz_set_id ON quiz_set_cards(quiz_set_id);
CREATE INDEX IF NOT EXISTS idx_quiz_set_cards_card_id ON quiz_set_cards(card_id);

-- Study progress
CREATE INDEX IF NOT EXISTS idx_study_progress_user ON study_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_study_progress_graph_id ON study_progress(graph_id);

-- Tasks
CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at);

-- Templates
CREATE INDEX IF NOT EXISTS idx_templates_user_id ON templates(user_id);
CREATE INDEX IF NOT EXISTS idx_templates_category ON templates(category);
CREATE INDEX IF NOT EXISTS idx_templates_is_system ON templates(is_system);

-- Prompt templates
CREATE INDEX IF NOT EXISTS idx_prompt_templates_code ON prompt_templates(code);
CREATE INDEX IF NOT EXISTS idx_prompt_templates_user ON prompt_templates(user_id);

-- AI actions
CREATE INDEX IF NOT EXISTS idx_ai_actions_user ON ai_actions(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_actions_graph ON ai_actions(graph_id);

-- Focus sessions
CREATE INDEX IF NOT EXISTS idx_focus_sessions_user_id ON focus_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_focus_sessions_created_at ON focus_sessions(created_at);
CREATE INDEX IF NOT EXISTS idx_focus_sessions_user_date ON focus_sessions(user_id, start_time);

-- Achievements
CREATE INDEX IF NOT EXISTS idx_achievements_code ON achievements(code);
CREATE INDEX IF NOT EXISTS idx_achievements_category ON achievements(category);

-- User achievements
CREATE INDEX IF NOT EXISTS idx_user_achievements_user ON user_achievements(user_id);
CREATE INDEX IF NOT EXISTS idx_user_achievements_achievement ON user_achievements(achievement_id);

-- Daily tasks
CREATE INDEX IF NOT EXISTS idx_daily_tasks_user_date ON daily_tasks(user_id, task_date);

-- Graph relations
CREATE INDEX IF NOT EXISTS idx_graph_relations_source ON graph_relations(source_graph_id);
CREATE INDEX IF NOT EXISTS idx_graph_relations_target ON graph_relations(target_graph_id);

-- Backup snapshots
CREATE INDEX IF NOT EXISTS idx_backup_snapshots_user_id ON backup_snapshots(user_id);
CREATE INDEX IF NOT EXISTS idx_backup_snapshots_type ON backup_snapshots(type);

-- Graph collaborators
CREATE INDEX IF NOT EXISTS idx_graph_collaborators_graph_id ON graph_collaborators(graph_id);
CREATE INDEX IF NOT EXISTS idx_graph_collaborators_user_id ON graph_collaborators(user_id);
CREATE INDEX IF NOT EXISTS idx_graph_collaborators_invitation_token ON graph_collaborators(invitation_token);

-- Queues
CREATE INDEX IF NOT EXISTS idx_queues_user_id ON queues(user_id);
CREATE INDEX IF NOT EXISTS idx_queues_priority ON queues(user_id, priority);

-- Scheduled tasks
CREATE INDEX IF NOT EXISTS idx_scheduled_tasks_user_status ON scheduled_tasks(user_id, status);
CREATE INDEX IF NOT EXISTS idx_scheduled_tasks_user_queue_position ON scheduled_tasks(user_id, queue_level, position);
CREATE INDEX IF NOT EXISTS idx_scheduled_tasks_user_deleted ON scheduled_tasks(user_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_scheduled_tasks_queue_id ON scheduled_tasks(queue_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_tasks_parent_task ON scheduled_tasks(parent_task_id);

-- Task executions
CREATE INDEX IF NOT EXISTS idx_task_executions_task ON task_executions(task_id);
CREATE INDEX IF NOT EXISTS idx_task_executions_user_started ON task_executions(user_id, started_at);

-- Task tags
CREATE INDEX IF NOT EXISTS idx_task_tags_user ON task_tags(user_id);

-- Task settings
CREATE INDEX IF NOT EXISTS idx_task_settings_user ON task_settings(user_id);

-- Task dependencies
CREATE INDEX IF NOT EXISTS idx_task_dependencies_task ON task_dependencies(task_id);
CREATE INDEX IF NOT EXISTS idx_task_dependencies_depends_on ON task_dependencies(depends_on_task_id);

-- Task schedules
CREATE INDEX IF NOT EXISTS idx_task_schedules_user ON task_schedules(user_id);
CREATE INDEX IF NOT EXISTS idx_task_schedules_template ON task_schedules(task_template_id);
CREATE INDEX IF NOT EXISTS idx_task_schedules_next_run ON task_schedules(next_run_at) WHERE is_active = 1;

-- Task progress plans
CREATE INDEX IF NOT EXISTS idx_task_progress_plans_task ON task_progress_plans(task_id);
CREATE INDEX IF NOT EXISTS idx_task_progress_plans_date ON task_progress_plans(plan_date);

-- User time slots
CREATE INDEX IF NOT EXISTS idx_user_time_slots_user ON user_time_slots(user_id);
CREATE INDEX IF NOT EXISTS idx_user_time_slots_day ON user_time_slots(user_id, day_of_week);

-- Relationship types
CREATE INDEX IF NOT EXISTS idx_relationship_types_category ON relationship_types(category);
CREATE INDEX IF NOT EXISTS idx_relationship_types_user ON relationship_types(user_id);

-- User focus stats
CREATE INDEX IF NOT EXISTS idx_user_focus_stats_user ON user_focus_stats(user_id);

-- Task templates
CREATE INDEX IF NOT EXISTS idx_task_templates_user ON task_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_task_templates_category ON task_templates(category);
CREATE INDEX IF NOT EXISTS idx_task_templates_system ON task_templates(is_system);

-- Task reviews
CREATE INDEX IF NOT EXISTS idx_task_reviews_user_id ON task_reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_task_reviews_task_id ON task_reviews(task_id);
CREATE INDEX IF NOT EXISTS idx_task_reviews_created_at ON task_reviews(created_at);

-- Periodic tasks
CREATE INDEX IF NOT EXISTS idx_periodic_tasks_user ON periodic_tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_periodic_tasks_period ON periodic_tasks(user_id, period_type, period_start);

-- Periodic passes
CREATE INDEX IF NOT EXISTS idx_periodic_passes_user ON periodic_passes(user_id);
CREATE INDEX IF NOT EXISTS idx_periodic_passes_period ON periodic_passes(user_id, period_type, period_start);

-- Pass rewards
CREATE INDEX IF NOT EXISTS idx_pass_rewards_period ON pass_rewards(period_type, level);

-- User pass progress
CREATE INDEX IF NOT EXISTS idx_user_pass_progress_pass ON user_pass_progress(pass_id);
CREATE INDEX IF NOT EXISTS idx_user_pass_progress_user ON user_pass_progress(user_id);

-- Task subtasks
CREATE INDEX IF NOT EXISTS idx_task_subtasks_task_id ON task_subtasks(task_id);
CREATE INDEX IF NOT EXISTS idx_task_subtasks_status ON task_subtasks(status);

-- Task links
CREATE INDEX IF NOT EXISTS idx_task_links_task_id ON task_links(task_id);

-- Task knowledge points
CREATE INDEX IF NOT EXISTS idx_task_kp_task_id ON task_knowledge_points(task_id);
CREATE INDEX IF NOT EXISTS idx_task_kp_kp_id ON task_knowledge_points(knowledge_point_id);

-- Learning paths
CREATE INDEX IF NOT EXISTS idx_learning_paths_user ON learning_paths(user_id);
CREATE INDEX IF NOT EXISTS idx_learning_paths_status ON learning_paths(status);
CREATE INDEX IF NOT EXISTS idx_learning_paths_graph ON learning_paths(source_graph_id);

-- Learning path nodes
CREATE INDEX IF NOT EXISTS idx_learning_path_nodes_path_id ON learning_path_nodes(path_id);
CREATE INDEX IF NOT EXISTS idx_learning_path_nodes_order ON learning_path_nodes(path_id, order_index);
CREATE INDEX IF NOT EXISTS idx_learning_path_nodes_kp ON learning_path_nodes(knowledge_point_id);

-- Learning path progress
CREATE INDEX IF NOT EXISTS idx_learning_path_progress_user_path ON learning_path_progress(user_id, path_id);
CREATE INDEX IF NOT EXISTS idx_learning_path_progress_node ON learning_path_progress(node_id);

-- Learning plans
CREATE INDEX IF NOT EXISTS idx_learning_plans_user_date ON learning_plans(user_id, plan_date);
CREATE INDEX IF NOT EXISTS idx_learning_plans_path ON learning_plans(path_id);

-- Notifications
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read_at ON notifications(read_at);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);
CREATE INDEX IF NOT EXISTS idx_notification_settings_user_id ON notification_settings(user_id);

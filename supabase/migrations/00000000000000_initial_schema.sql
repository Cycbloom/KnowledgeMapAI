-- =====================================================
-- Knowledge Map - Unified Database Schema
-- Generated: 2026-02-13
-- Updated: 2026-02-21 (知识点与图谱解耦架构)
-- =====================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS vector;

-- Create enum types
CREATE TYPE prompt_scope AS ENUM ('system', 'user', 'graph');
CREATE TYPE knowledge_point_visibility AS ENUM ('private', 'public', 'pending');

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
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Knowledge graphs table
CREATE TABLE IF NOT EXISTS knowledge_graphs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  settings JSONB DEFAULT '{}',
  is_public BOOLEAN DEFAULT false,
  is_favorite BOOLEAN DEFAULT false,
  podcast_script TEXT,
  parent_graph_id UUID REFERENCES knowledge_graphs(id) ON DELETE SET NULL,
  last_used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Knowledge points table (独立的知识点实体)
CREATE TABLE IF NOT EXISTS knowledge_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
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
  deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(source_knowledge_point_id, target_knowledge_point_id, relationship_type)
);

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
  start_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  end_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  duration INTEGER NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('focus', 'shortBreak', 'longBreak')),
  completed BOOLEAN DEFAULT TRUE,
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
  xp_reward INTEGER DEFAULT 100,
  condition_type VARCHAR(50) NOT NULL,
  condition_value INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User achievements table
CREATE TABLE IF NOT EXISTS user_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  achievement_id UUID REFERENCES achievements(id) ON DELETE CASCADE,
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
-- INDEXES
-- =====================================================

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

-- Knowledge points
CREATE INDEX IF NOT EXISTS idx_knowledge_points_owner_id ON knowledge_points(owner_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_points_visibility ON knowledge_points(visibility);
CREATE INDEX IF NOT EXISTS idx_knowledge_points_title_trgm ON knowledge_points USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_knowledge_points_content_trgm ON knowledge_points USING gin (content gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_knowledge_points_embedding ON knowledge_points USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_knowledge_points_public ON knowledge_points(id) WHERE visibility = 'public';
CREATE INDEX IF NOT EXISTS idx_knowledge_points_owner_visibility ON knowledge_points(owner_id, visibility);

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

-- Achievements
CREATE INDEX IF NOT EXISTS idx_achievements_code ON achievements(code);

-- User achievements
CREATE INDEX IF NOT EXISTS idx_user_achievements_user ON user_achievements(user_id);
CREATE INDEX IF NOT EXISTS idx_user_achievements_achievement ON user_achievements(achievement_id);

-- Daily tasks
CREATE INDEX IF NOT EXISTS idx_daily_tasks_user_date ON daily_tasks(user_id, task_date);

-- Graph relations
CREATE INDEX IF NOT EXISTS idx_graph_relations_source ON graph_relations(source_graph_id);
CREATE INDEX IF NOT EXISTS idx_graph_relations_target ON graph_relations(target_graph_id);
CREATE INDEX IF NOT EXISTS idx_graph_relations_type ON graph_relations(relation_type);

-- Backup snapshots
CREATE INDEX IF NOT EXISTS idx_backup_snapshots_user_id ON backup_snapshots(user_id);
CREATE INDEX IF NOT EXISTS idx_backup_snapshots_type ON backup_snapshots(type);

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
CREATE POLICY "Achievements are viewable by everyone" ON achievements FOR SELECT USING (true);

-- User Achievements
ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own achievements" ON user_achievements FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own achievements" ON user_achievements FOR INSERT WITH CHECK (auth.uid() = user_id);

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
  title text,
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
  title TEXT,
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
    FROM graph_nodes
    WHERE deleted_at IS NULL
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
  title TEXT,
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
    FROM graph_nodes
    WHERE deleted_at IS NULL
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
  title VARCHAR(255),
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
  title VARCHAR(255),
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
  graph_title VARCHAR(255),
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

-- =====================================================
-- Knowledge Map - Unified Database Schema
-- Generated: 2026-02-13
-- =====================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS vector;

-- Create enum types
CREATE TYPE prompt_scope AS ENUM ('system', 'user', 'graph');

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
  podcast_script TEXT,
  deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Nodes table
CREATE TABLE IF NOT EXISTS nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  graph_id UUID REFERENCES knowledge_graphs(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  content TEXT,
  learning_material TEXT,
  properties JSONB DEFAULT '{}',
  x_position FLOAT DEFAULT 0,
  y_position FLOAT DEFAULT 0,
  level TEXT DEFAULT 'normal' CHECK (level IN ('root', 'core', 'sub', 'normal', 'leaf')),
  is_accepted BOOLEAN DEFAULT TRUE,
  embedding vector(1024),
  deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Edges table
CREATE TABLE IF NOT EXISTS edges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  graph_id UUID REFERENCES knowledge_graphs(id) ON DELETE CASCADE,
  source_node_id UUID REFERENCES nodes(id) ON DELETE CASCADE,
  target_node_id UUID REFERENCES nodes(id) ON DELETE CASCADE,
  relationship_type VARCHAR(50) DEFAULT 'related',
  weight INTEGER DEFAULT 1,
  deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(source_node_id, target_node_id, relationship_type)
);

-- Study cards table
CREATE TABLE IF NOT EXISTS study_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  node_id UUID REFERENCES nodes(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  graph_id UUID REFERENCES knowledge_graphs(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  explanation TEXT,
  card_type VARCHAR(20) DEFAULT 'qa' CHECK (card_type IN ('qa', 'choice', 'true_false', 'multi_choice', 'fill_in_the_blank', 'essay')),
  options JSONB DEFAULT NULL,
  difficulty INTEGER DEFAULT 1 CHECK (difficulty BETWEEN 1 AND 5),
  last_reviewed TIMESTAMP WITH TIME ZONE,
  next_review TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  review_count INTEGER DEFAULT 0,
  -- FSRS fields
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

-- =====================================================
-- INDEXES
-- =====================================================

-- Knowledge graphs
CREATE INDEX IF NOT EXISTS idx_knowledge_graphs_user_id ON knowledge_graphs(user_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_graphs_is_public ON knowledge_graphs(is_public);
CREATE INDEX IF NOT EXISTS idx_knowledge_graphs_title_trgm ON knowledge_graphs USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_graphs_deleted_at ON knowledge_graphs(deleted_at);

-- Nodes
CREATE INDEX IF NOT EXISTS idx_nodes_graph_id ON nodes(graph_id);
CREATE INDEX IF NOT EXISTS idx_nodes_level ON nodes(level);
CREATE INDEX IF NOT EXISTS idx_nodes_is_accepted ON nodes(is_accepted);
CREATE INDEX IF NOT EXISTS idx_nodes_title_trgm ON nodes USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_nodes_content_trgm ON nodes USING gin (content gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_nodes_deleted_at ON nodes(deleted_at);
CREATE INDEX IF NOT EXISTS idx_nodes_embedding ON nodes USING hnsw (embedding vector_cosine_ops);

-- Edges
CREATE INDEX IF NOT EXISTS idx_edges_source ON edges(source_node_id);
CREATE INDEX IF NOT EXISTS idx_edges_target ON edges(target_node_id);
CREATE INDEX IF NOT EXISTS idx_edges_graph_id ON edges(graph_id);
CREATE INDEX IF NOT EXISTS idx_edges_deleted_at ON edges(deleted_at);

-- Study cards
CREATE INDEX IF NOT EXISTS idx_study_cards_user_next_review ON study_cards(user_id, next_review);
CREATE INDEX IF NOT EXISTS idx_study_cards_node_id ON study_cards(node_id);
CREATE INDEX IF NOT EXISTS idx_study_cards_next_review ON study_cards(next_review);
CREATE INDEX IF NOT EXISTS idx_study_cards_fsrs_state ON study_cards(fsrs_state);
CREATE INDEX IF NOT EXISTS idx_study_cards_user_graph ON study_cards(user_id, graph_id);
CREATE INDEX IF NOT EXISTS idx_study_cards_user_node ON study_cards(user_id, node_id);
CREATE INDEX IF NOT EXISTS idx_study_cards_user_state ON study_cards(user_id, fsrs_state);
CREATE INDEX IF NOT EXISTS idx_study_cards_user_last_reviewed ON study_cards(user_id, last_reviewed);
CREATE INDEX IF NOT EXISTS idx_study_cards_graph_id ON study_cards(graph_id);
CREATE INDEX IF NOT EXISTS idx_study_cards_user_id ON study_cards(user_id);

-- Study progress
CREATE INDEX IF NOT EXISTS idx_study_progress_user ON study_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_study_progress_graph_id ON study_progress(graph_id);

-- Tasks
CREATE INDEX IF NOT EXISTS tasks_user_id_idx ON tasks(user_id);
CREATE INDEX IF NOT EXISTS tasks_status_idx ON tasks(status);
CREATE INDEX IF NOT EXISTS tasks_created_at_idx ON tasks(created_at);
CREATE INDEX IF NOT EXISTS tasks_user_status_idx ON tasks(user_id, status);

-- Templates
CREATE INDEX IF NOT EXISTS idx_templates_user_id ON templates(user_id);
CREATE INDEX IF NOT EXISTS idx_templates_category ON templates(category);
CREATE INDEX IF NOT EXISTS idx_templates_is_system ON templates(is_system);

-- AI actions
CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_actions_unique_name_scope 
  ON ai_actions (name, scope, COALESCE(user_id, '00000000-0000-0000-0000-000000000000'), COALESCE(graph_id, '00000000-0000-0000-0000-000000000000'));

-- Focus sessions
CREATE INDEX IF NOT EXISTS focus_sessions_user_id_idx ON focus_sessions(user_id);
CREATE INDEX IF NOT EXISTS focus_sessions_created_at_idx ON focus_sessions(created_at);

-- User achievements
CREATE INDEX IF NOT EXISTS idx_user_achievements_user ON user_achievements(user_id);

-- Daily tasks
CREATE INDEX IF NOT EXISTS idx_daily_tasks_user_date ON daily_tasks(user_id, task_date);

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

-- Nodes
ALTER TABLE nodes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view nodes of own graphs" ON nodes FOR SELECT USING (EXISTS (
  SELECT 1 FROM knowledge_graphs WHERE knowledge_graphs.id = nodes.graph_id AND knowledge_graphs.user_id = auth.uid()
));
CREATE POLICY "Users can insert nodes to own graphs" ON nodes FOR INSERT WITH CHECK (EXISTS (
  SELECT 1 FROM knowledge_graphs WHERE knowledge_graphs.id = nodes.graph_id AND knowledge_graphs.user_id = auth.uid()
));
CREATE POLICY "Users can update nodes of own graphs" ON nodes FOR UPDATE USING (EXISTS (
  SELECT 1 FROM knowledge_graphs WHERE knowledge_graphs.id = nodes.graph_id AND knowledge_graphs.user_id = auth.uid()
));
CREATE POLICY "Users can delete nodes of own graphs" ON nodes FOR DELETE USING (EXISTS (
  SELECT 1 FROM knowledge_graphs WHERE knowledge_graphs.id = nodes.graph_id AND knowledge_graphs.user_id = auth.uid()
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

-- Match nodes function for semantic search
CREATE OR REPLACE FUNCTION match_nodes (
  query_embedding vector(2048),
  match_threshold float,
  match_count int,
  p_user_id uuid
)
RETURNS TABLE (
  id uuid,
  title text,
  content text,
  graph_id uuid,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    nodes.id,
    nodes.title,
    nodes.content,
    nodes.graph_id,
    1 - (nodes.embedding <=> query_embedding) as similarity
  FROM nodes
  JOIN knowledge_graphs ON nodes.graph_id = knowledge_graphs.id
  WHERE knowledge_graphs.user_id = p_user_id
  AND 1 - (nodes.embedding <=> query_embedding) > match_threshold
  ORDER BY nodes.embedding <=> query_embedding
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

-- =====================================================
-- GRANTS
-- =====================================================

GRANT SELECT ON users TO anon;
GRANT ALL PRIVILEGES ON users TO authenticated;
GRANT SELECT ON knowledge_graphs TO anon;
GRANT ALL PRIVILEGES ON knowledge_graphs TO authenticated;
GRANT SELECT ON nodes TO anon;
GRANT ALL PRIVILEGES ON nodes TO authenticated;
GRANT SELECT ON edges TO anon;
GRANT ALL PRIVILEGES ON edges TO authenticated;
GRANT SELECT ON study_cards TO anon;
GRANT ALL PRIVILEGES ON study_cards TO authenticated;
GRANT SELECT ON study_progress TO anon;
GRANT ALL PRIVILEGES ON study_progress TO authenticated;
GRANT SELECT ON templates TO anon;
GRANT ALL PRIVILEGES ON templates TO authenticated;

-- =====================================================
-- SEED DATA
-- =====================================================

-- App settings
INSERT INTO app_settings (key, value, description) VALUES 
    ('ai_provider_config', '{
        "deepseek": { "enabled": true, "apiKey": "", "baseURL": "https://api.deepseek.com", "model": "deepseek-chat" },
        "volcengine": { "enabled": true, "apiKey": "", "baseURL": "https://ark.cn-beijing.volces.com/api/v3", "model": "doubao-seed-1-8-251228", "embeddingModel": "doubao-embedding-vision-251215" },
        "aliyun": { "enabled": true, "apiKey": "", "baseURL": "https://dashscope.aliyuncs.com/compatible-mode/v1", "model": "qwen-long-latest" }
    }'::jsonb, 'Configuration for AI Providers'),
    ('system_config', '{
        "default_provider": "deepseek",
        "task_mapping": { "text": "deepseek", "embedding": "volcengine", "reasoning": "aliyun" }
    }'::jsonb, 'Global system settings and defaults')
ON CONFLICT (key) DO NOTHING;

-- Achievements
INSERT INTO achievements (code, name, description, category, icon, xp_reward, condition_type, condition_value) VALUES
  ('streak_3', '初出茅庐', '保持3天连续学习', 'study', 'Flame', 100, 'streak_days', 3),
  ('streak_7', '坚持不懈', '保持7天连续学习', 'study', 'Zap', 300, 'streak_days', 7),
  ('streak_14', '持之以恒', '保持14天连续学习', 'study', 'Zap', 500, 'streak_days', 14),
  ('streak_30', '月度大师', '保持30天连续学习', 'study', 'Crown', 1000, 'streak_days', 30),
  ('streak_100', '百日筑基', '保持100天连续学习', 'study', 'Crown', 5000, 'streak_days', 100),
  ('focus_10', '专注时刻', '完成10分钟专注时间', 'focus', 'Timer', 50, 'focus_minutes', 10),
  ('focus_60', '深度潜入', '完成60分钟专注时间', 'focus', 'Timer', 150, 'focus_minutes', 60),
  ('focus_300', '专注大师', '完成300分钟(5小时)专注时间', 'focus', 'Brain', 500, 'focus_minutes', 300),
  ('focus_1000', '心流境界', '完成1000分钟专注时间', 'focus', 'Brain', 1500, 'focus_minutes', 1000),
  ('mastery_1', '初试牛刀', '掌握1张知识卡片', 'study', 'GraduationCap', 50, 'cards_mastered', 1),
  ('mastery_10', '跬步千里', '掌握10张知识卡片', 'study', 'GraduationCap', 100, 'cards_mastered', 10),
  ('mastery_50', '求知若渴', '掌握50张知识卡片', 'study', 'BookOpen', 300, 'cards_mastered', 50),
  ('mastery_100', '领域专家', '掌握100张知识卡片', 'study', 'Trophy', 600, 'cards_mastered', 100),
  ('mastery_500', '博闻强识', '掌握500张知识卡片', 'study', 'Trophy', 2500, 'cards_mastered', 500),
  ('creation_graph_1', '创世之初', '创建第1个知识图谱', 'creation', 'BookOpen', 200, 'graphs_created', 1),
  ('creation_graph_5', '知识架构师', '创建5个知识图谱', 'creation', 'BookOpen', 800, 'graphs_created', 5),
  ('creation_node_10', '萌芽', '创建10个知识节点', 'creation', 'Target', 100, 'nodes_created', 10),
  ('creation_node_100', '枝繁叶茂', '创建100个知识节点', 'creation', 'Target', 500, 'nodes_created', 100),
  ('creation_node_1000', '知识森林', '创建1000个知识节点', 'creation', 'Target', 2000, 'nodes_created', 1000)
ON CONFLICT (code) DO NOTHING;

-- Templates (simplified - key ones only)
INSERT INTO templates (id, user_id, name, description, category, is_system, nodes, edges, layout) VALUES
  (gen_random_uuid(), NULL, '概念学习', '适用于学习新概念，从定义到应用的完整学习路径', 'learning', true, 
   '[{"id":"node-1","title":"主题","level":"root"},{"id":"node-2","title":"定义","level":"core"},{"id":"node-3","title":"特点","level":"core"}]'::jsonb,
   '[{"source":"node-1","target":"node-2"},{"source":"node-1","target":"node-3"}]'::jsonb,
   NULL)
ON CONFLICT DO NOTHING;

-- AI Actions
INSERT INTO ai_actions (name, description, icon, target_mode, scope, prompt_template) VALUES
  ('精炼内容', '将节点内容精炼为简洁的几句话', 'Minimize2', 'update_node', 'system', '请将以下内容精炼为3-5句话，保留核心观点和关键事实。直接返回精炼后的内容，不要有开场白。\n\n内容：\n{{nodeContent}}'),
  ('反向辩驳', '提出该观点的反面论证或潜在缺陷', 'MessageSquareWarning', 'show_result', 'system', '请扮演一个批判性思维者，针对以下观点提出反面论证、潜在缺陷或被忽视的视角。\n\n观点：{{nodeTitle}}\n详细内容：{{nodeContent}}')
ON CONFLICT DO NOTHING;

-- Prompt Templates (complete)
INSERT INTO "public"."prompt_templates" ("id", "code", "scope", "user_id", "graph_id", "template_content", "created_at", "updated_at") VALUES 
('a33b9b47-db64-421f-b40d-ae073cf49250', 'expand_knowledge', 'system', null, null, 'You are a knowledge graph expert. Suggest a comprehensive list of related sub-topics or concepts for the given node to expand the graph deeply.

Goal: Prioritize generating NEW, specific concepts to broaden the graph''s coverage.
Quantity: Generate up to 8 nodes. Focus on representativeness and hierarchy.

Linking Strategy:
{{#if isRootOrCore}}
Linking Strategy (HIERARCHICAL):
1. **NO Same-Level Links**: Do NOT link to nodes that are at the SAME level (siblings/cousins).
2. **Vertical Links OK**: You MAY link to nodes that would be considered a ''parent'' (higher level) or ''child'' (lower level) contextually.
3. **Focus**: Primary goal is to generate NEW specific child nodes for the current node.
{{else}}
{{#if isLeaf}}
Linking Strategy (NETWORK): You are expanding a leaf node. You are encouraged to link to ''Existing Nodes'' if they are highly relevant, especially other leaf nodes, to form knowledge connections.
{{else}}
Linking Strategy (HIERARCHICAL):
1. **NO Same-Level Links**: Do NOT link to nodes that are at the SAME level (siblings/cousins).
2. **Vertical Links OK**: You MAY link to nodes that would be considered a ''parent'' (higher level) or ''child'' (lower level) contextually.
3. **Focus**: Primary goal is to generate NEW specific child nodes for the current node.
{{/if}}
{{/if}}

Content Strategy:
{{#if isRootOrCore}}
Content Strategy (HIGH LEVEL): Suggest BROAD CATEGORIES or MAJOR BRANCHES. The ''content'' should be a high-level summary or definition.
{{else}}
{{#if isLeaf}}
Content Strategy (LEAF LEVEL): Suggest ATOMIC DETAILS, EXAMPLES, or ATTRIBUTES. The ''content'' should be very specific, technical, and detailed.
{{else}}
Content Strategy (MID LEVEL): Suggest SPECIFIC CONCEPTS or FUNCTIONAL COMPONENTS. The ''content'' should be descriptive and explain ''how'' or ''why''.
{{/if}}
{{/if}}

Do not suggest topics that are already listed in ''Current Direct Children''.', '2026-02-09 08:32:26.326666+00', '2026-02-09 08:32:26.326666+00'),
('94b56290-5a18-432e-91e4-50a5f9c0c6b7', 'generate_cards', 'system', null, null, 'You are an educational expert. Generate {{count}} flashcards based on the provided topic and content.

Context: The current node is part of a larger knowledge structure.
{{#if context}}Parent/Context Info: {{context}}{{/if}}

Requirements:
1. Generate exactly {{count}} cards.
2. Allowed Types: {{allowedTypes}}.
3. Mix the types if multiple are selected.

{{#if includesQA}}
For ''qa'' type: Create thought-provoking open-ended questions that test deep understanding. Provide a detailed ''explanation'' analyzing the answer.
{{/if}}

{{#if includesChoice}}
For ''choice'' type: Create multiple-choice questions with 4 plausible options. Provide the correct answer and a detailed ''explanation'' of why it is correct and others are wrong.
{{/if}}

{{#if includesTrueFalse}}
For ''true_false'' type: Create statements focusing on common misconceptions or key details. Provide a detailed ''explanation''.
{{/if}}

{{#if includesMultiChoice}}
For ''multi_choice'' type: Create multiple-choice questions where ONE OR MORE options can be correct. Provide 4 options, the ''answer'' as a JSON array of correct strings, and a detailed ''explanation''.
{{/if}}

{{#if includesFillBlank}}
For ''fill_in_the_blank'' type: Create a sentence with one or more ''___'' (3 underscores) as blanks. The ''answer'' should be the missing text. Provide a detailed ''explanation''.
{{/if}}

{{#if includesEssay}}
For ''essay'' type: Create complex questions requiring a long-form structured answer. The ''answer'' should be a model response with key points. Provide a detailed ''explanation'' with scoring criteria.
{{/if}}', '2026-02-09 08:32:26.326666+00', '2026-02-09 08:32:26.326666+00'),
('b3108f00-fca2-4f9d-8f39-627775545920', 'chat', 'system', null, null, 'You are an intelligent assistant for a Knowledge Graph.
Answer the user''s question based on the provided Graph Context.

Graph Context:
{{contextText}}

Instructions:
1. Use the information in the Graph Context to answer.
2. If the answer is not in the context, use your general knowledge but mention that it''s not explicitly in the graph.
3. Be concise and helpful.
4. Respond in the same language as the user''s question (default to Chinese).', '2026-02-09 08:32:26.326666+00', '2026-02-09 08:32:26.326666+00'),
('7a17cba5-5d56-424c-8097-6c327fad6cd4', 'text_to_graph', 'system', null, null, 'You are a knowledge graph expert. Analyze the provided text and extract key concepts to build a structured Knowledge Tree.

Requirements:
1. Identify ONE main Topic as the ''root'' node.
2. Filter out irrelevant text, noise, or meta-commentary (e.g., "exam points", "irrelevant context", "ads", "author info"). Focus ONLY on the main subject matter.
3. Organize nodes into a strict 5-level hierarchy: ''root'' -> ''core'' -> ''sub'' -> ''normal'' -> ''leaf''.
   - ''root'': The main topic (1 node).
   - ''core'': Key categories or major concepts (direct children of root).
   - ''sub'': Secondary concepts or branches (children of core).
   - ''normal'': Detailed concepts or standard nodes (children of sub).
   - ''leaf'': Specific examples, minor details, or data points (children of normal).
4. Output a TREE structure. Minimise cross-links to keep it clean. Ensure every node (except root) has a valid parent.
5. **Content Richness**: Every node must have substantial ''content'' description, not just a title.
6. IMPORTANT: All mathematical formulas in ''content'' must be wrapped in standard LaTeX delimiters. Use $...$ for inline formulas and $$...$$ for block formulas.
7. Limit the output to a maximum of 50-100 nodes. Prioritize the most important concepts to fit within this limit.', '2026-02-09 08:32:26.326666+00', '2026-02-09 08:32:26.326666+00'),
('e82f5056-2303-47b4-b88a-55beefde86be', 'tutor_chat', 'system', null, null, 'You are an intelligent knowledge tutor for a Knowledge Graph application.

{{#if isGuided}}
Guided Mode: Follow a structured learning path. Guide the user step-by-step through the knowledge graph. Ask questions to assess understanding before moving to the next topic.
{{else}}
Free Mode: Allow open-ended discussion. Answer questions freely and explore topics based on user interest. Extract key concepts from the conversation that could be added to the knowledge graph.
{{/if}}

Current Context:
{{#if currentNodeId}}
Current Node:
- Title: {{currentNodeTitle}}
- Content: {{currentNodeContent}}
{{/if}}

{{#if existingNodes}}
Existing Nodes in Graph:
{{existingNodes}}
{{/if}}

Instructions:
1. Be conversational and engaging
2. Use markdown formatting for better readability
3. When explaining concepts, provide examples
4. In free mode, identify key concepts that could be new nodes in the knowledge graph
5. In guided mode, follow the learning path and check understanding
6. Respond in the same language as the user (default to Chinese)
7. All mathematical formulas must be wrapped in LaTeX: $inline$ or $$block$$', '2026-02-09 08:32:26.326666+00', '2026-02-09 08:32:26.326666+00'),
('2c84dede-66c6-43ac-acba-7bad70d8b243', 'branch_suggestions', 'system', null, null, 'You are a knowledge graph expert specializing in creating interactive exploration paths like story branches or adventure game choices.

Goal: Generate 3-5 distinct branch suggestions for the user to explore from the current node.
Each branch should represent a different direction or perspective the user could take.

Quantity: Generate exactly 3-5 branches.

Linking Strategy:
{{#if isRootOrCore}}
Linking Strategy (HIERARCHICAL):
1. **NO Same-Level Links**: Do NOT link to nodes that are at the SAME level.
2. **Vertical Links OK**: You MAY link to parent or child nodes.
{{else}}
{{#if isLeaf}}
Linking Strategy (NETWORK): You are expanding a leaf node. Encourage linking to ''Existing Nodes'' if relevant.
{{else}}
Linking Strategy (HIERARCHICAL):
1. **NO Same-Level Links**: Do NOT link to nodes that are at the SAME level.
2. **Vertical Links OK**: You MAY link to parent or child nodes.
{{/if}}
{{/if}}

Content Strategy:
{{#if isRootOrCore}}
Content Strategy (HIGH LEVEL): Suggest BROAD CATEGORIES or MAJOR BRANCHES.
{{else}}
{{#if isLeaf}}
Content Strategy (LEAF LEVEL): Suggest ATOMIC DETAILS, EXAMPLES, or ATTRIBUTES.
{{else}}
Content Strategy (MID LEVEL): Suggest SPECIFIC CONCEPTS or FUNCTIONAL COMPONENTS.
{{/if}}
{{/if}}

Do not suggest topics that are already listed in ''Current Direct Children''.', '2026-02-09 08:32:26.326666+00', '2026-02-09 08:32:26.326666+00'),
('c713eac8-cc22-46a1-b814-65738792d210', 'deep_analysis', 'system', null, null, 'You are an expert professor and researcher. Your task is to provide a deep analysis of the following concept: "{{node_title}}".

Context:
{{node_content}}

Please provide a structured analysis including:
1. Historical Context & Origin
2. Core Principles & Mechanisms
3. Advanced Applications & Edge Cases
4. Cross-disciplinary Connections
5. Current Research Trends (if applicable)

Format your response in Markdown.
IMPORTANT: Directly output the analysis content. Do NOT include any conversational filler (e.g., "Okay", "Here is the analysis", "As an expert...").', '2026-02-09 17:07:36.60188+00', '2026-02-09 17:07:36.60188+00'),
('ca14d0a7-6f50-4001-bc2a-ba4f051cde8a', 'document_to_graph', 'system', null, null, 'You are a top-tier knowledge architect, skilled in reconstructing original knowledge outlines and logical hierarchies from unstructured documents.

Your Task:
1. **Identify Hierarchy Cues**: Deeply analyze numbering (e.g., Chapter 1, 1.1, I, (1)), font features (ALL CAPS), and logical progression.
2. **Reconstruct Outline**: Map the document structure to the 5-level model:
   - ''root'': Document title or core subject (1 node).
   - ''core'': Level 1 headers/Chapters.
   - ''sub'': Level 2 headers/Sections.
   - ''normal'': Level 3 headers/Sub-sections or core concepts.
   - ''leaf'': Details, definitions, examples.
3. **Maintain Logic Chain**: Ensure edges accurately reflect parent-child inclusion. Every child MUST point to its direct parent ID.
4. **Clean Noise**: Ignore page numbers, headers, irrelevant symbols.

Output Requirements:
- Node titles must preserve core terminology.
- **Content Richness**: Each node MUST have substantial ''content'' (100-200 words), not just a title.
- Node count: 40-60 nodes to ensure completeness.
- All titles and descriptions in Chinese.', '2026-02-09 08:32:26.326666+00', '2026-02-09 08:32:26.326666+00'),
('9c49f6c0-abe5-442f-9b41-70142c2b1005', 'generate_content', 'system', null, null, 'You are an expert tutor and content creator. Generate detailed, structured educational content for the topic "{{topic}}".

Context: {{context}}

{{#if isRoot}}
Strategy (ROOT/CORE): Provide a comprehensive overview, high-level definitions, and major categories. Focus on the big picture and foundational concepts.
{{else}}
{{#if isLeaf}}
Strategy (LEAF): Provide specific details, technical specifications, examples, and deep analysis. Focus on the "how" and "why" of this specific atomic concept.
{{else}}
Strategy (NORMAL/SUB): Provide a balanced explanation covering key components, relationships, and functional descriptions. Connect the concept to its parent context.
{{/if}}
{{/if}}

Format your response in Markdown. Use headers, bullet points, and code blocks (if applicable) to make it readable.', '2026-02-09 08:32:26.326666+00', '2026-02-09 08:32:26.326666+00'),
('1cd5bc33-3c49-4cb8-814b-1468717addc1', 'recommend_connections', 'system', null, null, 'You are a knowledge graph expert. Given a new node (title and content) and a list of existing nodes in a graph, suggest 1-3 most relevant existing nodes to connect to.

New Node:
Title: {{node_title}}
Content: {{node_content}}

Existing Nodes:
{{existing_nodes_json}}', '2026-02-09 08:32:26.326666+00', '2026-02-09 08:32:26.326666+00'),
('6c0d5777-8633-4056-8ea5-253195d0c73b', 'term_annotation', 'system', null, null, '你是一个专业的学术助手。请分析以下文本，提取其中的关键专业术语。', '2026-02-09 15:15:32.619571+00', '2026-02-09 15:15:32.619571+00'),
('3bfbebb8-0f98-44bd-8185-a065ecb21112', 'generate_cards_choice', 'system', null, null, 'For ''choice'' type: Create multiple-choice questions with 4 plausible options. 
Provide the correct answer and a detailed ''explanation'' of why it is correct and others are wrong.
Distractors should be common misconceptions if possible.', '2026-02-10 13:37:50.705989+00', '2026-02-10 13:37:50.705989+00'),
('09e280f5-69e7-4ef4-b5de-51372f609dfd', 'generate_cards_essay', 'system', null, null, 'For ''essay'' type: Create complex questions requiring a long-form structured answer. 
The ''answer'' should be a model response with key points. 
Provide a detailed ''explanation'' with scoring criteria and key concepts to cover.', '2026-02-10 13:37:50.705989+00', '2026-02-10 13:37:50.705989+00'),
('a16f5d2a-3dd9-4249-ba0b-5a956ef02ff1', 'generate_cards_fill_blank', 'system', null, null, 'For ''fill_in_the_blank'' type: Create a sentence with one or more ''___'' (3 underscores) as blanks. 
The ''answer'' should be the missing text. Provide a detailed ''explanation''.', '2026-02-10 13:37:50.705989+00', '2026-02-10 13:37:50.705989+00'),
('1dcfb0f7-ffcb-4110-b9bc-32157a8e9053', 'generate_cards_multi_choice', 'system', null, null, 'For ''multi_choice'' type: Create multiple-choice questions where ONE OR MORE options can be correct. 
Provide 4 options, the ''answer'' as a JSON array of correct strings, and a detailed ''explanation''.', '2026-02-10 13:37:50.705989+00', '2026-02-10 13:37:50.705989+00'),
('2529b14f-73ee-4fa2-b43f-0527c78a1aaa', 'generate_cards_qa', 'system', null, null, 'For ''qa'' type: Create thought-provoking open-ended questions that test deep understanding. 
Provide a detailed ''explanation'' analyzing the answer.
Focus on explaining the "Why" and "How" rather than just "What".', '2026-02-10 13:37:50.705989+00', '2026-02-10 13:37:50.705989+00'),
('1824f9d9-13ca-44e7-9a04-4b4df927c48d', 'generate_cards_true_false', 'system', null, null, 'For ''true_false'' type: Create statements focusing on common misconceptions or key details. 
Provide a detailed ''explanation'' clarifying the fact.', '2026-02-10 13:37:50.705989+00', '2026-02-10 13:37:50.705989+00')
ON CONFLICT (code, scope, user_id, graph_id) DO NOTHING;

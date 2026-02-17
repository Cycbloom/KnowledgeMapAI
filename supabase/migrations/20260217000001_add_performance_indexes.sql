-- Add composite indexes for performance optimization
-- These indexes improve query performance for common access patterns

-- Nodes table indexes
CREATE INDEX IF NOT EXISTS idx_nodes_graph_deleted ON nodes(graph_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_nodes_level ON nodes(level) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_nodes_created ON nodes(created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_nodes_graph_level ON nodes(graph_id, level) WHERE deleted_at IS NULL;

-- Edges table indexes
CREATE INDEX IF NOT EXISTS idx_edges_source_graph ON edges(source_node_id, graph_id);
CREATE INDEX IF NOT EXISTS idx_edges_target_graph ON edges(target_node_id, graph_id);
CREATE INDEX IF NOT EXISTS idx_edges_graph ON edges(graph_id);

-- Study cards indexes
CREATE INDEX IF NOT EXISTS idx_study_cards_node ON study_cards(node_id);
CREATE INDEX IF NOT EXISTS idx_study_cards_next_review ON study_cards(next_review) WHERE next_review IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_study_cards_user_review ON study_cards(user_id, next_review) WHERE next_review IS NOT NULL;

-- Study progress indexes (actual columns: user_id, graph_id)
CREATE INDEX IF NOT EXISTS idx_study_progress_user_graph ON study_progress(user_id, graph_id);

-- Focus sessions indexes
CREATE INDEX IF NOT EXISTS idx_focus_sessions_user_date ON focus_sessions(user_id, start_time DESC);
CREATE INDEX IF NOT EXISTS idx_focus_sessions_user_completed ON focus_sessions(user_id, completed) WHERE completed = true;

-- Tasks indexes
CREATE INDEX IF NOT EXISTS idx_tasks_user_status ON tasks(user_id, status);
CREATE INDEX IF NOT EXISTS idx_tasks_user_created ON tasks(user_id, created_at DESC);

-- Templates indexes
CREATE INDEX IF NOT EXISTS idx_templates_category ON templates(category);
CREATE INDEX IF NOT EXISTS idx_templates_user_category ON templates(user_id, category);

-- Prompt templates indexes
CREATE INDEX IF NOT EXISTS idx_prompt_templates_code ON prompt_templates(code);
CREATE INDEX IF NOT EXISTS idx_prompt_templates_user ON prompt_templates(user_id);

-- AI actions indexes
CREATE INDEX IF NOT EXISTS idx_ai_actions_user ON ai_actions(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_actions_graph ON ai_actions(graph_id);

-- Achievements indexes
CREATE INDEX IF NOT EXISTS idx_achievements_code ON achievements(code);

-- User achievements indexes
CREATE INDEX IF NOT EXISTS idx_user_achievements_user ON user_achievements(user_id);
CREATE INDEX IF NOT EXISTS idx_user_achievements_achievement ON user_achievements(achievement_id);

-- Daily tasks indexes
CREATE INDEX IF NOT EXISTS idx_daily_tasks_user_date ON daily_tasks(user_id, task_date);

-- Knowledge graphs indexes
CREATE INDEX IF NOT EXISTS idx_knowledge_graphs_user_deleted ON knowledge_graphs(user_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_knowledge_graphs_user_created ON knowledge_graphs(user_id, created_at DESC) WHERE deleted_at IS NULL;

-- Add GIN index for full-text search on nodes
CREATE INDEX IF NOT EXISTS idx_nodes_content_search ON nodes USING gin(to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(content, '')));

-- Add index for graph public access
CREATE INDEX IF NOT EXISTS idx_knowledge_graphs_public ON knowledge_graphs(id) WHERE is_public = true AND deleted_at IS NULL;

-- =====================================================
-- Add Performance Indexes
-- =====================================================

-- Knowledge graphs table indexes
CREATE INDEX IF NOT EXISTS idx_knowledge_graphs_user_id ON knowledge_graphs(user_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_graphs_last_used_at ON knowledge_graphs(last_used_at DESC);
CREATE INDEX IF NOT EXISTS idx_knowledge_graphs_deleted_at ON knowledge_graphs(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_knowledge_graphs_is_public ON knowledge_graphs(is_public);
CREATE INDEX IF NOT EXISTS idx_knowledge_graphs_is_favorite ON knowledge_graphs(is_favorite);

-- Knowledge points table indexes
CREATE INDEX IF NOT EXISTS idx_knowledge_points_owner_id ON knowledge_points(owner_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_points_visibility ON knowledge_points(visibility);
CREATE INDEX IF NOT EXISTS idx_knowledge_points_created_at ON knowledge_points(created_at DESC);

-- Graph nodes table indexes (link between knowledge graphs and knowledge points)
CREATE INDEX IF NOT EXISTS idx_graph_nodes_graph_id ON graph_nodes(graph_id);
CREATE INDEX IF NOT EXISTS idx_graph_nodes_knowledge_point_id ON graph_nodes(knowledge_point_id);
CREATE INDEX IF NOT EXISTS idx_graph_nodes_graph_kp ON graph_nodes(graph_id, knowledge_point_id);

-- Edges table indexes
CREATE INDEX IF NOT EXISTS idx_edges_graph_id ON edges(graph_id);
CREATE INDEX IF NOT EXISTS idx_edges_source_target ON edges(source_knowledge_point_id, target_knowledge_point_id);
CREATE INDEX IF NOT EXISTS idx_edges_source ON edges(source_knowledge_point_id);
CREATE INDEX IF NOT EXISTS idx_edges_target ON edges(target_knowledge_point_id);

-- Study cards table indexes
CREATE INDEX IF NOT EXISTS idx_study_cards_user_id ON study_cards(user_id);
CREATE INDEX IF NOT EXISTS idx_study_cards_graph_id ON study_cards(graph_id);
CREATE INDEX IF NOT EXISTS idx_study_cards_next_review ON study_cards(next_review);
CREATE INDEX IF NOT EXISTS idx_study_cards_user_next_review ON study_cards(user_id, next_review);

-- Tasks table indexes
CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tasks_user_status ON tasks(user_id, status);

-- Learning paths table indexes
CREATE INDEX IF NOT EXISTS idx_learning_paths_user_id ON learning_paths(user_id);
CREATE INDEX IF NOT EXISTS idx_learning_paths_created_at ON learning_paths(created_at DESC);

-- Scheduler tasks table indexes (using periodic_tasks table)
CREATE INDEX IF NOT EXISTS idx_periodic_tasks_user_id ON periodic_tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_periodic_tasks_status ON periodic_tasks(status);
CREATE INDEX IF NOT EXISTS idx_periodic_tasks_period_start ON periodic_tasks(period_start);
CREATE INDEX IF NOT EXISTS idx_periodic_tasks_user_status ON periodic_tasks(user_id, status);

-- Comments
COMMENT ON INDEX idx_knowledge_graphs_user_id IS 'Index for filtering graphs by user';
COMMENT ON INDEX idx_knowledge_graphs_last_used_at IS 'Index for sorting graphs by last used';
COMMENT ON INDEX idx_knowledge_graphs_deleted_at IS 'Partial index for non-deleted graphs';
COMMENT ON INDEX idx_graph_nodes_graph_id IS 'Index for fetching all nodes in a graph';
COMMENT ON INDEX idx_edges_graph_id IS 'Index for fetching all edges in a graph';
COMMENT ON INDEX idx_study_cards_next_review IS 'Index for fetching cards due for review';

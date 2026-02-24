-- =====================================================
-- Add missing indexes for performance optimization
-- Created: 2026-02-24
-- =====================================================

-- Add composite index for edges table (common query pattern)
CREATE INDEX IF NOT EXISTS idx_edges_graph_deleted 
ON edges(graph_id, deleted_at);

-- Add composite index for backup_snapshots table
CREATE INDEX IF NOT EXISTS idx_backup_snapshots_user_created 
ON backup_snapshots(user_id, created_at DESC);

-- Add index for graph_relations (used in graph map queries)
CREATE INDEX IF NOT EXISTS idx_graph_relations_source 
ON graph_relations(source_graph_id);
CREATE INDEX IF NOT EXISTS idx_graph_relations_target 
ON graph_relations(target_graph_id);

-- Add index for knowledge_points owner queries
CREATE INDEX IF NOT EXISTS idx_knowledge_points_owner 
ON knowledge_points(owner_id);

-- Add index for focus_sessions user queries
CREATE INDEX IF NOT EXISTS idx_focus_sessions_user_completed 
ON focus_sessions(user_id, completed);

-- Add index for study_cards user review queries
CREATE INDEX IF NOT EXISTS idx_study_cards_user_review 
ON study_cards(user_id, next_review);

-- Comments for documentation
COMMENT ON INDEX idx_edges_graph_deleted IS 'Optimizes edge queries filtering by graph and deleted status';
COMMENT ON INDEX idx_backup_snapshots_user_created IS 'Optimizes backup listing queries ordered by creation time';
COMMENT ON INDEX idx_graph_relations_source IS 'Optimizes graph relation queries by source graph';
COMMENT ON INDEX idx_graph_relations_target IS 'Optimizes graph relation queries by target graph';
COMMENT ON INDEX idx_knowledge_points_owner IS 'Optimizes knowledge point queries by owner';
COMMENT ON INDEX idx_focus_sessions_user_completed IS 'Optimizes focus session statistics queries';
COMMENT ON INDEX idx_study_cards_user_review IS 'Optimizes study card review queries';

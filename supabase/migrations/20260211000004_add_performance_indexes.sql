-- Add missing indexes for foreign keys to improve join performance

-- Index for edges source/target nodes
CREATE INDEX IF NOT EXISTS idx_edges_source_node_id ON edges(source_node_id);
CREATE INDEX IF NOT EXISTS idx_edges_target_node_id ON edges(target_node_id);

-- Index for nodes graph_id (likely already exists implicitly or explicitly, but good to ensure)
CREATE INDEX IF NOT EXISTS idx_nodes_graph_id ON nodes(graph_id);

-- Index for study_cards user_id (for fast filtering by user)
CREATE INDEX IF NOT EXISTS idx_study_cards_user_id ON study_cards(user_id);

-- Index for study_cards next_review (for finding due cards)
CREATE INDEX IF NOT EXISTS idx_study_cards_next_review ON study_cards(next_review);

-- Index for study_cards fsrs_state (for distribution stats)
CREATE INDEX IF NOT EXISTS idx_study_cards_fsrs_state ON study_cards(fsrs_state);

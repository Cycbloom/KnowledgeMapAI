-- Add indexes for performance optimization, especially for foreign key lookups and cascading deletes

-- Index for study_cards.node_id (Optimize joins and cascading deletes from nodes)
CREATE INDEX IF NOT EXISTS idx_study_cards_node_id ON study_cards(node_id);

-- Index for study_progress.graph_id (Optimize cascading deletes from knowledge_graphs)
CREATE INDEX IF NOT EXISTS idx_study_progress_graph_id ON study_progress(graph_id);

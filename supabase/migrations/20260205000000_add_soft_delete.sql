-- Add deleted_at column to knowledge_graphs, nodes, and edges for soft delete support

ALTER TABLE knowledge_graphs ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;
ALTER TABLE nodes ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;
ALTER TABLE edges ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Create indexes for performance on soft-delete filtering
CREATE INDEX IF NOT EXISTS idx_graphs_deleted_at ON knowledge_graphs(deleted_at);
CREATE INDEX IF NOT EXISTS idx_nodes_deleted_at ON nodes(deleted_at);
CREATE INDEX IF NOT EXISTS idx_edges_deleted_at ON edges(deleted_at);

ALTER TABLE knowledge_graphs ADD COLUMN is_public BOOLEAN DEFAULT false;
CREATE INDEX idx_knowledge_graphs_is_public ON knowledge_graphs(is_public);

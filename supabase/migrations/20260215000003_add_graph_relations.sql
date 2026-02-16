-- Migration: Add graph_relations table for prerequisite/extension/related graphs

-- Add parent_graph_id to knowledge_graphs
ALTER TABLE knowledge_graphs ADD COLUMN IF NOT EXISTS 
  parent_graph_id UUID REFERENCES knowledge_graphs(id) ON DELETE SET NULL;

-- Create graph_relations table
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

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_graph_relations_source ON graph_relations(source_graph_id);
CREATE INDEX IF NOT EXISTS idx_graph_relations_target ON graph_relations(target_graph_id);
CREATE INDEX IF NOT EXISTS idx_graph_relations_type ON graph_relations(relation_type);

-- Add comments
COMMENT ON TABLE graph_relations IS 'Stores relationships between knowledge graphs (prerequisite, extension, related)';
COMMENT ON COLUMN graph_relations.source_graph_id IS 'The graph that has the dependency';
COMMENT ON COLUMN graph_relations.target_graph_id IS 'The graph that is depended upon';
COMMENT ON COLUMN graph_relations.relation_type IS 'Type: prerequisite (must learn first), extension (advanced topic), related (connected topic)';
COMMENT ON COLUMN graph_relations.context IS 'Context or reason for the relationship';

-- Enable RLS
ALTER TABLE graph_relations ENABLE ROW LEVEL SECURITY;

-- RLS Policies
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

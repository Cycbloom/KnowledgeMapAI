-- Optimize edges table by denormalizing graph_id
-- This avoids complex joins in RLS policies and queries

-- 1. Add graph_id column
ALTER TABLE edges ADD COLUMN IF NOT EXISTS graph_id UUID REFERENCES knowledge_graphs(id) ON DELETE CASCADE;

-- 2. Populate graph_id from source_node
UPDATE edges 
SET graph_id = nodes.graph_id
FROM nodes 
WHERE edges.source_node_id = nodes.id
AND edges.graph_id IS NULL;

-- 3. Add Index for performance
CREATE INDEX IF NOT EXISTS idx_edges_graph_id ON edges(graph_id);

-- 4. Update RLS Policies to use graph_id directly (Significant Performance Boost)

-- Drop old policies
DROP POLICY IF EXISTS "Users can view edges of own graphs" ON edges;
DROP POLICY IF EXISTS "Users can insert edges to own graphs" ON edges;
DROP POLICY IF EXISTS "Users can update edges of own graphs" ON edges;
DROP POLICY IF EXISTS "Users can delete edges of own graphs" ON edges; -- This one wasn't explicitly created before but good to be safe or create it

-- Create new simplified policies
CREATE POLICY "Users can view edges of own graphs" 
  ON edges FOR SELECT 
  USING (EXISTS (
    SELECT 1 FROM knowledge_graphs 
    WHERE knowledge_graphs.id = edges.graph_id 
    AND knowledge_graphs.user_id = auth.uid()
  ));

CREATE POLICY "Users can insert edges to own graphs" 
  ON edges FOR INSERT 
  WITH CHECK (EXISTS (
    SELECT 1 FROM knowledge_graphs 
    WHERE knowledge_graphs.id = edges.graph_id 
    AND knowledge_graphs.user_id = auth.uid()
  ));

CREATE POLICY "Users can update edges of own graphs" 
  ON edges FOR UPDATE 
  USING (EXISTS (
    SELECT 1 FROM knowledge_graphs 
    WHERE knowledge_graphs.id = edges.graph_id 
    AND knowledge_graphs.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete edges of own graphs" 
  ON edges FOR DELETE 
  USING (EXISTS (
    SELECT 1 FROM knowledge_graphs 
    WHERE knowledge_graphs.id = edges.graph_id 
    AND knowledge_graphs.user_id = auth.uid()
  ));

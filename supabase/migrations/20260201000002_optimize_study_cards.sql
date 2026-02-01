-- Optimize study_cards table by denormalizing graph_id and adding composite indexes
-- This improves performance for fetching cards by graph and specific nodes

-- 1. Add graph_id column to study_cards
ALTER TABLE study_cards ADD COLUMN IF NOT EXISTS graph_id UUID REFERENCES knowledge_graphs(id) ON DELETE CASCADE;

-- 2. Populate graph_id from nodes table
UPDATE study_cards 
SET graph_id = nodes.graph_id
FROM nodes 
WHERE study_cards.node_id = nodes.id
AND study_cards.graph_id IS NULL;

-- 3. Add optimized composite indexes
-- Faster lookup for all cards in a graph for a user
CREATE INDEX IF NOT EXISTS idx_study_cards_user_graph ON study_cards(user_id, graph_id);
-- Faster lookup for specific node cards for a user
CREATE INDEX IF NOT EXISTS idx_study_cards_user_node ON study_cards(user_id, node_id);
-- Faster lookup for dashboard statistics (state-based)
CREATE INDEX IF NOT EXISTS idx_study_cards_user_state ON study_cards(user_id, fsrs_state);
-- Faster lookup for dashboard heatmap (time-based)
CREATE INDEX IF NOT EXISTS idx_study_cards_user_last_reviewed ON study_cards(user_id, last_reviewed);
-- Index for graph_id alone for administrative or batch queries
CREATE INDEX IF NOT EXISTS idx_study_cards_graph_id ON study_cards(graph_id);

-- 4. Update RLS Policies to use graph_id directly for faster checks
DROP POLICY IF EXISTS "Users can view own study cards" ON study_cards;
DROP POLICY IF EXISTS "Users can insert own study cards" ON study_cards;
DROP POLICY IF EXISTS "Users can update own study cards" ON study_cards;
DROP POLICY IF EXISTS "Users can delete own study cards" ON study_cards;

CREATE POLICY "Users can view own study cards" 
  ON study_cards FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own study cards" 
  ON study_cards FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own study cards" 
  ON study_cards FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own study cards" 
  ON study_cards FOR DELETE 
  USING (auth.uid() = user_id);

-- Note: Policies were already user_id based, but denormalizing graph_id 
-- allows the frontend/backend to query by graph_id without joining nodes,
-- which is the main performance win.

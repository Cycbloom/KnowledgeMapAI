-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_graphs ENABLE ROW LEVEL SECURITY;
ALTER TABLE nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE edges ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_progress ENABLE ROW LEVEL SECURITY;

-- Users Table Policies
-- User can only view their own profile
CREATE POLICY "Users can view own profile" 
ON users FOR SELECT 
USING (auth.uid() = id);

-- User can update their own profile
CREATE POLICY "Users can update own profile" 
ON users FOR UPDATE 
USING (auth.uid() = id);

-- Knowledge Graphs Policies
-- User can perform all operations on their own graphs
CREATE POLICY "Users can manage own graphs" 
ON knowledge_graphs FOR ALL 
USING (auth.uid() = user_id);

-- Nodes Policies
-- User can manage nodes belonging to their graphs
CREATE POLICY "Users can manage nodes in own graphs" 
ON nodes FOR ALL 
USING (
  graph_id IN (
    SELECT id FROM knowledge_graphs WHERE user_id = auth.uid()
  )
);

-- Edges Policies
-- User can manage edges connecting nodes in their graphs
-- Note: This assumes source_node belongs to a valid graph owned by the user
CREATE POLICY "Users can manage edges in own graphs" 
ON edges FOR ALL 
USING (
  source_node_id IN (
    SELECT id FROM nodes 
    WHERE graph_id IN (
      SELECT id FROM knowledge_graphs WHERE user_id = auth.uid()
    )
  )
);

-- Study Cards Policies
-- User can manage their own study cards
CREATE POLICY "Users can manage own study cards" 
ON study_cards FOR ALL 
USING (auth.uid() = user_id);

-- Study Progress Policies
-- User can manage their own study progress
CREATE POLICY "Users can manage own study progress" 
ON study_progress FOR ALL 
USING (auth.uid() = user_id);

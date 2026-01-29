-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(100) NOT NULL,
  plan VARCHAR(20) DEFAULT 'free' CHECK (plan IN ('free', 'premium')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Grant permissions for users
GRANT SELECT ON users TO anon;
GRANT ALL PRIVILEGES ON users TO authenticated;

-- Create knowledge_graphs table
CREATE TABLE IF NOT EXISTS knowledge_graphs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_knowledge_graphs_user_id ON knowledge_graphs(user_id);
GRANT SELECT ON knowledge_graphs TO anon;
GRANT ALL PRIVILEGES ON knowledge_graphs TO authenticated;

-- Create nodes table
CREATE TABLE IF NOT EXISTS nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  graph_id UUID REFERENCES knowledge_graphs(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  content TEXT,
  properties JSONB DEFAULT '{}',
  color VARCHAR(7) DEFAULT '#3B82F6',
  x_position INTEGER DEFAULT 0,
  y_position INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_nodes_graph_id ON nodes(graph_id);
GRANT SELECT ON nodes TO anon;
GRANT ALL PRIVILEGES ON nodes TO authenticated;

-- Create edges table
CREATE TABLE IF NOT EXISTS edges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_node_id UUID REFERENCES nodes(id) ON DELETE CASCADE,
  target_node_id UUID REFERENCES nodes(id) ON DELETE CASCADE,
  relationship_type VARCHAR(50) DEFAULT 'related',
  weight INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(source_node_id, target_node_id, relationship_type)
);

CREATE INDEX IF NOT EXISTS idx_edges_source ON edges(source_node_id);
CREATE INDEX IF NOT EXISTS idx_edges_target ON edges(target_node_id);
GRANT SELECT ON edges TO anon;
GRANT ALL PRIVILEGES ON edges TO authenticated;

-- Create study_cards table
CREATE TABLE IF NOT EXISTS study_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  node_id UUID REFERENCES nodes(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  difficulty INTEGER DEFAULT 1 CHECK (difficulty BETWEEN 1 AND 5),
  last_reviewed TIMESTAMP WITH TIME ZONE,
  next_review TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  review_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_study_cards_user_next_review ON study_cards(user_id, next_review);
GRANT SELECT ON study_cards TO anon;
GRANT ALL PRIVILEGES ON study_cards TO authenticated;

-- Create study_progress table
CREATE TABLE IF NOT EXISTS study_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  graph_id UUID REFERENCES knowledge_graphs(id) ON DELETE CASCADE,
  total_nodes INTEGER DEFAULT 0,
  mastered_nodes INTEGER DEFAULT 0,
  progress_percentage FLOAT DEFAULT 0,
  study_streak INTEGER DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, graph_id)
);

CREATE INDEX IF NOT EXISTS idx_study_progress_user ON study_progress(user_id);
GRANT SELECT ON study_progress TO anon;
GRANT ALL PRIVILEGES ON study_progress TO authenticated;
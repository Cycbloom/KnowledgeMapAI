-- Create ai_actions table
CREATE TABLE IF NOT EXISTS ai_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  icon VARCHAR(50), -- Lucide icon name
  target_mode VARCHAR(50) NOT NULL CHECK (target_mode IN ('show_result', 'update_node', 'spawn_children')),
  scope VARCHAR(20) NOT NULL CHECK (scope IN ('system', 'user', 'graph')),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  graph_id UUID REFERENCES knowledge_graphs(id) ON DELETE CASCADE,
  prompt_template TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add unique constraint to prevent duplicates
CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_actions_unique_name_scope 
ON ai_actions (name, scope, COALESCE(user_id, '00000000-0000-0000-0000-000000000000'), COALESCE(graph_id, '00000000-0000-0000-0000-000000000000'));

-- RLS Policies
ALTER TABLE ai_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "System actions are viewable by everyone"
  ON ai_actions FOR SELECT
  USING (scope = 'system');

CREATE POLICY "Users can view their own actions"
  ON ai_actions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view actions for their graphs"
  ON ai_actions FOR SELECT
  USING (
    scope = 'graph' AND
    graph_id IN (
      SELECT id FROM knowledge_graphs WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage their own actions"
  ON ai_actions FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage actions for their graphs"
  ON ai_actions FOR ALL
  USING (
    scope = 'graph' AND
    graph_id IN (
      SELECT id FROM knowledge_graphs WHERE user_id = auth.uid()
    )
  );

-- Insert some default system actions
INSERT INTO ai_actions (name, description, icon, target_mode, scope, prompt_template) VALUES
(
  '精炼内容', 
  '将节点内容精炼为简洁的几句话', 
  'Minimize2', 
  'update_node', 
  'system', 
  '请将以下内容精炼为3-5句话，保留核心观点和关键事实。直接返回精炼后的内容，不要有开场白。\n\n内容：\n{{nodeContent}}'
),
(
  '头脑风暴子节点', 
  '基于当前节点生成3-5个相关的子主题', 
  'GitBranch', 
  'spawn_children', 
  'system', 
  '请基于以下主题进行头脑风暴，列出3-5个具体的子主题或延伸方向。每个子主题应包含标题和简短说明。\n\n主题：{{nodeTitle}}\n背景：{{nodeContent}}'
),
(
  '术语标注', 
  '自动识别并标注内容中的专业术语', 
  'Tag', 
  'update_node', 
  'system', 
  '请分析以下内容，识别其中的专业术语。对于每个术语，如果尚未解释，请在首次出现处用括号添加简短释义。同时，提取这些术语作为标签。\n\n内容：\n{{nodeContent}}'
),
(
  '反向辩驳', 
  '提出该观点的反面论证或潜在缺陷', 
  'MessageSquareWarning', 
  'show_result', 
  'system', 
  '请扮演一个批判性思维者，针对以下观点提出反面论证、潜在缺陷或被忽视的视角。\n\n观点：{{nodeTitle}}\n详细内容：{{nodeContent}}'
);

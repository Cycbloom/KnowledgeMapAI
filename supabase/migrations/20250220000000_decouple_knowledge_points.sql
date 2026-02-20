-- =====================================================
-- Knowledge Points Decoupling Migration
-- 将知识点从图谱中解耦，支持跨图谱复用
-- =====================================================

-- 创建知识点可见性枚举类型
CREATE TYPE knowledge_point_visibility AS ENUM ('private', 'public', 'pending');

-- =====================================================
-- 1. 创建 knowledge_points 表（知识点核心）
-- =====================================================
CREATE TABLE IF NOT EXISTS knowledge_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  content TEXT,
  learning_material TEXT,
  properties JSONB DEFAULT '{}',
  embedding vector(1024),
  visibility knowledge_point_visibility DEFAULT 'private',
  owner_id UUID REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE knowledge_points IS '独立的知识点实体，支持跨图谱复用';
COMMENT ON COLUMN knowledge_points.visibility IS '知识点可见性：private(私有), public(公共), pending(待审核)';
COMMENT ON COLUMN knowledge_points.owner_id IS '知识点所有者，私有知识点仅所有者可见';

-- =====================================================
-- 2. 创建 graph_nodes 表（图谱-知识点关联）
-- =====================================================
CREATE TABLE IF NOT EXISTS graph_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  graph_id UUID NOT NULL REFERENCES knowledge_graphs(id) ON DELETE CASCADE,
  knowledge_point_id UUID NOT NULL REFERENCES knowledge_points(id) ON DELETE CASCADE,
  x_position FLOAT DEFAULT 0,
  y_position FLOAT DEFAULT 0,
  level VARCHAR(20) DEFAULT 'normal' CHECK (level IN ('root', 'core', 'sub', 'normal', 'leaf')),
  is_accepted BOOLEAN DEFAULT TRUE,
  deleted_at TIMESTAMPTZ DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(graph_id, knowledge_point_id)
);

COMMENT ON TABLE graph_nodes IS '图谱与知识点的关联表，存储图谱特定的属性';
COMMENT ON COLUMN graph_nodes.x_position IS '知识点在图谱中的X坐标';
COMMENT ON COLUMN graph_nodes.y_position IS '知识点在图谱中的Y坐标';
COMMENT ON COLUMN graph_nodes.level IS '知识点在图谱中的层级';

-- =====================================================
-- 3. 修改 edges 表结构
-- =====================================================

-- 添加新字段
ALTER TABLE edges ADD COLUMN IF NOT EXISTS source_graph_node_id UUID REFERENCES graph_nodes(id) ON DELETE CASCADE;
ALTER TABLE edges ADD COLUMN IF NOT EXISTS target_graph_node_id UUID REFERENCES graph_nodes(id) ON DELETE CASCADE;

COMMENT ON COLUMN edges.source_graph_node_id IS '边的源节点（graph_nodes 关联）';
COMMENT ON COLUMN edges.target_graph_node_id IS '边的目标节点（graph_nodes 关联）';

-- =====================================================
-- 4. 修改 study_cards 表结构
-- =====================================================

-- 添加 knowledge_point_id 字段
ALTER TABLE study_cards ADD COLUMN IF NOT EXISTS knowledge_point_id UUID REFERENCES knowledge_points(id) ON DELETE CASCADE;

-- 添加 source_graph_id 字段用于卡组区分
ALTER TABLE study_cards ADD COLUMN IF NOT EXISTS source_graph_id UUID REFERENCES knowledge_graphs(id) ON DELETE SET NULL;

COMMENT ON COLUMN study_cards.knowledge_point_id IS '关联的知识点ID';
COMMENT ON COLUMN study_cards.source_graph_id IS '卡片创建来源的图谱ID，用于卡组区分';

-- =====================================================
-- 5. 数据迁移：将现有 nodes 数据迁移到新表
-- =====================================================

-- 为每个现有 node 创建 knowledge_point
INSERT INTO knowledge_points (id, title, content, learning_material, properties, embedding, visibility, owner_id, created_at, updated_at)
SELECT 
  n.id,
  n.title,
  n.content,
  n.learning_material,
  n.properties,
  n.embedding,
  'private'::knowledge_point_visibility,
  kg.user_id,
  n.created_at,
  n.updated_at
FROM nodes n
JOIN knowledge_graphs kg ON n.graph_id = kg.id
WHERE n.deleted_at IS NULL
ON CONFLICT (id) DO NOTHING;

-- 为每个现有 node 创建 graph_node 关联
INSERT INTO graph_nodes (id, graph_id, knowledge_point_id, x_position, y_position, level, is_accepted, deleted_at, created_at, updated_at)
SELECT 
  gen_random_uuid(),
  n.graph_id,
  n.id,
  n.x_position,
  n.y_position,
  n.level,
  n.is_accepted,
  n.deleted_at,
  n.created_at,
  n.updated_at
FROM nodes n
WHERE n.deleted_at IS NULL
ON CONFLICT (graph_id, knowledge_point_id) DO NOTHING;

-- 更新 edges 表的新字段
UPDATE edges
SET 
  source_graph_node_id = gn_source.id,
  target_graph_node_id = gn_target.id
FROM edges e_ref
JOIN nodes n_source ON n_source.id = e_ref.source_node_id
JOIN graph_nodes gn_source ON gn_source.knowledge_point_id = n_source.id AND gn_source.graph_id = n_source.graph_id
JOIN nodes n_target ON n_target.id = e_ref.target_node_id
JOIN graph_nodes gn_target ON gn_target.knowledge_point_id = n_target.id AND gn_target.graph_id = n_target.graph_id
WHERE edges.id = e_ref.id
  AND edges.deleted_at IS NULL;

-- 更新 study_cards 表的 knowledge_point_id
UPDATE study_cards sc
SET knowledge_point_id = n.id
FROM nodes n
WHERE sc.node_id = n.id;

-- 设置 source_graph_id 为当前 graph_id
UPDATE study_cards
SET source_graph_id = graph_id
WHERE source_graph_id IS NULL;

-- =====================================================
-- 6. 创建索引
-- =====================================================

-- knowledge_points 索引
CREATE INDEX IF NOT EXISTS idx_knowledge_points_owner_id ON knowledge_points(owner_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_points_visibility ON knowledge_points(visibility);
CREATE INDEX IF NOT EXISTS idx_knowledge_points_title_trgm ON knowledge_points USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_knowledge_points_content_trgm ON knowledge_points USING gin (content gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_knowledge_points_embedding ON knowledge_points USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_knowledge_points_public ON knowledge_points(id) WHERE visibility = 'public';
CREATE INDEX IF NOT EXISTS idx_knowledge_points_owner_visibility ON knowledge_points(owner_id, visibility);

-- graph_nodes 索引
CREATE INDEX IF NOT EXISTS idx_graph_nodes_graph_id ON graph_nodes(graph_id);
CREATE INDEX IF NOT EXISTS idx_graph_nodes_knowledge_point_id ON graph_nodes(knowledge_point_id);
CREATE INDEX IF NOT EXISTS idx_graph_nodes_level ON graph_nodes(level);
CREATE INDEX IF NOT EXISTS idx_graph_nodes_deleted_at ON graph_nodes(deleted_at);
CREATE INDEX IF NOT EXISTS idx_graph_nodes_graph_deleted ON graph_nodes(graph_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_graph_nodes_kp_graph ON graph_nodes(knowledge_point_id, graph_id);

-- edges 新字段索引
CREATE INDEX IF NOT EXISTS idx_edges_source_graph_node ON edges(source_graph_node_id);
CREATE INDEX IF NOT EXISTS idx_edges_target_graph_node ON edges(target_graph_node_id);

-- study_cards 新字段索引
CREATE INDEX IF NOT EXISTS idx_study_cards_knowledge_point_id ON study_cards(knowledge_point_id);
CREATE INDEX IF NOT EXISTS idx_study_cards_source_graph_id ON study_cards(source_graph_id);

-- =====================================================
-- 7. 更新 RLS 策略
-- =====================================================

-- knowledge_points RLS
ALTER TABLE knowledge_points ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view public knowledge points" ON knowledge_points FOR SELECT USING (visibility = 'public');
CREATE POLICY "Users can view own knowledge points" ON knowledge_points FOR SELECT USING (auth.uid() = owner_id);
CREATE POLICY "Users can insert own knowledge points" ON knowledge_points FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Users can update own knowledge points" ON knowledge_points FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "Users can delete own knowledge points" ON knowledge_points FOR DELETE USING (auth.uid() = owner_id);

-- graph_nodes RLS
ALTER TABLE graph_nodes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view graph_nodes of own graphs" ON graph_nodes FOR SELECT USING (EXISTS (
  SELECT 1 FROM knowledge_graphs WHERE knowledge_graphs.id = graph_nodes.graph_id AND knowledge_graphs.user_id = auth.uid()
));
CREATE POLICY "Users can insert graph_nodes to own graphs" ON graph_nodes FOR INSERT WITH CHECK (EXISTS (
  SELECT 1 FROM knowledge_graphs WHERE knowledge_graphs.id = graph_nodes.graph_id AND knowledge_graphs.user_id = auth.uid()
));
CREATE POLICY "Users can update graph_nodes of own graphs" ON graph_nodes FOR UPDATE USING (EXISTS (
  SELECT 1 FROM knowledge_graphs WHERE knowledge_graphs.id = graph_nodes.graph_id AND knowledge_graphs.user_id = auth.uid()
));
CREATE POLICY "Users can delete graph_nodes of own graphs" ON graph_nodes FOR DELETE USING (EXISTS (
  SELECT 1 FROM knowledge_graphs WHERE knowledge_graphs.id = graph_nodes.graph_id AND knowledge_graphs.user_id = auth.uid()
));

-- =====================================================
-- 8. 创建辅助函数
-- =====================================================

-- 获取用户可访问的知识点（公共 + 自己私有的）
CREATE OR REPLACE FUNCTION get_accessible_knowledge_points(p_user_id UUID)
RETURNS TABLE (
  id UUID,
  title VARCHAR(255),
  content TEXT,
  learning_material TEXT,
  properties JSONB,
  visibility knowledge_point_visibility,
  owner_id UUID,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    kp.id,
    kp.title,
    kp.content,
    kp.learning_material,
    kp.properties,
    kp.visibility,
    kp.owner_id,
    kp.created_at,
    kp.updated_at
  FROM knowledge_points kp
  WHERE kp.visibility = 'public' OR kp.owner_id = p_user_id
  ORDER BY kp.updated_at DESC;
END;
$$ LANGUAGE plpgsql STABLE;

-- 搜索相似知识点（用于 AI 复用）
CREATE OR REPLACE FUNCTION search_similar_knowledge_points(
  p_query_embedding vector(1024),
  p_user_id UUID,
  p_match_threshold FLOAT DEFAULT 0.8,
  p_match_count INT DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  title VARCHAR(255),
  content TEXT,
  similarity FLOAT,
  visibility knowledge_point_visibility
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    kp.id,
    kp.title,
    kp.content,
    1 - (kp.embedding <=> p_query_embedding) as similarity,
    kp.visibility
  FROM knowledge_points kp
  WHERE (kp.visibility = 'public' OR kp.owner_id = p_user_id)
    AND (1 - (kp.embedding <=> p_query_embedding)) > p_match_threshold
  ORDER BY kp.embedding <=> p_query_embedding
  LIMIT p_match_count;
END;
$$ LANGUAGE plpgsql STABLE;

-- 获取知识点在哪些图谱中使用
CREATE OR REPLACE FUNCTION get_knowledge_point_graphs(p_knowledge_point_id UUID, p_user_id UUID)
RETURNS TABLE (
  graph_id UUID,
  graph_title VARCHAR(255),
  x_position FLOAT,
  y_position FLOAT,
  level VARCHAR(20)
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    kg.id,
    kg.title,
    gn.x_position,
    gn.y_position,
    gn.level
  FROM graph_nodes gn
  JOIN knowledge_graphs kg ON gn.graph_id = kg.id
  WHERE gn.knowledge_point_id = p_knowledge_point_id
    AND gn.deleted_at IS NULL
    AND kg.user_id = p_user_id;
END;
$$ LANGUAGE plpgsql STABLE;

-- 软删除知识点（从图谱移除）
CREATE OR REPLACE FUNCTION soft_delete_graph_node(
  p_graph_node_id UUID,
  p_user_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  v_graph_id UUID;
BEGIN
  -- 验证用户权限
  SELECT gn.graph_id INTO v_graph_id
  FROM graph_nodes gn
  JOIN knowledge_graphs kg ON gn.graph_id = kg.id
  WHERE gn.id = p_graph_node_id AND kg.user_id = p_user_id;
  
  IF v_graph_id IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- 删除相关的边
  DELETE FROM edges 
  WHERE (source_graph_node_id = p_graph_node_id OR target_graph_node_id = p_graph_node_id)
    AND graph_id = v_graph_id;
  
  -- 软删除 graph_node
  UPDATE graph_nodes 
  SET deleted_at = NOW(), updated_at = NOW()
  WHERE id = p_graph_node_id;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 硬删除知识点（彻底删除）
CREATE OR REPLACE FUNCTION hard_delete_knowledge_point(
  p_knowledge_point_id UUID,
  p_user_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_graph_count INT;
  v_deleted_graph_nodes INT;
  v_deleted_edges INT;
  v_deleted_cards INT;
BEGIN
  -- 验证用户权限
  IF NOT EXISTS (SELECT 1 FROM knowledge_points WHERE id = p_knowledge_point_id AND owner_id = p_user_id) THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Permission denied');
  END IF;
  
  -- 统计影响的图谱数量
  SELECT COUNT(*) INTO v_graph_count
  FROM graph_nodes 
  WHERE knowledge_point_id = p_knowledge_point_id AND deleted_at IS NULL;
  
  -- 删除相关的边
  DELETE FROM edges e
  WHERE EXISTS (
    SELECT 1 FROM graph_nodes gn
    WHERE gn.knowledge_point_id = p_knowledge_point_id
      AND (e.source_graph_node_id = gn.id OR e.target_graph_node_id = gn.id)
  );
  
  GET DIAGNOSTICS v_deleted_edges = ROW_COUNT;
  
  -- 删除 graph_nodes
  DELETE FROM graph_nodes WHERE knowledge_point_id = p_knowledge_point_id;
  GET DIAGNOSTICS v_deleted_graph_nodes = ROW_COUNT;
  
  -- 删除学习卡片
  DELETE FROM study_cards WHERE knowledge_point_id = p_knowledge_point_id;
  GET DIAGNOSTICS v_deleted_cards = ROW_COUNT;
  
  -- 删除知识点
  DELETE FROM knowledge_points WHERE id = p_knowledge_point_id;
  
  RETURN jsonb_build_object(
    'success', TRUE,
    'affected_graphs', v_graph_count,
    'deleted_graph_nodes', v_deleted_graph_nodes,
    'deleted_edges', v_deleted_edges,
    'deleted_cards', v_deleted_cards
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 9. 授权
-- =====================================================

GRANT SELECT ON knowledge_points TO anon;
GRANT ALL PRIVILEGES ON knowledge_points TO authenticated;
GRANT SELECT ON graph_nodes TO anon;
GRANT ALL PRIVILEGES ON graph_nodes TO authenticated;

GRANT EXECUTE ON FUNCTION get_accessible_knowledge_points(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION search_similar_knowledge_points(vector(1024), UUID, FLOAT, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_knowledge_point_graphs(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION soft_delete_graph_node(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION hard_delete_knowledge_point(UUID, UUID) TO authenticated;

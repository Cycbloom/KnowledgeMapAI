-- =====================================================
-- Knowledge Map - Graph Version Control
-- =====================================================

CREATE TABLE IF NOT EXISTS graph_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  graph_id UUID NOT NULL REFERENCES knowledge_graphs(id) ON DELETE CASCADE,
  snapshot_data JSONB NOT NULL DEFAULT '{}',
  description TEXT,
  snapshot_type graph_snapshot_type NOT NULL DEFAULT 'manual',
  node_count INTEGER NOT NULL DEFAULT 0,
  edge_count INTEGER NOT NULL DEFAULT 0,
  operator_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE graph_snapshots IS '图谱版本快照表，存储图谱在某一时刻的完整状态';
COMMENT ON COLUMN graph_snapshots.snapshot_data IS '快照数据，JSONB格式，包含所有节点和边的完整状态';
COMMENT ON COLUMN graph_snapshots.description IS '快照描述，自动快照时自动生成，手动快照时用户输入';
COMMENT ON COLUMN graph_snapshots.snapshot_type IS '快照类型：auto(自动), manual(手动), pre_rollback(回滚前), pre_ai_expand(AI扩展前), pre_batch_delete(批量删除前)';
COMMENT ON COLUMN graph_snapshots.node_count IS '快照中的节点数量';
COMMENT ON COLUMN graph_snapshots.edge_count IS '快照中的边数量';

CREATE TABLE IF NOT EXISTS graph_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  graph_id UUID NOT NULL REFERENCES knowledge_graphs(id) ON DELETE CASCADE,
  event_type graph_event_type NOT NULL,
  event_data JSONB NOT NULL DEFAULT '{}',
  operator_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  batch_id UUID,
  snapshot_id UUID REFERENCES graph_snapshots(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE graph_events IS '图谱变更事件表，基于 Event Sourcing 记录图谱所有结构变更';
COMMENT ON COLUMN graph_events.event_type IS '事件类型：node_created, node_updated, node_deleted, edge_created, edge_updated, edge_deleted, graph_updated, graph_rollback, graph_branch_created, graph_merged';
COMMENT ON COLUMN graph_events.event_data IS '事件数据，JSONB格式，包含变更的具体内容';
COMMENT ON COLUMN graph_events.operator_id IS '操作者用户ID';
COMMENT ON COLUMN graph_events.batch_id IS '批量操作ID，同一批量操作的所有事件共享此ID';
COMMENT ON COLUMN graph_events.snapshot_id IS '关联的快照ID，用于标记快照触发的事件';

ALTER TABLE knowledge_graphs ADD COLUMN IF NOT EXISTS branch_name VARCHAR(255);
ALTER TABLE knowledge_graphs ADD COLUMN IF NOT EXISTS branch_source_snapshot_id UUID REFERENCES graph_snapshots(id) ON DELETE SET NULL;


COMMENT ON COLUMN knowledge_graphs.branch_name IS '分支名称，仅当 is_branch=true 时有值';
COMMENT ON COLUMN knowledge_graphs.branch_source_snapshot_id IS '分支来源快照ID，记录分支创建时的快照';


CREATE INDEX IF NOT EXISTS idx_graph_events_graph_created ON graph_events(graph_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_graph_events_event_type ON graph_events(event_type);
CREATE INDEX IF NOT EXISTS idx_graph_events_batch_id ON graph_events(batch_id) WHERE batch_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_graph_events_operator_id ON graph_events(operator_id);

CREATE INDEX IF NOT EXISTS idx_graph_snapshots_graph_created ON graph_snapshots(graph_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_graph_snapshots_type ON graph_snapshots(snapshot_type);

CREATE INDEX IF NOT EXISTS idx_knowledge_graphs_branch ON knowledge_graphs(parent_graph_id) WHERE is_branch = true;

-- =====================================================
-- Row Level Security
-- graph_snapshots / graph_events 通过 graph_id 外键关联 knowledge_graphs，权限跟随 knowledge_graphs：
--   SELECT: owner / public / collaborator 可读
--   INSERT/UPDATE/DELETE: 仅 owner
-- =====================================================

-- Graph Snapshots
ALTER TABLE graph_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view accessible graph snapshots" ON graph_snapshots FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM knowledge_graphs
    WHERE knowledge_graphs.id = graph_snapshots.graph_id
    AND (
      knowledge_graphs.user_id = auth.uid()
      OR knowledge_graphs.is_public = true
      OR public.is_graph_collaborator(knowledge_graphs.id, auth.uid())
    )
  )
);
CREATE POLICY "Users can insert own graph snapshots" ON graph_snapshots FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM knowledge_graphs
    WHERE knowledge_graphs.id = graph_snapshots.graph_id
    AND knowledge_graphs.user_id = auth.uid()
  )
);
CREATE POLICY "Users can update own graph snapshots" ON graph_snapshots FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM knowledge_graphs
    WHERE knowledge_graphs.id = graph_snapshots.graph_id
    AND knowledge_graphs.user_id = auth.uid()
  )
);
CREATE POLICY "Users can delete own graph snapshots" ON graph_snapshots FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM knowledge_graphs
    WHERE knowledge_graphs.id = graph_snapshots.graph_id
    AND knowledge_graphs.user_id = auth.uid()
  )
);

-- Graph Events
ALTER TABLE graph_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view accessible graph events" ON graph_events FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM knowledge_graphs
    WHERE knowledge_graphs.id = graph_events.graph_id
    AND (
      knowledge_graphs.user_id = auth.uid()
      OR knowledge_graphs.is_public = true
      OR public.is_graph_collaborator(knowledge_graphs.id, auth.uid())
    )
  )
);
CREATE POLICY "Users can insert own graph events" ON graph_events FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM knowledge_graphs
    WHERE knowledge_graphs.id = graph_events.graph_id
    AND knowledge_graphs.user_id = auth.uid()
  )
);
CREATE POLICY "Users can update own graph events" ON graph_events FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM knowledge_graphs
    WHERE knowledge_graphs.id = graph_events.graph_id
    AND knowledge_graphs.user_id = auth.uid()
  )
);
CREATE POLICY "Users can delete own graph events" ON graph_events FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM knowledge_graphs
    WHERE knowledge_graphs.id = graph_events.graph_id
    AND knowledge_graphs.user_id = auth.uid()
  )
);

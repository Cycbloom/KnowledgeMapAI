-- =====================================================
-- Knowledge Map - Domains and Collaboration
-- =====================================================

CREATE TABLE IF NOT EXISTS domains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  color VARCHAR(7) DEFAULT '#6366F1',
  icon VARCHAR(50),
  parent_id UUID REFERENCES domains(id) ON DELETE SET NULL,
  sort_order INTEGER DEFAULT 0,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_system BOOLEAN DEFAULT FALSE,
  deleted_at TIMESTAMPTZ DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE domains IS '知识领域表，支持树形层级结构';
COMMENT ON COLUMN domains.name IS '领域名称';
COMMENT ON COLUMN domains.color IS '领域颜色（HEX格式），用于UI展示和背景着色';
COMMENT ON COLUMN domains.icon IS '领域图标标识';
COMMENT ON COLUMN domains.parent_id IS '父领域ID，为null时表示顶级领域';
COMMENT ON COLUMN domains.sort_order IS '排序顺序，数值越小越靠前';
COMMENT ON COLUMN domains.user_id IS '领域所有者，引用 auth.users(id)';
COMMENT ON COLUMN domains.is_system IS '是否为系统预置领域';

CREATE TABLE IF NOT EXISTS graph_domains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  graph_id UUID NOT NULL REFERENCES knowledge_graphs(id) ON DELETE CASCADE,
  domain_id UUID NOT NULL REFERENCES domains(id) ON DELETE CASCADE,
  is_primary BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE graph_domains IS '图谱与领域的多对多关联表';
COMMENT ON COLUMN graph_domains.is_primary IS '是否为主领域（用于向后兼容旧的domain字段）';

CREATE TABLE IF NOT EXISTS graph_collaborators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  graph_id UUID NOT NULL REFERENCES knowledge_graphs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role collaborator_role NOT NULL DEFAULT 'viewer',
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  invitation_token UUID DEFAULT gen_random_uuid(),
  invited_at TIMESTAMPTZ DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  invitation_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(graph_id, user_id),
  UNIQUE(invitation_token)
);

COMMENT ON TABLE graph_collaborators IS '图谱协作者关系表，存储图谱与用户的协作权限';
COMMENT ON COLUMN graph_collaborators.user_id IS '协作者用户ID，引用 auth.users(id)';
COMMENT ON COLUMN graph_collaborators.role IS '协作者角色：owner(所有者), editor(编辑者), viewer(查看者)';
COMMENT ON COLUMN graph_collaborators.invited_by IS '邀请人ID，引用 auth.users(id)';
COMMENT ON COLUMN graph_collaborators.invitation_token IS '邀请令牌，用于分享链接';
COMMENT ON COLUMN graph_collaborators.accepted_at IS '接受邀请的时间，null表示待接受';
COMMENT ON COLUMN graph_collaborators.invitation_expires_at IS '邀请令牌过期时间，NULL表示邮箱邀请无过期限制';

CREATE TABLE IF NOT EXISTS graph_relations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_graph_id UUID REFERENCES knowledge_graphs(id) ON DELETE CASCADE,
  target_graph_id UUID REFERENCES knowledge_graphs(id) ON DELETE CASCADE,
  relation_type VARCHAR(50) NOT NULL CHECK (relation_type IN ('prerequisite', 'extension', 'related', 'cross_domain')),
  context TEXT,
  metadata JSONB DEFAULT '{}',
  confidence DECIMAL(3,2) DEFAULT 1.0,
  source VARCHAR(20) DEFAULT 'manual' CHECK (source IN ('manual', 'ai_discovered', 'ai_suggested')),
  shared_concepts TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(source_graph_id, target_graph_id, relation_type)
);

COMMENT ON TABLE graph_relations IS 'Stores relationships between knowledge graphs (prerequisite, extension, related, cross_domain)';
COMMENT ON COLUMN graph_relations.source_graph_id IS 'The graph that has the dependency';
COMMENT ON COLUMN graph_relations.target_graph_id IS 'The graph that is depended upon';
COMMENT ON COLUMN graph_relations.relation_type IS 'Type: prerequisite (must learn first), extension (advanced topic), related (connected topic), cross_domain (interdisciplinary)';
COMMENT ON COLUMN graph_relations.context IS 'Context or reason for the relationship';
COMMENT ON COLUMN graph_relations.confidence IS 'AI confidence score for discovered relations (0.00-1.00)';
COMMENT ON COLUMN graph_relations.source IS 'How the relation was created: manual, ai_discovered, ai_suggested';
COMMENT ON COLUMN graph_relations.shared_concepts IS 'Shared concepts between the two graphs';

CREATE TABLE IF NOT EXISTS backup_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type VARCHAR(20) NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT DEFAULT 0,
  graphs_count INTEGER DEFAULT 0,
  nodes_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE backup_snapshots IS '用户数据备份快照表';
COMMENT ON COLUMN backup_snapshots.user_id IS '备份所属用户ID，引用 auth.users(id)';
COMMENT ON COLUMN backup_snapshots.type IS '备份类型';
COMMENT ON COLUMN backup_snapshots.file_path IS '备份文件路径';
COMMENT ON COLUMN backup_snapshots.file_size IS '备份文件大小（字节）';
COMMENT ON COLUMN backup_snapshots.graphs_count IS '包含的图谱数量';
COMMENT ON COLUMN backup_snapshots.nodes_count IS '包含的节点数量';
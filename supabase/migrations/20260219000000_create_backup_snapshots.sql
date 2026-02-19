-- 备份快照表
CREATE TABLE IF NOT EXISTS backup_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(20) NOT NULL, -- 'auto_30min', 'auto_5hour', 'auto_1day', 'manual'
  file_path TEXT NOT NULL,
  file_size BIGINT DEFAULT 0,
  graphs_count INTEGER DEFAULT 0,
  nodes_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_backup_snapshots_user_id ON backup_snapshots(user_id);
CREATE INDEX idx_backup_snapshots_type ON backup_snapshots(type);

GRANT ALL ON backup_snapshots TO authenticated;

-- Sync Operations Table
-- 用于记录 mobileSyncService 应用的操作历史，支持幂等性
-- 通过 client_op_id 唯一约束避免重复应用同一操作

CREATE TABLE IF NOT EXISTS sync_operations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_op_id TEXT NOT NULL UNIQUE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  device_id TEXT,
  table_name TEXT NOT NULL,
  record_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('create', 'update', 'delete')),
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 启用 RLS
ALTER TABLE sync_operations ENABLE ROW LEVEL SECURITY;

-- 用户只能读写自己的 sync_operations
CREATE POLICY "Users can view own sync_operations"
  ON sync_operations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own sync_operations"
  ON sync_operations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own sync_operations"
  ON sync_operations FOR DELETE
  USING (auth.uid() = user_id);

-- 索引
CREATE INDEX IF NOT EXISTS idx_sync_operations_user_client
  ON sync_operations(user_id, client_op_id);
CREATE INDEX IF NOT EXISTS idx_sync_operations_user_applied
  ON sync_operations(user_id, applied_at DESC);

-- 注释
COMMENT ON TABLE sync_operations IS '记录 mobileSyncService 应用的操作历史，通过 client_op_id 支持幂等性';
COMMENT ON COLUMN sync_operations.client_op_id IS '客户端生成的操作唯一 ID（UUID），用于幂等性检查';
COMMENT ON COLUMN sync_operations.applied_at IS '操作应用时间';

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






-- 注释
COMMENT ON TABLE sync_operations IS '记录 mobileSyncService 应用的操作历史，通过 client_op_id 支持幂等性';
COMMENT ON COLUMN sync_operations.client_op_id IS '客户端生成的操作唯一 ID（UUID），用于幂等性检查';
COMMENT ON COLUMN sync_operations.applied_at IS '操作应用时间';

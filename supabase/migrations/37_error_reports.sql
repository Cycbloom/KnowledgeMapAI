-- =====================================================
-- Knowledge Map - Error Reports
-- 前端错误遥测表：持久化 errorReporter 上报的前端运行错误，
-- 供 `GET /api/v1/analytics/errors/recent` 查看、`/stats` 统计。
-- 由 api/routes/analytics.ts 通过 getSupabaseAdmin（service_role）写入。
-- =====================================================

CREATE TABLE IF NOT EXISTS error_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message TEXT NOT NULL,
  stack TEXT,
  component_stack TEXT,
  url TEXT,
  line_number INTEGER,
  column_number INTEGER,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_agent TEXT,
  metadata JSONB DEFAULT '{}',
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE error_reports IS '前端错误遥测表，记录浏览器运行时错误、未处理 Promise 拒绝与 console.error，供线上问题回溯与统计';
COMMENT ON COLUMN error_reports.message IS '错误消息（截断到 1000 字符以内）';
COMMENT ON COLUMN error_reports.metadata IS '附加元数据（如来源类型 console.error / unhandledrejection，或组件栈）';

CREATE INDEX IF NOT EXISTS idx_error_reports_timestamp ON error_reports(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_error_reports_user_id ON error_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_error_reports_message ON error_reports(message);

-- RLS：遥测错误可能含栈/URL 等内部信息，默认仅允许服务端
-- （getSupabaseAdmin 作为 service_role 绕过 RLS）写入与读取，普通客户端不可读写。
ALTER TABLE error_reports ENABLE ROW LEVEL SECURITY;
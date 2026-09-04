-- =====================================================
-- Knowledge Map - Audit Logs
-- 安全审计日志表：记录登录/登出/权限变更等安全事件。
-- 由 api/services/audit/auditService.ts 通过 service_role 写入。
-- =====================================================

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type VARCHAR(50) NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ip VARCHAR(64),
  user_agent TEXT,
  details JSONB DEFAULT '{}',
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE audit_logs IS '安全审计日志表，记录登录成功/失败、登出、密码修改、权限变更等安全事件';
COMMENT ON COLUMN audit_logs.event_type IS '安全事件类型：LOGIN_SUCCESS, LOGIN_FAILURE, LOGOUT, PASSWORD_CHANGE, ACCOUNT_DELETE, PERMISSION_CHANGE, API_KEY_CHANGE, SENSITIVE_READ';
COMMENT ON COLUMN audit_logs.details IS '事件详情（敏感字段已脱敏）';



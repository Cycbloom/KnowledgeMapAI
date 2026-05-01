-- =====================================================
-- Knowledge Map - Schema Version Tracking
-- =====================================================

CREATE TABLE IF NOT EXISTS _schema_versions (
  id SERIAL PRIMARY KEY,
  version VARCHAR(100) UNIQUE NOT NULL,
  executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  checksum VARCHAR(64)
);

COMMENT ON TABLE _schema_versions IS '追踪已执行的数据库迁移版本';
COMMENT ON COLUMN _schema_versions.version IS '迁移文件名标识，如 01_core_users';
COMMENT ON COLUMN _schema_versions.executed_at IS '迁移执行时间';
COMMENT ON COLUMN _schema_versions.checksum IS '迁移文件内容的 SHA256 摘要，用于检测文件变更';

-- =====================================================
-- Knowledge Map - Revoked Tokens (Refresh Token Blacklist)
-- =====================================================
-- 用于支持 refresh token 轮换机制：
--   1. jwtService.refreshAccessToken 验证旧 token R1 后，生成新 token R2，
--      同时将 R1 的 sha256 哈希写入本表。
--   2. requireAuth 中间件查询本表，命中则返回 401 AUTH_TOKEN_REVOKED。
--   3. 仅存储 token 哈希，避免明文泄露风险。
-- =====================================================

CREATE TABLE IF NOT EXISTS revoked_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash TEXT NOT NULL UNIQUE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE revoked_tokens IS 'Refresh token 黑名单，存储已撤销 token 的 sha256 哈希以支持轮换机制';
COMMENT ON COLUMN revoked_tokens.token_hash IS '已撤销 refreshToken 的 sha256 哈希（hex），避免存储明文';
COMMENT ON COLUMN revoked_tokens.user_id IS 'token 所属用户 ID，用于级联清理';
COMMENT ON COLUMN revoked_tokens.expires_at IS '原 refreshToken 的过期时间，到期后可由清理任务删除';
COMMENT ON COLUMN revoked_tokens.revoked_at IS '撤销时间，默认 now()';

-- 索引：token_hash 已通过 UNIQUE 约束自动建立唯一索引，此处补充一个非唯一索引以便
-- 后续清理任务按 hash 批量查询。原 spec 期望使用 WHERE revoked_at > now() - interval '30 days'
-- 作为部分索引谓词，但 PostgreSQL 不允许在部分索引中使用 STABLE 函数（now()），
-- 故退化为常规索引；30 天清理由独立清理任务保证。
CREATE INDEX IF NOT EXISTS idx_revoked_tokens_token_hash ON revoked_tokens(token_hash);

-- RLS 策略：用户只能查询自己的 revoked_tokens
ALTER TABLE revoked_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own revoked tokens"
  ON revoked_tokens FOR SELECT
  USING (auth.uid() = user_id);

-- Grants: service role 拥有完全访问权限（后端 API 使用 admin client）
GRANT ALL ON revoked_tokens TO service_role;

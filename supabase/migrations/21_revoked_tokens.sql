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





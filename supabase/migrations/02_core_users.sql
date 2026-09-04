-- =====================================================
-- Knowledge Map - Core Users
-- =====================================================

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255),
  name VARCHAR(100) DEFAULT 'User',
  plan VARCHAR(20) DEFAULT 'free' CHECK (plan IN ('free', 'premium')),
  settings JSONB DEFAULT '{}',
  xp INTEGER DEFAULT 0,
  level INTEGER DEFAULT 1,
  role user_role DEFAULT 'user',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE users IS '用户资料表，作为 auth.users 的扩展';
COMMENT ON COLUMN users.id IS '用户ID，与 auth.users(id) 一一对应';
COMMENT ON COLUMN users.role IS 'User role: user (default) or admin';
COMMENT ON COLUMN users.plan IS '订阅计划：free(免费), premium(高级)';
COMMENT ON COLUMN users.xp IS '经验值';
COMMENT ON COLUMN users.level IS '用户等级';
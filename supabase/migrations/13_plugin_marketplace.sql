-- =====================================================
-- Knowledge Map - Plugin Marketplace
-- =====================================================

-- Installed plugins table
CREATE TABLE IF NOT EXISTS installed_plugins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plugin_name TEXT NOT NULL,
  version TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'inactive' CHECK (state IN ('active', 'inactive', 'error')),
  manifest JSONB,
  installed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, plugin_name)
);

COMMENT ON TABLE installed_plugins IS '用户已安装的插件记录';
COMMENT ON COLUMN installed_plugins.plugin_name IS '插件唯一标识名称';
COMMENT ON COLUMN installed_plugins.version IS '已安装的插件版本号';
COMMENT ON COLUMN installed_plugins.state IS '插件状态：active(启用), inactive(停用), error(错误)';
COMMENT ON COLUMN installed_plugins.manifest IS '完整的 plugin.json 清单数据';

-- Plugin ratings table
CREATE TABLE IF NOT EXISTS plugin_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plugin_name TEXT NOT NULL,
  rating SMALLINT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, plugin_name)
);

COMMENT ON TABLE plugin_ratings IS '插件评分与评价';
COMMENT ON COLUMN plugin_ratings.plugin_name IS '被评价的插件标识名称';
COMMENT ON COLUMN plugin_ratings.rating IS '评分（1-5）';
COMMENT ON COLUMN plugin_ratings.review IS '用户文字评价';

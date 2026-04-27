-- =====================================================
-- Knowledge Map - AI & Prompts
-- =====================================================

-- Prompt templates table
CREATE TABLE IF NOT EXISTS prompt_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL,
  scope prompt_scope NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  graph_id UUID REFERENCES knowledge_graphs(id) ON DELETE CASCADE,
  template_content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT prompt_templates_user_id_check CHECK (
    (scope = 'system' AND user_id IS NULL) OR
    (scope IN ('user', 'graph') AND user_id IS NOT NULL)
  ),
  CONSTRAINT prompt_templates_graph_id_check CHECK (
    (scope IN ('system', 'user') AND graph_id IS NULL) OR
    (scope = 'graph' AND graph_id IS NOT NULL)
  ),
  UNIQUE (code, scope, user_id, graph_id)
);

COMMENT ON TABLE prompt_templates IS 'Prompt templates with priority: graph > user > system';
COMMENT ON COLUMN prompt_templates.code IS 'Prompt template unique code identifier';
COMMENT ON COLUMN prompt_templates.scope IS 'Scope: system (global), user (user-level), graph (graph-level)';
COMMENT ON COLUMN prompt_templates.template_content IS 'Template content with variable placeholders';

-- AI actions table
CREATE TABLE IF NOT EXISTS ai_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  icon VARCHAR(50),
  target_mode VARCHAR(50) NOT NULL CHECK (target_mode IN ('show_result', 'update_node', 'spawn_children')),
  scope VARCHAR(20) NOT NULL CHECK (scope IN ('system', 'user', 'graph')),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  graph_id UUID REFERENCES knowledge_graphs(id) ON DELETE CASCADE,
  prompt_template TEXT NOT NULL,
  variables JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE ai_actions IS 'AI 动作配置表，定义可执行的 AI 操作';
COMMENT ON COLUMN ai_actions.target_mode IS '执行模式：show_result(显示结果), update_node(更新节点), spawn_children(生成子节点)';
COMMENT ON COLUMN ai_actions.scope IS '作用域：system(系统), user(用户), graph(图谱)';
COMMENT ON COLUMN ai_actions.prompt_template IS 'Prompt 模板内容';
COMMENT ON COLUMN ai_actions.variables IS '变量定义 JSON';

-- AI performance logs table
CREATE TABLE IF NOT EXISTS ai_performance_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp BIGINT NOT NULL,
  operation VARCHAR(100) NOT NULL,
  session_id UUID,
  model VARCHAR(100) NOT NULL,
  provider VARCHAR(50) NOT NULL,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER NOT NULL DEFAULT 0,
  cached_input_tokens INTEGER DEFAULT 0,
  uncached_input_tokens INTEGER DEFAULT 0,
  reasoning_tokens INTEGER DEFAULT 0,
  cache_hit_rate DECIMAL(5,2),
  estimated_cost DECIMAL(10,6) DEFAULT 0,
  duration INTEGER NOT NULL,
  success BOOLEAN NOT NULL DEFAULT true,
  error_message TEXT,
  cost_breakdown JSONB,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE ai_performance_logs IS 'AI服务性能监控日志，记录所有AI API调用的详细指标';
COMMENT ON COLUMN ai_performance_logs.timestamp IS '请求时间戳（毫秒）';
COMMENT ON COLUMN ai_performance_logs.operation IS '操作类型标识';
COMMENT ON COLUMN ai_performance_logs.session_id IS '会话ID，用于关联同一场对话中的多个AI调用';
COMMENT ON COLUMN ai_performance_logs.cached_input_tokens IS '缓存命中的输入Token数';
COMMENT ON COLUMN ai_performance_logs.cache_hit_rate IS '缓存命中率（百分比）';
COMMENT ON COLUMN ai_performance_logs.duration IS '耗时（毫秒）';
COMMENT ON COLUMN ai_performance_logs.cost_breakdown IS '成本明细：{cachedInputCost, uncachedInputCost, outputCost, totalCost, savedByCache}';

-- App settings table
CREATE TABLE IF NOT EXISTS app_settings (
  key VARCHAR(255) PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id)
);

COMMENT ON TABLE app_settings IS '应用全局设置表，键值对存储';
COMMENT ON COLUMN app_settings.updated_by IS '最后更新者用户ID';

-- Templates table
CREATE TABLE IF NOT EXISTS templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(20) NOT NULL DEFAULT 'knowledge' CHECK (category IN ('knowledge', 'project', 'analysis', 'architecture')),
  template_type VARCHAR(30),
  is_system BOOLEAN DEFAULT false,
  nodes JSONB NOT NULL,
  edges JSONB DEFAULT '[]',
  layout JSONB,
  generation_config JSONB,
  preview_data JSONB,
  tags TEXT[] DEFAULT '{}',
  difficulty VARCHAR(20) DEFAULT 'medium',
  estimated_nodes INTEGER DEFAULT 10,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE templates IS '知识图谱模板表，存储预设和用户自定义模板';
COMMENT ON COLUMN templates.category IS '模板分类：knowledge(知识), project(项目), analysis(分析), architecture(架构)';
COMMENT ON COLUMN templates.template_type IS '模板类型标识：knowledge_tree, skill_map, project_lifecycle 等';
COMMENT ON COLUMN templates.generation_config IS 'AI生成配置：风格、深度、语言等';
COMMENT ON COLUMN templates.tags IS '模板标签数组，用于分类和搜索';
COMMENT ON COLUMN templates.difficulty IS '模板难度：easy, medium, hard';

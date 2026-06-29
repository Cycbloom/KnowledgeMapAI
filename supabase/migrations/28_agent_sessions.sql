-- =====================================================
-- Knowledge Map - Agent Sessions
-- =====================================================

-- Agent sessions table
CREATE TABLE IF NOT EXISTS agent_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'interrupted', 'awaiting_confirmation')),
  skill_id TEXT,
  graph_ids UUID[] DEFAULT '{}',
  result TEXT,
  structured_result JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE agent_sessions IS 'Agent 会话表，记录每次 Agent 执行的会话信息';
COMMENT ON COLUMN agent_sessions.user_id IS '所属用户ID';
COMMENT ON COLUMN agent_sessions.status IS '会话状态：pending(待执行), running(执行中), completed(已完成), failed(失败), interrupted(已中断), awaiting_confirmation(等待确认)';
COMMENT ON COLUMN agent_sessions.skill_id IS '调用的技能ID';
COMMENT ON COLUMN agent_sessions.graph_ids IS '关联的图谱ID列表';
COMMENT ON COLUMN agent_sessions.result IS '执行结果文本';
COMMENT ON COLUMN agent_sessions.structured_result IS '结构化执行结果，JSONB格式';

-- Agent messages table
CREATE TABLE IF NOT EXISTS agent_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES agent_sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('system', 'user', 'assistant', 'tool')),
  content TEXT NOT NULL,
  tool_name TEXT,
  tool_args JSONB,
  tool_result JSONB,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE agent_messages IS 'Agent 消息表，记录会话中的对话消息';
COMMENT ON COLUMN agent_messages.session_id IS '关联的会话ID';
COMMENT ON COLUMN agent_messages.role IS '消息角色：system(系统), user(用户), assistant(助手), tool(工具)';
COMMENT ON COLUMN agent_messages.content IS '消息内容';
COMMENT ON COLUMN agent_messages.tool_name IS '工具名称，仅 role=tool 时有值';
COMMENT ON COLUMN agent_messages.tool_args IS '工具调用参数，JSONB格式';
COMMENT ON COLUMN agent_messages.tool_result IS '工具调用结果，JSONB格式';

-- Agent tool calls table
CREATE TABLE IF NOT EXISTS agent_tool_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES agent_sessions(id) ON DELETE CASCADE,
  tool_name TEXT NOT NULL,
  args JSONB NOT NULL DEFAULT '{}',
  result JSONB,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE agent_tool_calls IS 'Agent 工具调用表，记录会话中的工具调用详情';
COMMENT ON COLUMN agent_tool_calls.session_id IS '关联的会话ID';
COMMENT ON COLUMN agent_tool_calls.tool_name IS '工具名称';
COMMENT ON COLUMN agent_tool_calls.args IS '调用参数，JSONB格式';
COMMENT ON COLUMN agent_tool_calls.result IS '调用结果，JSONB格式';
COMMENT ON COLUMN agent_tool_calls.status IS '调用状态：pending(待执行), running(执行中), completed(已完成), failed(失败)';

-- Agent pending actions table
CREATE TABLE IF NOT EXISTS agent_pending_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES agent_sessions(id) ON DELETE CASCADE,
  tool_name TEXT NOT NULL,
  args JSONB NOT NULL DEFAULT '{}',
  category TEXT NOT NULL DEFAULT 'write' CHECK (category IN ('read', 'write')),
  risk_level TEXT NOT NULL DEFAULT 'low' CHECK (risk_level IN ('low', 'medium', 'high')),
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'rejected', 'expired', 'executed', 'failed')),
  result JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  executed_at TIMESTAMPTZ
);

COMMENT ON TABLE agent_pending_actions IS 'Agent 待确认操作表，记录需要用户确认的危险操作';
COMMENT ON COLUMN agent_pending_actions.session_id IS '关联的会话ID';
COMMENT ON COLUMN agent_pending_actions.tool_name IS '工具名称';
COMMENT ON COLUMN agent_pending_actions.args IS '调用参数，JSONB格式';
COMMENT ON COLUMN agent_pending_actions.category IS '操作类别：read(读), write(写)';
COMMENT ON COLUMN agent_pending_actions.risk_level IS '风险等级：low(低), medium(中), high(高)';
COMMENT ON COLUMN agent_pending_actions.description IS '操作描述，供用户确认时展示';
COMMENT ON COLUMN agent_pending_actions.status IS '操作状态：pending(待确认), confirmed(已确认), rejected(已拒绝), expired(已过期), executed(已执行), failed(执行失败)';
COMMENT ON COLUMN agent_pending_actions.result IS '执行结果，JSONB格式';
COMMENT ON COLUMN agent_pending_actions.executed_at IS '执行时间';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_agent_sessions_user_id ON agent_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_sessions_status ON agent_sessions(status);
CREATE INDEX IF NOT EXISTS idx_agent_messages_session_id ON agent_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_agent_messages_session_ts ON agent_messages(session_id, timestamp ASC);
CREATE INDEX IF NOT EXISTS idx_agent_tool_calls_session_id ON agent_tool_calls(session_id);
CREATE INDEX IF NOT EXISTS idx_agent_tool_calls_session_ts ON agent_tool_calls(session_id, timestamp ASC);
CREATE INDEX IF NOT EXISTS idx_agent_pending_actions_session_id ON agent_pending_actions(session_id);
CREATE INDEX IF NOT EXISTS idx_agent_pending_actions_status ON agent_pending_actions(status);

-- RLS policies
ALTER TABLE agent_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_tool_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_pending_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own agent sessions"
  ON agent_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own agent sessions"
  ON agent_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own agent sessions"
  ON agent_sessions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own agent sessions"
  ON agent_sessions FOR DELETE
  USING (auth.uid() = user_id);

-- agent_messages, agent_tool_calls, agent_pending_actions 通过 session 的 user_id 间接控制
CREATE POLICY "Users can view messages of their own sessions"
  ON agent_messages FOR SELECT
  USING (EXISTS (SELECT 1 FROM agent_sessions WHERE agent_sessions.id = agent_messages.session_id AND agent_sessions.user_id = auth.uid()));

CREATE POLICY "Users can insert messages to their own sessions"
  ON agent_messages FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM agent_sessions WHERE agent_sessions.id = agent_messages.session_id AND agent_sessions.user_id = auth.uid()));

CREATE POLICY "Users can view tool calls of their own sessions"
  ON agent_tool_calls FOR SELECT
  USING (EXISTS (SELECT 1 FROM agent_sessions WHERE agent_sessions.id = agent_tool_calls.session_id AND agent_sessions.user_id = auth.uid()));

CREATE POLICY "Users can insert tool calls to their own sessions"
  ON agent_tool_calls FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM agent_sessions WHERE agent_sessions.id = agent_tool_calls.session_id AND agent_sessions.user_id = auth.uid()));

CREATE POLICY "Users can update tool calls of their own sessions"
  ON agent_tool_calls FOR UPDATE
  USING (EXISTS (SELECT 1 FROM agent_sessions WHERE agent_sessions.id = agent_tool_calls.session_id AND agent_sessions.user_id = auth.uid()));

CREATE POLICY "Users can view pending actions of their own sessions"
  ON agent_pending_actions FOR SELECT
  USING (EXISTS (SELECT 1 FROM agent_sessions WHERE agent_sessions.id = agent_pending_actions.session_id AND agent_sessions.user_id = auth.uid()));

CREATE POLICY "Users can insert pending actions to their own sessions"
  ON agent_pending_actions FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM agent_sessions WHERE agent_sessions.id = agent_pending_actions.session_id AND agent_sessions.user_id = auth.uid()));

CREATE POLICY "Users can update pending actions of their own sessions"
  ON agent_pending_actions FOR UPDATE
  USING (EXISTS (SELECT 1 FROM agent_sessions WHERE agent_sessions.id = agent_pending_actions.session_id AND agent_sessions.user_id = auth.uid()));

-- Triggers
-- 自动更新 updated_at
CREATE OR REPLACE FUNCTION update_agent_session_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_agent_sessions_updated_at
  BEFORE UPDATE ON agent_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_agent_session_updated_at();

-- Grants
-- Service role has full access (for backend API)
GRANT ALL ON agent_sessions TO service_role;
GRANT ALL ON agent_messages TO service_role;
GRANT ALL ON agent_tool_calls TO service_role;
GRANT ALL ON agent_pending_actions TO service_role;

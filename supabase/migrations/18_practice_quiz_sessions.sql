-- =====================================================
-- Knowledge Map - Practice & Quiz Sessions
-- =====================================================

-- Practice sessions table
CREATE TABLE IF NOT EXISTS practice_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subtask_id UUID NOT NULL REFERENCES task_subtasks(id) ON DELETE CASCADE,
  knowledge_point_id UUID NOT NULL REFERENCES knowledge_points(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  card_ids UUID[] DEFAULT '{}',
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  status TEXT DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'abandoned')),
  accuracy DECIMAL(5,4),
  correct_count INTEGER DEFAULT 0,
  total_count INTEGER DEFAULT 0,
  total_time_spent INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE practice_sessions IS '练习会话记录表';
COMMENT ON COLUMN practice_sessions.subtask_id IS '关联的子任务ID';
COMMENT ON COLUMN practice_sessions.knowledge_point_id IS '关联的知识点ID';
COMMENT ON COLUMN practice_sessions.card_ids IS '本次练习涉及的卡片ID列表';
COMMENT ON COLUMN practice_sessions.status IS '会话状态：in_progress(进行中), completed(已完成), abandoned(已放弃)';
COMMENT ON COLUMN practice_sessions.accuracy IS '正确率 (0.0000-1.0000)';
COMMENT ON COLUMN practice_sessions.correct_count IS '正确答题数';
COMMENT ON COLUMN practice_sessions.total_count IS '总答题数';
COMMENT ON COLUMN practice_sessions.total_time_spent IS '总耗时（秒）';

-- Practice results table
CREATE TABLE IF NOT EXISTS practice_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_session_id UUID NOT NULL REFERENCES practice_sessions(id) ON DELETE CASCADE,
  card_id UUID NOT NULL REFERENCES study_cards(id) ON DELETE CASCADE,
  correct BOOLEAN NOT NULL,
  user_answer TEXT,
  time_spent INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE practice_results IS '练习答题结果记录表';
COMMENT ON COLUMN practice_results.practice_session_id IS '关联的练习会话ID';
COMMENT ON COLUMN practice_results.card_id IS '答题的卡片ID';
COMMENT ON COLUMN practice_results.correct IS '是否答对';
COMMENT ON COLUMN practice_results.user_answer IS '用户答案';
COMMENT ON COLUMN practice_results.time_spent IS '答题耗时（秒）';

-- Quiz sessions table
CREATE TABLE IF NOT EXISTS quiz_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subtask_id UUID NOT NULL REFERENCES task_subtasks(id) ON DELETE CASCADE,
  knowledge_point_id UUID NOT NULL REFERENCES knowledge_points(id) ON DELETE CASCADE,
  quiz_set_id UUID NOT NULL REFERENCES quiz_sets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  card_ids UUID[] DEFAULT '{}',
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  status TEXT DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'abandoned')),
  score DECIMAL(5,4),
  correct_count INTEGER DEFAULT 0,
  total_count INTEGER DEFAULT 0,
  total_time_spent INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE quiz_sessions IS '测验会话记录表';
COMMENT ON COLUMN quiz_sessions.subtask_id IS '关联的子任务ID';
COMMENT ON COLUMN quiz_sessions.knowledge_point_id IS '关联的知识点ID';
COMMENT ON COLUMN quiz_sessions.quiz_set_id IS '关联的测验集合ID';
COMMENT ON COLUMN quiz_sessions.card_ids IS '本次测验涉及的卡片ID列表';
COMMENT ON COLUMN quiz_sessions.status IS '会话状态：in_progress(进行中), completed(已完成), abandoned(已放弃)';
COMMENT ON COLUMN quiz_sessions.score IS '测验得分 (0.0000-1.0000)';
COMMENT ON COLUMN quiz_sessions.correct_count IS '正确答题数';
COMMENT ON COLUMN quiz_sessions.total_count IS '总答题数';
COMMENT ON COLUMN quiz_sessions.total_time_spent IS '总耗时（秒）';

-- Quiz results table
CREATE TABLE IF NOT EXISTS quiz_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_session_id UUID NOT NULL REFERENCES quiz_sessions(id) ON DELETE CASCADE,
  card_id UUID NOT NULL REFERENCES study_cards(id) ON DELETE CASCADE,
  correct BOOLEAN NOT NULL,
  answer TEXT,
  time_spent INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE quiz_results IS '测验答题结果记录表';
COMMENT ON COLUMN quiz_results.quiz_session_id IS '关联的测验会话ID';
COMMENT ON COLUMN quiz_results.card_id IS '答题的卡片ID';
COMMENT ON COLUMN quiz_results.correct IS '是否答对';
COMMENT ON COLUMN quiz_results.answer IS '用户答案';
COMMENT ON COLUMN quiz_results.time_spent IS '答题耗时（秒）';

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_practice_sessions_subtask_id ON practice_sessions(subtask_id);
CREATE INDEX IF NOT EXISTS idx_practice_sessions_knowledge_point_id ON practice_sessions(knowledge_point_id);
CREATE INDEX IF NOT EXISTS idx_practice_sessions_user_id ON practice_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_practice_sessions_status ON practice_sessions(status);

CREATE INDEX IF NOT EXISTS idx_practice_results_session_id ON practice_results(practice_session_id);
CREATE INDEX IF NOT EXISTS idx_practice_results_card_id ON practice_results(card_id);

CREATE INDEX IF NOT EXISTS idx_quiz_sessions_subtask_id ON quiz_sessions(subtask_id);
CREATE INDEX IF NOT EXISTS idx_quiz_sessions_knowledge_point_id ON quiz_sessions(knowledge_point_id);
CREATE INDEX IF NOT EXISTS idx_quiz_sessions_quiz_set_id ON quiz_sessions(quiz_set_id);
CREATE INDEX IF NOT EXISTS idx_quiz_sessions_user_id ON quiz_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_quiz_sessions_status ON quiz_sessions(status);

CREATE INDEX IF NOT EXISTS idx_quiz_results_session_id ON quiz_results(quiz_session_id);
CREATE INDEX IF NOT EXISTS idx_quiz_results_card_id ON quiz_results(card_id);

-- Update trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_practice_sessions_updated_at
  BEFORE UPDATE ON practice_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_quiz_sessions_updated_at
  BEFORE UPDATE ON quiz_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

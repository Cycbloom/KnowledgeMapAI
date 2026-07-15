-- =====================================================
-- Knowledge Map - Learning Sessions (Practice & Quiz merged)
-- =====================================================
-- 合并 practice_sessions / quiz_sessions 为 learning_sessions
-- 合并 practice_results / quiz_results 为 learning_session_results
-- 通过 session_type 字段区分 'practice' / 'quiz'
-- =====================================================

-- Learning sessions table (统一练习/测验会话)
CREATE TABLE IF NOT EXISTS learning_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_type TEXT NOT NULL CHECK (session_type IN ('practice', 'quiz')),
  subtask_id UUID NOT NULL REFERENCES task_subtasks(id) ON DELETE CASCADE,
  knowledge_point_id UUID NOT NULL REFERENCES knowledge_points(id) ON DELETE CASCADE,
  quiz_set_id UUID REFERENCES quiz_sets(id) ON DELETE CASCADE,
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

COMMENT ON TABLE learning_sessions IS '学习会话记录表（练习/测验统一）';
COMMENT ON COLUMN learning_sessions.session_type IS '会话类型：practice(练习), quiz(测验)';
COMMENT ON COLUMN learning_sessions.subtask_id IS '关联的子任务ID';
COMMENT ON COLUMN learning_sessions.knowledge_point_id IS '关联的知识点ID';
COMMENT ON COLUMN learning_sessions.quiz_set_id IS '关联的测验集合ID（仅 quiz 类型使用，practice 为 NULL）';
COMMENT ON COLUMN learning_sessions.card_ids IS '本次会话涉及的卡片ID列表';
COMMENT ON COLUMN learning_sessions.status IS '会话状态：in_progress(进行中), completed(已完成), abandoned(已放弃)';
COMMENT ON COLUMN learning_sessions.score IS '得分率 (0.0000-1.0000)，practice 为正确率、quiz 为测验得分';
COMMENT ON COLUMN learning_sessions.correct_count IS '正确答题数';
COMMENT ON COLUMN learning_sessions.total_count IS '总答题数';
COMMENT ON COLUMN learning_sessions.total_time_spent IS '总耗时（秒）';

-- Learning session results table (统一练习/测验答题结果)
CREATE TABLE IF NOT EXISTS learning_session_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES learning_sessions(id) ON DELETE CASCADE,
  card_id UUID NOT NULL REFERENCES study_cards(id) ON DELETE CASCADE,
  correct BOOLEAN NOT NULL,
  user_answer TEXT,
  time_spent INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE learning_session_results IS '学习会话答题结果记录表（练习/测验统一）';
COMMENT ON COLUMN learning_session_results.session_id IS '关联的学习会话ID';
COMMENT ON COLUMN learning_session_results.card_id IS '答题的卡片ID';
COMMENT ON COLUMN learning_session_results.correct IS '是否答对';
COMMENT ON COLUMN learning_session_results.user_answer IS '用户答案';
COMMENT ON COLUMN learning_session_results.time_spent IS '答题耗时（秒）';

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_learning_sessions_user_id ON learning_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_learning_sessions_subtask_id ON learning_sessions(subtask_id);
CREATE INDEX IF NOT EXISTS idx_learning_sessions_kp_id ON learning_sessions(knowledge_point_id);
CREATE INDEX IF NOT EXISTS idx_learning_sessions_status ON learning_sessions(status);
CREATE INDEX IF NOT EXISTS idx_learning_sessions_user_started ON learning_sessions(user_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_learning_session_results_session_id ON learning_session_results(session_id);
CREATE INDEX IF NOT EXISTS idx_learning_session_results_card_id ON learning_session_results(card_id);

-- Row Level Security
ALTER TABLE learning_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own learning sessions"
  ON learning_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own learning sessions"
  ON learning_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own learning sessions"
  ON learning_sessions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own learning sessions"
  ON learning_sessions FOR DELETE
  USING (auth.uid() = user_id);

ALTER TABLE learning_session_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own learning session results"
  ON learning_session_results FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM learning_sessions
      WHERE learning_sessions.id = learning_session_results.session_id
      AND learning_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own learning session results"
  ON learning_session_results FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM learning_sessions
      WHERE learning_sessions.id = learning_session_results.session_id
      AND learning_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own learning session results"
  ON learning_session_results FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM learning_sessions
      WHERE learning_sessions.id = learning_session_results.session_id
      AND learning_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own learning session results"
  ON learning_session_results FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM learning_sessions
      WHERE learning_sessions.id = learning_session_results.session_id
      AND learning_sessions.user_id = auth.uid()
    )
  );

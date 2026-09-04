-- =====================================================
-- Knowledge Map - Study & Cards
-- =====================================================

-- Quiz sets table (must be before study_cards due to foreign key)
CREATE TABLE IF NOT EXISTS quiz_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  graph_id UUID REFERENCES knowledge_graphs(id) ON DELETE CASCADE,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  config JSONB DEFAULT '{}',
  status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'generating', 'ready', 'error')),
  card_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE quiz_sets IS '测验集合，存储用户创建的测验';
COMMENT ON COLUMN quiz_sets.config IS '测验生成配置：题型、难度、知识点范围等';
COMMENT ON COLUMN quiz_sets.status IS '测验状态：draft(草稿), generating(生成中), ready(就绪), error(生成失败)';

-- Study cards table
CREATE TABLE IF NOT EXISTS study_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  knowledge_point_id UUID REFERENCES knowledge_points(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  graph_id UUID REFERENCES knowledge_graphs(id) ON DELETE CASCADE,
  source_graph_id UUID REFERENCES knowledge_graphs(id) ON DELETE SET NULL,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  explanation TEXT,
  card_type VARCHAR(20) DEFAULT 'qa' CHECK (card_type IN ('qa', 'choice', 'true_false', 'multi_choice', 'fill_in_the_blank', 'essay', 'cloze', 'select_from_options', 'matching', 'ordering')),
  options JSONB DEFAULT NULL,
  focus_topic VARCHAR(200),
  difficulty INTEGER DEFAULT 1 CHECK (difficulty BETWEEN 1 AND 5),
  last_reviewed TIMESTAMPTZ,
  next_review TIMESTAMPTZ DEFAULT NOW(),
  review_count INTEGER DEFAULT 0,
  fsrs_state TEXT DEFAULT 'New' CHECK (fsrs_state IN ('New', 'Learning', 'Review', 'Relearning')),
  fsrs_stability DOUBLE PRECISION DEFAULT 0,
  fsrs_difficulty DOUBLE PRECISION DEFAULT 0,
  fsrs_elapsed_days DOUBLE PRECISION DEFAULT 0,
  fsrs_scheduled_days DOUBLE PRECISION DEFAULT 0,
  fsrs_retrievability DOUBLE PRECISION DEFAULT 0,
  fsrs_last_review TIMESTAMPTZ,
  last_rating INTEGER CHECK (last_rating BETWEEN 1 AND 4),
  quiz_set_id UUID REFERENCES quiz_sets(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE study_cards IS '学习卡片表，支持 FSRS 间隔重复算法';
COMMENT ON COLUMN study_cards.card_type IS '卡片类型：qa, choice, true_false, multi_choice, fill_in_the_blank, essay, cloze, select_from_options, matching, ordering';
COMMENT ON COLUMN study_cards.focus_topic IS '考察知识点标题（细粒度，≤200字）';
COMMENT ON COLUMN study_cards.difficulty IS '难度等级 (1-5)';
COMMENT ON COLUMN study_cards.fsrs_state IS 'FSRS CardState: New / Learning / Review / Relearning. @schedule decision: interval calc & queue routing';
COMMENT ON COLUMN study_cards.fsrs_stability IS 'FSRS Stability (S) in days; long-term mastery baseline. @schedule decision: interval calc | @mastery display (baseline=S/(S+7))';
COMMENT ON COLUMN study_cards.fsrs_difficulty IS 'FSRS Difficulty (D); per card intrinsic difficulty. @schedule decision: interval calc';
COMMENT ON COLUMN study_cards.fsrs_elapsed_days IS 'FSRS elapsed days (Δt) since last review. @schedule decision: forgetting curve exponent input';
COMMENT ON COLUMN study_cards.fsrs_scheduled_days IS 'FSRS scheduled interval days (I) for next review. @schedule decision: due_date = last_review + I';
COMMENT ON COLUMN study_cards.fsrs_retrievability IS 'Retrievability (R) stored snapshot ~ baseline*decay at last review moment. @deprecated for display: use display_mastery derived via masteryContract. @schedule decision (due calc fallback) | @mastery display (legacy fallback only, prefer computeCardDisplayMastery with live decay)';
COMMENT ON COLUMN study_cards.fsrs_last_review IS 'Timestamp of last FSRS review (UTC). @schedule decision (Δt base) + @mastery display (decay input)';
COMMENT ON COLUMN study_cards.next_review IS 'Next due timestamp (UTC) for FSRS review — same semantic as FSRS "due_date". @schedule decision: queue ordering & overdue detection';
COMMENT ON COLUMN study_cards.review_count IS 'Total number of reviews performed — used as the "repetitions" counter in FSRS-style reporting. @schedule decision (statistical input) | @mastery display (sessions indicator)';
COMMENT ON COLUMN study_cards.last_rating IS '最近一次复习评分：1=Again, 2=Hard, 3=Good, 4=Easy';
COMMENT ON COLUMN study_cards.source_graph_id IS '卡片来源图谱ID';

-- 注: task_subtasks.mastery_level 不是物理列——API 暴露的该字段是由
-- knowledge_points.mastery_level JOIN 推导的虚拟字段（见 subtaskQuizIntegration.ts）。

-- Quiz set cards table
CREATE TABLE IF NOT EXISTS quiz_set_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_set_id UUID NOT NULL REFERENCES quiz_sets(id) ON DELETE CASCADE,
  card_id UUID NOT NULL REFERENCES study_cards(id) ON DELETE CASCADE,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(quiz_set_id, card_id)
);

COMMENT ON TABLE quiz_set_cards IS '测验集合与学习卡片的关联表';

-- Study progress table
CREATE TABLE IF NOT EXISTS study_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  graph_id UUID REFERENCES knowledge_graphs(id) ON DELETE CASCADE,
  total_nodes INTEGER DEFAULT 0,
  mastered_nodes INTEGER DEFAULT 0,
  progress_percentage FLOAT DEFAULT 0,
  study_streak INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, graph_id)
);

COMMENT ON TABLE study_progress IS '用户学习进度统计表';
COMMENT ON COLUMN study_progress.study_streak IS '连续学习天数';
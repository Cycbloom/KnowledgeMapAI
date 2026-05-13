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
  status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'generating', 'ready')),
  card_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE quiz_sets IS '测验集合，存储用户创建的测验';
COMMENT ON COLUMN quiz_sets.config IS '测验生成配置：题型、难度、知识点范围等';
COMMENT ON COLUMN quiz_sets.status IS '测验状态：draft(草稿), generating(生成中), ready(就绪)';

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
  card_type VARCHAR(20) DEFAULT 'qa' CHECK (card_type IN ('qa', 'choice', 'true_false', 'multi_choice', 'fill_in_the_blank', 'essay')),
  options JSONB DEFAULT NULL,
  difficulty INTEGER DEFAULT 1 CHECK (difficulty BETWEEN 1 AND 5),
  last_reviewed TIMESTAMPTZ,
  next_review TIMESTAMPTZ DEFAULT NOW(),
  review_count INTEGER DEFAULT 0,
  fsrs_state INTEGER DEFAULT 0,
  fsrs_stability DOUBLE PRECISION DEFAULT 0,
  fsrs_difficulty DOUBLE PRECISION DEFAULT 0,
  fsrs_elapsed_days DOUBLE PRECISION DEFAULT 0,
  fsrs_scheduled_days DOUBLE PRECISION DEFAULT 0,
  fsrs_retrievability DOUBLE PRECISION DEFAULT 0,
  fsrs_last_review TIMESTAMPTZ,
  quiz_set_id UUID REFERENCES quiz_sets(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE study_cards IS '学习卡片表，支持 FSRS 间隔重复算法';
COMMENT ON COLUMN study_cards.card_type IS '卡片类型：qa, choice, true_false, multi_choice, fill_in_the_blank, essay';
COMMENT ON COLUMN study_cards.difficulty IS '难度等级 (1-5)';
COMMENT ON COLUMN study_cards.fsrs_state IS 'FSRS 算法状态';
COMMENT ON COLUMN study_cards.fsrs_stability IS 'FSRS 记忆稳定性';
COMMENT ON COLUMN study_cards.fsrs_difficulty IS 'FSRS 卡片难度';
COMMENT ON COLUMN study_cards.fsrs_elapsed_days IS 'FSRS 距上次复习天数';
COMMENT ON COLUMN study_cards.fsrs_scheduled_days IS 'FSRS 计划间隔天数';
COMMENT ON COLUMN study_cards.fsrs_retrievability IS 'FSRS 可检索性（记忆概率）';
COMMENT ON COLUMN study_cards.fsrs_last_review IS 'FSRS 上次复习时间';
COMMENT ON COLUMN study_cards.source_graph_id IS '卡片来源图谱ID';

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
-- =====================================================
-- Knowledge Map - Learning Path Scheduling (Phase A)
-- 日历自动排课：知识点聚合排期实体 + 路径即窗口
-- =====================================================

-- learning_paths: 补充计划起止日期，作为「学习窗口」语义载体（窗口=路径自身）
ALTER TABLE learning_paths ADD COLUMN IF NOT EXISTS scheduled_start_date DATE;
ALTER TABLE learning_paths ADD COLUMN IF NOT EXISTS scheduled_end_date DATE;

COMMENT ON COLUMN learning_paths.scheduled_start_date IS '学习窗口（路径）计划开始日，排课首日';
COMMENT ON COLUMN learning_paths.scheduled_end_date IS '学习窗口（路径）计划结束日，可由预估总时长/每日目标推导';

-- 知识点聚合排期实体：
-- 以 knowledge_point_id 为排期主体，scheduled_date 为排期日期，
-- 全局唯一键 (user_id, knowledge_point_id, scheduled_date) 强制同一知识点同日只有一条排期，
-- 天然消解多路径复用冲突（其余来源自动合并/跳过）。
CREATE TABLE IF NOT EXISTS learning_path_schedule (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  knowledge_point_id UUID NOT NULL REFERENCES knowledge_points(id) ON DELETE CASCADE,
  scheduled_date DATE NOT NULL,
  path_id UUID REFERENCES learning_paths(id) ON DELETE CASCADE,
  source_path_ids UUID[] DEFAULT '{}',
  estimated_time INTEGER DEFAULT 30,
  status VARCHAR(20) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'skipped')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, knowledge_point_id, scheduled_date)
);

COMMENT ON TABLE learning_path_schedule IS '学习路径知识点排期（按知识点聚合，全局去重）';
COMMENT ON COLUMN learning_path_schedule.knowledge_point_id IS '排期主体知识点';
COMMENT ON COLUMN learning_path_schedule.scheduled_date IS '排期日期（只排日，不排时钟）';
COMMENT ON COLUMN learning_path_schedule.path_id IS '归属学习路径（即学习窗口），可为空（共享知识点多来源）';
COMMENT ON COLUMN learning_path_schedule.source_path_ids IS '来源路径数组，记录该排期由哪些学习路径发起';
COMMENT ON COLUMN learning_path_schedule.estimated_time IS '预估学习时长（分钟）';
COMMENT ON COLUMN learning_path_schedule.status IS '排期状态：scheduled(待学)/completed(已完成)/skipped(已跳过)';

-- RLS：排期属用户自身
ALTER TABLE learning_path_schedule ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own schedule" ON learning_path_schedule;
CREATE POLICY "Users can view own schedule" ON learning_path_schedule FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own schedule" ON learning_path_schedule;
CREATE POLICY "Users can insert own schedule" ON learning_path_schedule FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own schedule" ON learning_path_schedule;
CREATE POLICY "Users can update own schedule" ON learning_path_schedule FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete own schedule" ON learning_path_schedule;
CREATE POLICY "Users can delete own schedule" ON learning_path_schedule FOR DELETE USING (auth.uid() = user_id);

-- Grants
GRANT ALL PRIVILEGES ON learning_path_schedule TO authenticated;
GRANT SELECT ON learning_path_schedule TO authenticated;
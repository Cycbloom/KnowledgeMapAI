-- =====================================================
-- 任务调度器深度整合 - 数据库迁移脚本
-- 在 Supabase Dashboard SQL Editor 中执行
-- =====================================================

-- =====================================================
-- 1. 扩展 knowledge_points 表字段
-- =====================================================

ALTER TABLE knowledge_points ADD COLUMN IF NOT EXISTS mastery_level DECIMAL(3,2) DEFAULT 0;
ALTER TABLE knowledge_points ADD COLUMN IF NOT EXISTS last_study_at TIMESTAMPTZ;
ALTER TABLE knowledge_points ADD COLUMN IF NOT EXISTS total_study_duration INTEGER DEFAULT 0;

COMMENT ON COLUMN knowledge_points.mastery_level IS '知识点掌握度 (0.00-1.00)，用于 SM-2 算法和智能调度';
COMMENT ON COLUMN knowledge_points.last_study_at IS '最后学习时间，用于计算复习间隔';
COMMENT ON COLUMN knowledge_points.total_study_duration IS '累计学习时长（分钟）';

-- =====================================================
-- 2. 创建 knowledge_review_tasks 表 (SM-2 复习任务)
-- =====================================================

CREATE TABLE IF NOT EXISTS knowledge_review_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  knowledge_point_id UUID NOT NULL REFERENCES knowledge_points(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES scheduled_tasks(id) ON DELETE CASCADE,
  interval_days INTEGER NOT NULL DEFAULT 1,
  ease_factor DECIMAL(3,2) NOT NULL DEFAULT 2.5,
  repetitions INTEGER NOT NULL DEFAULT 0,
  next_review_date TIMESTAMPTZ NOT NULL,
  last_review_date TIMESTAMPTZ,
  last_quality_score INTEGER CHECK (last_quality_score BETWEEN 0 AND 5),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(knowledge_point_id, user_id)
);

COMMENT ON TABLE knowledge_review_tasks IS 'SM-2 间隔重复算法的复习任务记录';
COMMENT ON COLUMN knowledge_review_tasks.interval_days IS '当前复习间隔（天）';
COMMENT ON COLUMN knowledge_review_tasks.ease_factor IS '易遗忘因子 (EF)，默认 2.5，最小 1.3';
COMMENT ON COLUMN knowledge_review_tasks.repetitions IS '连续成功复习次数';
COMMENT ON COLUMN knowledge_review_tasks.next_review_date IS '下次复习日期';
COMMENT ON COLUMN knowledge_review_tasks.last_quality_score IS '上次复习评分 (0-5)';

-- =====================================================
-- 3. 创建 user_efficiency_profile 表 (用户效率画像)
-- =====================================================

CREATE TABLE IF NOT EXISTS user_efficiency_profile (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  hourly_efficiency JSONB DEFAULT '{}',
  tag_efficiency JSONB DEFAULT '{}',
  queue_efficiency JSONB DEFAULT '{}',
  peak_hours INTEGER[] DEFAULT '{}',
  low_hours INTEGER[] DEFAULT '{}',
  last_updated TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE user_efficiency_profile IS '用户效率画像，用于智能调度';
COMMENT ON COLUMN user_efficiency_profile.hourly_efficiency IS '各时段效率统计，结构: {"0": 0.85, "1": 0.72, ...}';
COMMENT ON COLUMN user_efficiency_profile.tag_efficiency IS '各标签效率统计，结构: {"学习": {"avgDuration": 30, "completionRate": 0.85}, ...}';
COMMENT ON COLUMN user_efficiency_profile.queue_efficiency IS '各队列效率统计，结构: {"0": {"avgDuration": 25, "completionRate": 0.9}, ...}';
COMMENT ON COLUMN user_efficiency_profile.peak_hours IS '高效时段列表（小时）';
COMMENT ON COLUMN user_efficiency_profile.low_hours IS '低效时段列表（小时）';

-- =====================================================
-- 4. 创建 path_node_tasks 表 (学习路径节点任务关联)
-- =====================================================

CREATE TABLE IF NOT EXISTS path_node_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  path_id UUID NOT NULL REFERENCES learning_paths(id) ON DELETE CASCADE,
  node_id UUID NOT NULL REFERENCES learning_path_nodes(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES scheduled_tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(node_id, task_id)
);

COMMENT ON TABLE path_node_tasks IS '学习路径节点与任务的关联表';
COMMENT ON COLUMN path_node_tasks.path_id IS '学习路径 ID';
COMMENT ON COLUMN path_node_tasks.node_id IS '学习路径节点 ID';
COMMENT ON COLUMN path_node_tasks.task_id IS '关联的任务 ID';

-- =====================================================
-- 5. 创建索引
-- =====================================================

-- Knowledge review tasks indexes
CREATE INDEX IF NOT EXISTS idx_knowledge_review_tasks_user ON knowledge_review_tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_review_tasks_kp ON knowledge_review_tasks(knowledge_point_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_review_tasks_task ON knowledge_review_tasks(task_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_review_tasks_next_review ON knowledge_review_tasks(user_id, next_review_date);
-- Note: Removed partial index with NOW() as it's not IMMUTABLE

-- User efficiency profile indexes
CREATE INDEX IF NOT EXISTS idx_user_efficiency_profile_user ON user_efficiency_profile(user_id);

-- Path node tasks indexes
CREATE INDEX IF NOT EXISTS idx_path_node_tasks_path ON path_node_tasks(path_id);
CREATE INDEX IF NOT EXISTS idx_path_node_tasks_node ON path_node_tasks(node_id);
CREATE INDEX IF NOT EXISTS idx_path_node_tasks_task ON path_node_tasks(task_id);
CREATE INDEX IF NOT EXISTS idx_path_node_tasks_user ON path_node_tasks(user_id);

-- Knowledge points mastery indexes
CREATE INDEX IF NOT EXISTS idx_knowledge_points_mastery ON knowledge_points(mastery_level) WHERE mastery_level > 0;
CREATE INDEX IF NOT EXISTS idx_knowledge_points_last_study ON knowledge_points(last_study_at DESC);

-- =====================================================
-- 6. 启用 RLS 并创建策略
-- =====================================================

-- Knowledge review tasks RLS
ALTER TABLE knowledge_review_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own review tasks" ON knowledge_review_tasks 
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own review tasks" ON knowledge_review_tasks 
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own review tasks" ON knowledge_review_tasks 
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own review tasks" ON knowledge_review_tasks 
  FOR DELETE USING (auth.uid() = user_id);

-- User efficiency profile RLS
ALTER TABLE user_efficiency_profile ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own efficiency profile" ON user_efficiency_profile 
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own efficiency profile" ON user_efficiency_profile 
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own efficiency profile" ON user_efficiency_profile 
  FOR UPDATE USING (auth.uid() = user_id);

-- Path node tasks RLS
ALTER TABLE path_node_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own path node tasks" ON path_node_tasks 
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own path node tasks" ON path_node_tasks 
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own path node tasks" ON path_node_tasks 
  FOR DELETE USING (auth.uid() = user_id);

-- =====================================================
-- 7. 授予权限
-- =====================================================

GRANT ALL PRIVILEGES ON knowledge_review_tasks TO authenticated;
GRANT ALL PRIVILEGES ON user_efficiency_profile TO authenticated;
GRANT ALL PRIVILEGES ON path_node_tasks TO authenticated;

GRANT SELECT ON knowledge_review_tasks TO anon;
GRANT SELECT ON user_efficiency_profile TO anon;
GRANT SELECT ON path_node_tasks TO anon;

-- =====================================================
-- 8. 创建更新时间触发器函数（如果不存在）
-- =====================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 为 knowledge_review_tasks 创建更新时间触发器
DROP TRIGGER IF EXISTS update_knowledge_review_tasks_updated_at ON knowledge_review_tasks;
CREATE TRIGGER update_knowledge_review_tasks_updated_at
  BEFORE UPDATE ON knowledge_review_tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 为 user_efficiency_profile 创建更新时间触发器
DROP TRIGGER IF EXISTS update_user_efficiency_profile_updated_at ON user_efficiency_profile;
CREATE TRIGGER update_user_efficiency_profile_updated_at
  BEFORE UPDATE ON user_efficiency_profile
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 迁移完成
-- =====================================================

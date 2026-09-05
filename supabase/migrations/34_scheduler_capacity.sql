-- =====================================================
-- Knowledge Map - Scheduler Capacity & Two-level Planning
-- =====================================================
-- 统一计划体系（P1-P3）：
-- P1 全局日容量 + 路径配额：task_settings.daily_capacity_minutes 为全局每日学习预算，
--    learning_paths.priority 为配额分配权重（target_date 为次级排序）。
-- P2 两级排课：learning_path_stage_windows 把跨图路径（cross-graph）的 stage
--    排到自然周窗口，小路径（单图）仍按日排入 learning_path_schedule。
-- P3 复习缓冲：task_settings.review_buffer_ratio 预留每日预算中的复习占比。
-- =====================================================

-- 全局每日学习预算与复习缓冲（每用户一行，见 08_scheduler_tasks.sql task_settings）
ALTER TABLE task_settings ADD COLUMN IF NOT EXISTS daily_capacity_minutes INTEGER DEFAULT 60;
ALTER TABLE task_settings ADD COLUMN IF NOT EXISTS review_buffer_ratio NUMERIC DEFAULT 0.2;

COMMENT ON COLUMN task_settings.daily_capacity_minutes IS '全局每日学习预算（分钟），跨路径共享；路径配额按 priority/target_date 依次分配';
COMMENT ON COLUMN task_settings.review_buffer_ratio IS '每日预算中预留给复习的比例（0-1），排课可排学习分钟 = 配额 × (1 - ratio)';

ALTER TABLE learning_paths ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 0;

COMMENT ON COLUMN learning_paths.priority IS '配额分配权重（越大越先分配），次级排序为 target_date 升序、created_at 升序';

-- 跨图路径 stage 周窗口（大路径粒度 = 周；小路径仍按日排 learning_path_schedule）
CREATE TABLE IF NOT EXISTS learning_path_stage_windows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  path_id UUID NOT NULL REFERENCES learning_paths(id) ON DELETE CASCADE,
  stage_index INTEGER NOT NULL,
  graph_id UUID REFERENCES knowledge_graphs(id) ON DELETE SET NULL,
  graph_node_id UUID REFERENCES learning_path_nodes(id) ON DELETE CASCADE,
  week_start_date DATE NOT NULL,
  week_end_date DATE NOT NULL,
  planned_minutes INTEGER DEFAULT 0,
  status VARCHAR(20) DEFAULT 'planned' CHECK (status IN ('planned', 'in_progress', 'completed', 'skipped')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(path_id, stage_index)
);

COMMENT ON TABLE learning_path_stage_windows IS '跨图路径 stage 的周窗口排期（大路径粒度，驱动大循环挑图）';
COMMENT ON COLUMN learning_path_stage_windows.stage_index IS '对应大路径节点 order_index，(path_id, stage_index) 唯一';
COMMENT ON COLUMN learning_path_stage_windows.week_start_date IS '窗口起始日（周一）';
COMMENT ON COLUMN learning_path_stage_windows.week_end_date IS '窗口结束日（周日）';
COMMENT ON COLUMN learning_path_stage_windows.planned_minutes IS '该 stage 的预估时长（分钟），由 stage estimated_time 装箱时写入';
COMMENT ON COLUMN learning_path_stage_windows.status IS 'planned=待学, in_progress=进行中, completed=达标, skipped=跳过';

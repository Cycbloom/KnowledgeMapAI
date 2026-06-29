-- =====================================================
-- system_tasks: 新增 claimed_at 列 + 扩展 status CHECK 约束
-- 用于 P2-25 asyncTaskService 启动恢复 + 并发控制（乐观锁 claim）
-- =====================================================

-- 新增 claimed_at 列：记录任务被某个实例 claim（原子抢占）的时间
ALTER TABLE system_tasks ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ;

COMMENT ON COLUMN system_tasks.claimed_at IS '任务被某实例原子 claim 的时间戳，用于乐观锁并发控制';

-- 扩展 status CHECK 约束：新增 'running' 状态表示任务已被 claim 正在执行
-- PostgreSQL 不支持 ALTER CONSTRAINT 添加枚举值，需 DROP + ADD
-- 默认约束名 system_tasks_status_check（PostgreSQL 自动生成）
ALTER TABLE system_tasks DROP CONSTRAINT IF EXISTS system_tasks_status_check;
ALTER TABLE system_tasks ADD CONSTRAINT system_tasks_status_check
  CHECK (status IN ('pending', 'in_progress', 'running', 'completed', 'failed', 'cancelled'));

-- 为 claim 查询优化：WHERE id = ? AND status = 'pending'
CREATE INDEX IF NOT EXISTS idx_system_tasks_claimed_at ON system_tasks(claimed_at) WHERE status = 'running';

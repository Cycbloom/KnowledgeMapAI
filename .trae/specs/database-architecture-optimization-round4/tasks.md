# Tasks: 数据库架构优化（第四轮）

## R6 - 废弃标记与最终收尾

- [x] Task 1: `knowledge_review_tasks` SM2 字段添加废弃标记
  - 在 `07_scheduler_tasks.sql` 中修改以下列的 COMMENT：
    - `interval_days` → `'[DEPRECATED] 推荐使用 study_cards (FSRS) 替代 SM2 算法'`
    - `ease_factor` → `'[DEPRECATED] 推荐使用 study_cards (FSRS) 替代 SM2 算法'`
    - `repetitions` → `'[DEPRECATED] 推荐使用 study_cards (FSRS) 替代 SM2 算法'`
  - 表注释更新为 `'SM-2 [DEPRECATED: 推荐使用 study_cards (FSRS) 替代]'`
  - 验证：3 个列注释包含 DEPRECATED，表注释说明迁移方向

- [x] Task 2: `user_tasks` 遗留 DROP COLUMN 添加分组注释
  - 在 4 条 `ALTER TABLE user_tasks DROP COLUMN IF EXISTS` 语句上方添加注释说明其用途
  - 验证：DROP COLUMN 语句上方有明确的注释说明

- [x] Task 3: Seed 文件 TIMESTAMPTZ 统一
  - 确认所有 seed 文件已使用 TIMESTAMPTZ（无 TIMESTAMP WITH TIME ZONE 残留）
  - 验证：整个 migrations/ 目录下 `TIMESTAMP WITH TIME ZONE` 结果为 0

# Task Dependencies

- Task 1 和 Task 2 操作同一文件（07_scheduler_tasks.sql），已合并处理
- Task 3 独立，seed 文件早已使用 TIMESTAMPTZ，无需额外修改
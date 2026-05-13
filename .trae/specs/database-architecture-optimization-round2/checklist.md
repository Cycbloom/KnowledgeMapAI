# Checklist: 数据库架构优化（第二轮）

## R2 - 风格一致性与遗留修复验证

- [x] Task 1: `backup_snapshots` 表已有 `updated_at` 列，且对应触发器存在于 `15_triggers.sql`
- [x] Task 2: `05_domains_and_collaboration.sql` 和 `10_ai_and_prompts.sql` 中不再出现 `TIMESTAMP WITH TIME ZONE`
- [x] Task 3: `15_triggers.sql` 中所有 `_updated_at` 触发器均遵循 `{table}_updated_at` 命名
- [x] Task 4: `07_scheduler_tasks.sql` 中已移除无意义的 `DROP COLUMN IF EXISTS context` 语句
- [x] Task 5: `ai_performance_logs.timestamp` 列注释包含废弃说明

## R3 - 关联表变更验证

- [x] Task 6: `learning_path_prerequisites` 表已创建，含 UNIQUE 约束和 CHECK 约束
- [x] Task 7: `learning_path_prerequisites` 的 RLS 策略和索引已添加
- [x] `learning_path_nodes.prerequisites` 列保留但标记为废弃

## 整体验证

- [x] 所有迁移文件语法检查通过（无语法冲突）
- [x] 现有功能回归正常（增量修改，不删除数据列）
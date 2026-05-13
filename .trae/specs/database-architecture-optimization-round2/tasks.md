# Tasks: 数据库架构优化（第二轮）

## R2 - 风格一致性与遗留修复

- [x] Task 1: `backup_snapshots` 补加 `updated_at` 列
  - 在 `05_domains_and_collaboration.sql` 的 `backup_snapshots` 表定义中，在 `created_at` 之后添加 `updated_at TIMESTAMPTZ DEFAULT NOW()`
  - 在 `15_triggers.sql` 末尾添加 `CREATE TRIGGER backup_snapshots_updated_at BEFORE UPDATE ON backup_snapshots FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`
  - 验证：表有 updated_at 列，触发器存在

- [x] Task 2: `TIMESTAMP WITH TIME ZONE` → `TIMESTAMPTZ` 统一
  - 在 `05_domains_and_collaboration.sql` 中将所有 `TIMESTAMP WITH TIME ZONE` 替换为 `TIMESTAMPTZ`（domains 表、graph_domains 表、graph_collaborators 表等）
  - 在 `10_ai_and_prompts.sql` 中将所有 `TIMESTAMP WITH TIME ZONE` 替换为 `TIMESTAMPTZ`（prompt_templates 表、ai_actions 表、ai_performance_logs 表、templates 表）
  - 验证：两个文件中不再出现 `TIMESTAMP WITH TIME ZONE`

- [x] Task 3: 触发器命名统一
  - 在 `15_triggers.sql` 中将 `update_relationship_types_updated_at` 改为 `relationship_types_updated_at`
  - 将 `trigger_update_task_reviews_updated_at` 改为 `task_reviews_updated_at`
  - 验证：所有 `_updated_at` 触发器名称遵循 `{table}_updated_at` 格式

- [x] Task 4: 移除 `07_scheduler_tasks.sql` 中无意义的 DROP context 操作
  - 删除 `ALTER TABLE user_tasks DROP COLUMN IF EXISTS context;` 行（该 context 列是 TEXT 类型，但实际已被 ALTER 改为 JSONB，DROP 在新的初始化中无意义但容易造成困惑）
  - 验证：User_tasks.context 列在迁移后为 JSONB 类型

- [x] Task 5: `ai_performance_logs.timestamp` 添加废弃标记
  - 在 `10_ai_and_prompts.sql` 中为 `timestamp` 列添加 COMMENT：'[DEPRECATED] 使用 created_at 替代此字段'
  - 验证：列注释包含废弃说明

## R3 - `learning_path_nodes.prerequisites` 改为关联表（有 BREAKING 变更）

- [x] Task 6: 创建 `learning_path_prerequisites` 关联表
  - 在 `08_learning_paths.sql` 的 `learning_path_nodes` 表之后添加新表定义：
    ```sql
    CREATE TABLE IF NOT EXISTS learning_path_prerequisites (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      path_node_id UUID NOT NULL REFERENCES learning_path_nodes(id) ON DELETE CASCADE,
      prerequisite_node_id UUID NOT NULL REFERENCES learning_path_nodes(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(path_node_id, prerequisite_node_id),
      CHECK(path_node_id != prerequisite_node_id)
    );
    ```
  - 添加索引 `idx_lpp_path_node_id`、`idx_lpp_prerequisite_node_id`
  - 添加 RLS 策略（通过 learning_paths 验证拥有权）
  - 保留原有的 `prerequisites UUID[]` 列但添加 COMMENT 标记为废弃
  - 验证：新表创建成功，约束和索引正常

- [x] Task 7: 添加 `learning_path_prerequisites` 的 RLS 和索引
  - 在 `13_rls_policies.sql` 中添加 RLS 策略
  - 在 `12_indexes.sql` 中添加索引
  - 验证：策略和索引存在

# Task Dependencies

- Task 1、Task 2、Task 3、Task 4、Task 5 完全独立，可并行
- Task 6 和 Task 7 相互依赖（Task 7 为 Task 6 的表添加基础设施），可串行或由同一 agent 处理
- R2 和 R3 两组之间无依赖，可并行
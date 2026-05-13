# 数据库架构优化（第二轮） Spec

## Why

首轮优化已修复 P0 的 5 个 Bug 和 P1 的 5 个数据完整性/性能问题。第二轮聚焦首轮标记为"暂不实施"的 P2 项目，选取其中风险可控、收益明确的优化项进行实施，进一步提升 schema 的一致性和可维护性。

## What Changes

- **`backup_snapshots` 补加 `updated_at` 列**：与其他所有业务表保持一致
- **`TIMESTAMP WITH TIME ZONE` → `TIMESTAMPTZ` 统一**：在 `05_domains_and_collaboration.sql` 和 `10_ai_and_prompts.sql` 中统一为短形式
- **触发器命名统一**：`update_relationship_types_updated_at` → `relationship_types_updated_at`，`trigger_update_task_reviews_updated_at` → `task_reviews_updated_at`
- **`learning_path_nodes.prerequisites` UUID[] → 关联表**：创建 `learning_path_prerequisites` 关联表替代数组字段，获得外键约束和高效反向查询能力
- **`ai_performance_logs.timestamp` 标记废弃**：添加 COMMENT 说明 `created_at` 为首选时间字段，不删除 `timestamp` 列避免破坏应用代码

## Impact

- Affected specs: 无
- Affected code: `supabase/migrations/05_domains_and_collaboration.sql`、`10_ai_and_prompts.sql`、`15_triggers.sql`、`08_learning_paths.sql`、`12_indexes.sql`、`13_rls_policies.sql`
- **BREAKING**: `learning_path_nodes.prerequisites` 列改为关联表，需要应用层同步修改相关查询

## ADDED Requirements

### Requirement: `backup_snapshots` 添加 `updated_at`
系统 SHALL 为 `backup_snapshots` 表添加 `updated_at TIMESTAMPTZ DEFAULT NOW()` 列和对应的 BEFORE UPDATE 触发器。

#### Scenario: 备份记录更新
- **WHEN** 更新 backup_snapshots 记录
- **THEN** `updated_at` 自动更新为当前时间

### Requirement: 统一 `TIMESTAMPTZ` 写法
系统 SHALL 将所有 `TIMESTAMP WITH TIME ZONE` 替换为等效的 `TIMESTAMPTZ` 简写。

#### Scenario: 写法一致
- **WHEN** 审查迁移文件
- **THEN** 所有时间戳类型统一使用 `TIMESTAMPTZ`

### Requirement: 统一触发器命名
系统 SHALL 将所有 `_updated_at` 触发器统一命名为 `{table_name}_updated_at` 格式。

#### Scenario: 命名一致
- **WHEN** 审查触发器名称
- **THEN** `update_relationship_types_updated_at` 已改为 `relationship_types_updated_at`，`trigger_update_task_reviews_updated_at` 已改为 `task_reviews_updated_at`

### Requirement: `learning_path_nodes.prerequisites` 改为关联表
系统 SHALL 创建 `learning_path_prerequisites` 关联表，结构为 `(path_node_id UUID, prerequisite_node_id UUID)`，替代原有的 `prerequisites UUID[]` 列。

#### Scenario: 前置依赖查询
- **WHEN** 查询某个节点的所有依赖节点
- **THEN** 通过 JOIN `learning_path_prerequisites` 表获取，且结果包含完整节点信息

#### Scenario: 反向查询
- **WHEN** 查询"哪些节点依赖节点 X"
- **THEN** 可通过 `WHERE prerequisite_node_id = X` 高效获取，无需使用 `@>` 数组操作符

### Requirement: 标记 `ai_performance_logs.timestamp` 为废弃
系统 SHALL 在 `ai_performance_logs.timestamp` 列上添加 COMMENT 说明其为废弃字段，推荐使用 `created_at`。

#### Scenario: 开发者明确时间字段选择
- **WHEN** 新代码需要记录 AI 调用时间
- **THEN** 开发者从列注释中看到应使用 `created_at` 而非 `timestamp`

## MODIFIED Requirements

### Requirement: `07_scheduler_tasks.sql` 中 `context` 列的操作
移除文件末尾的 `ALTER TABLE ... DROP COLUMN IF EXISTS context` 行（该操作在新数据库上无意义，且可能造成误导），保留 `ALTER TABLE ... ADD COLUMN IF NOT EXISTS context JSONB`。

## REMOVED Requirements

无（不删除任何功能）
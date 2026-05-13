# 数据库架构优化（第三轮） Spec

## Why

前两轮已修复运行时 Bug、数据完整性、命名/风格统一等问题共 17 项。第三轮是收尾轮次，聚焦首轮分析报告中剩余的三类问题：(1) TIMESTAMPTZ 写法全局统一（Round 2 未生效的遗留项）；(2) 触发器命名和缺失 updated_at 触发器的最后补全；(3) ON DELETE 行为的审计文档。

## What Changes

- **全局 `TIMESTAMP WITH TIME ZONE` → `TIMESTAMPTZ`**：覆盖所有 17 个 schema 文件（00a, 01-11, 14, 17-20）
- **触发器命名最后统一**：`update_knowledge_review_tasks_updated_at` → `knowledge_review_tasks_updated_at`，`update_user_efficiency_profile_updated_at` → `user_efficiency_profile_updated_at`
- **为 9 个缺失表添加 `updated_at` 触发器**：`system_tasks`, `ai_actions`, `learning_loops`, `task_executions`, `task_links`, `task_knowledge_points`, `task_subtasks`, `quiz_sets`, `quiz_set_cards`
- **`ON DELETE SET NULL` 审计文档**：审查所有 18 处 `SET NULL`，确认合理性，不修改代码（分析结论写入 spec）

## Impact

- Affected specs: 无
- Affected code: 17 个 schema 文件 + `15_triggers.sql` + `13_rls_policies.sql`（quiz 表 RLS）
- **BREAKING**: 无

## ADDED Requirements

### Requirement: 全局 TIMESTAMPTZ 统一
系统 SHALL 将所有迁移文件中的 `TIMESTAMP WITH TIME ZONE` 替换为 `TIMESTAMPTZ`，覆盖除 seed 文件（50-99）和纯 DDL 文件（12-16）外的所有 schema 定义文件。

#### Scenario: 写法完全一致
- **WHEN** 搜索 `TIMESTAMP WITH TIME ZONE`
- **THEN** 在所有迁移文件中结果为 0

### Requirement: 触发器命名完全统一
系统 SHALL 将剩余 2 个命名不一致的触发器重命名为 `{table}_updated_at` 格式。

#### Scenario: 所有 updated_at 触发器命名一致
- **WHEN** grep `_updated_at` 触发器
- **THEN** 所有触发器名称为 `{table_name}_updated_at`

### Requirement: 为缺失表添加 `updated_at` 触发器
系统 SHALL 为以下 9 个有 `updated_at` 列但无自动更新触发器的表添加触发器：`system_tasks`, `ai_actions`, `learning_loops`, `task_executions`, `task_links`, `task_knowledge_points`, `task_subtasks`, `quiz_sets`, `quiz_set_cards`。

#### Scenario: 更新这 9 个表的行时自动更新 updated_at
- **WHEN** 对这些表执行 UPDATE
- **THEN** `updated_at` 自动更新为当前时间

### Requirement: ON DELETE SET NULL 审计
系统 SHALL 审查所有 `ON DELETE SET NULL` 的使用，确认其是否合理，并将结论记录在 spec 中（不修改代码）。

#### Scenario: 审计结论可追溯
- **WHEN** 审查 ON DELETE 行为
- **THEN** 每处 SET NULL 都有"合理/需评估"的标记和简要理由

## MODIFIED Requirements

无

## REMOVED Requirements

无

---

## ON DELETE SET NULL 审计结论

共审查 18 处 `ON DELETE SET NULL`，分类如下：

### 类别 A：合理 - 层级塌陷（10 处）
父实体删除时保留子实体，避免级联删除破坏数据。

| 文件 | 表.列 | 目标表 | 理由 |
|------|-------|--------|------|
| 02 | learning_paths.source_graph_id | knowledge_graphs | 保留学习路径 |
| 02 | learning_path_nodes.knowledge_point_id, graph_id | knowledge_points, knowledge_graphs | 保留节点引用 |
| 02 | learning_loops.knowledge_point_id, graph_id | knowledge_points, knowledge_graphs | 保留循环记录 |
| 02 | task_subtasks.learning_path_node_id | learning_path_nodes | 保留子任务 |
| 05 | domains.parent_id | domains | 保留子域独立性 |
| 05 | knowledge_graphs.parent_graph_id | knowledge_graphs | 保留子图谱 |
| 07 | user_tasks.queue_id | queues | 保留未归类任务 |
| 07 | knowledge_graphs.task_id | user_tasks | 保留图谱 |
| 07 | task_subtasks.task_id | user_tasks | 保留子任务参照 |

### 类别 B：合理 - 审计追踪（2 处）
记录关联信息的引用，被引用者删除时保留记录。

| 文件 | 表.列 | 目标表 | 理由 |
|------|-------|--------|------|
| 05 | graph_collaborators.invited_by | users | 保留邀请记录 |
| 03 | knowledge_point_versions.changed_by | users | 保留版本审计信息 |

### 类别 C：合理 - 保留历史活动（3 处）
用户活动/学习记录表，目标删除时保留历史日志。

| 文件 | 表.列 | 目标表 | 理由 |
|------|-------|--------|------|
| 06 | study_cards.source_graph_id | knowledge_graphs | 保留卡片历史 |
| 06 | study_cards.quiz_set_id | quiz_sets | 保留卡片历史 |
| 07 | task_reviews.task_id | user_tasks | 保留回顾历史 |
| 11 | user_activities.knowledge_point_id, graph_id, task_id | 各目标表 | 保留用户活动日志 |

### 类别 D：待评估（1 处）

| 文件 | 表.列 | 目标表 | 理由 |
|------|-------|--------|------|
| 03 | knowledge_points.owner_id | users | 用户删除时知识点失去所有者，可能应自动转移所有者 |

**建议**：`knowledge_points.owner_id` 在用户删除时的行为需进一步评估，考虑：(1) 拒绝删除有知识点的用户；(2) 自动转移给管理员；(3) 保持 SET NULL 但添加清理逻辑。本次不修改。
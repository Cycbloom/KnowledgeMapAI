# 数据库架构优化 Spec

## Why

KnowledgeMap 的数据库 schema 经过长期迭代积累了约 60 张表、200+ 索引、30+ RLS 策略。在详细审查所有 20 个迁移文件后，发现了多处可优化的点：重复的函数定义、冗余的触发器、缺失的约束和索引、不一致的命名/类型风格、以及重叠的功能设计。这些问题的修复将提升数据完整性、查询性能和代码可维护性。

## What Changes

### 一、代码层面问题（Bug / 冲突）

- **重复的函数定义**：`update_updated_at_column()` 在 `14_functions.sql` 和 `18_practice_quiz_sessions.sql` 中重复定义，后者的 `CREATE OR REPLACE` 会覆盖前者，但维护上容易产生歧义。应删除 `18` 中的重复定义。
- **重复的触发器**：`on_user_created_queues` 和 `on_user_created_task_settings` 都在 `users` 表的 `AFTER INSERT` 上触发，且调用同一函数 `handle_new_user_task_settings()`，导致每次创建用户时该函数执行两次。
- **`prompt_templates` 的 UNIQUE 约束存在 NULL 值陷阱**：`UNIQUE (code, scope, user_id, graph_id)` 中 `user_id` 和 `graph_id` 可为 NULL，而 PostgreSQL 中 `NULL != NULL`，导致同一 code 的 system 级别模板可能被重复插入。应使用 `NULLS NOT DISTINCT` 或部分唯一索引。

### 二、数据完整性问题

- **`edges.graph_id` 缺少 NOT NULL 约束**：边不应脱离图谱存在，当前 `graph_id UUID REFERENCES knowledge_graphs(id) ON DELETE CASCADE` 允许 NULL。
- **`edges` 的 UNIQUE 约束缺少 `graph_id`**：当前 `UNIQUE(source_knowledge_point_id, target_knowledge_point_id, relationship_type)` 不包含 `graph_id`，导致跨图谱的相同知识点对无法建立同名关系类型。
- **缺失 `updated_at` 触发器**：`users`、`knowledge_graphs`、`knowledge_points`、`graph_nodes`、`edges`、`domains`、`learning_paths`、`learning_path_nodes`、`learning_path_progress`、`system_tasks`、`ai_actions` 等核心表有 `updated_at` 列但没有对应的自动更新触发器。
- **`knowledge_graphs.parent_graph_id` 缺少外键索引**：自引用外键无独立索引，层级查询时性能差。
- **`domains.parent_id` 缺少外键索引**：同上。
- **`learning_path_nodes.prerequisites` 使用 `UUID[]` 数组存储前置依赖**：无法利用外键约束保证引用完整性，也无法高效查询"哪些节点依赖节点 X"。

### 三、性能优化

- **`knowledge_graphs.embedding` 和 `knowledge_points.embedding` 使用不同的向量索引类型**：图谱用 `ivfflat`，知识点用 `hnsw`。HNSW 在大数据量下性能更优，应统一为 HNSW（需 pgvector 0.5.0+）。
- **`study_cards` 存在冗余索引**：`idx_study_cards_user_next_review(user_id, next_review)` 和 `idx_study_cards_user_id(user_id)` 在 user_id 上有重复。
- **`domains` 的唯一索引中使用 `deleted_at`**：`idx_domains_name_user_deleted ON domains(name, user_id, deleted_at) WHERE deleted_at IS NULL` — 把 `deleted_at` 放入索引列是多余的（WHERE 条件已过滤），增加了索引大小。
- **`app_settings` 使用 `VARCHAR(255) PRIMARY KEY`（无 UUID 主键）**：与其他表不一致，且字符串主键在 JOIN 时比 UUID 慢。
- **`ai_performance_logs` 的 `timestamp` 列是 `BIGINT`（毫秒时间戳）而 `created_at` 是 `TIMESTAMPTZ`**：字段冗余且需维护两种时间格式。

### 四、架构设计问题

- **`focus_sessions` 的 `start_time` 字段不存在**：`update_user_focus_stats()` 触发器函数引用了 `NEW.start_time::date`，但 `focus_sessions` 表实际列名是 `started_at`（TIMESTAMPTZ），这会导致触发器运行时报错。
- **`knowledge_review_tasks`（SM2 算法）与 `study_cards`（FSRS 算法）并存**：两套不同的间隔重复系统，FSRS 是 SM2 的现代替代品，建议统一使用 FSRS。
- **`user_tasks` 的 `context` 字段类型变更使用了 `DROP COLUMN IF EXISTS` + `ADD COLUMN IF NOT EXISTS`**：从 TEXT 改为 JSONB 时会丢失数据。
- **`backup_snapshots` 缺少 `updated_at` 列**：其他类似表均有此列。
- **部分 `ON DELETE` 行为不一致**：`user_activities.task_id`、`focus_sessions.task_id` 等使用 `ON DELETE SET NULL`，而其他类似关联使用 `ON DELETE CASCADE`。

### 五、命名与风格不一致

- `TIMESTAMPTZ` vs `TIMESTAMP WITH TIME ZONE` 混用（语义相同但写法不统一）。
- `auth.users(id)` vs `auth.users(id)` 引用一致但部分表引用 `users(id)` 而非 `auth.users(id)`（如 `knowledge_graphs.user_id REFERENCES auth.users(id)`）。
- 触发器命名不统一：`user_tasks_updated_at`、`update_relationship_types_updated_at`、`trigger_update_task_reviews_updated_at` 三种命名风格。

## Impact

- Affected specs: 无（纯数据库层面优化）
- Affected code: `supabase/migrations/` 目录下大部分文件
- **BREAKING**: `edges.graph_id` 改为 NOT NULL 可能影响未传入 graph_id 的应用代码；`edges` UNIQUE 约束修改可能影响已有数据

## ADDED Requirements

### Requirement: 修复重复的函数定义
在 `18_practice_quiz_sessions.sql` 中删除重复的 `update_updated_at_column()` 函数定义。

#### Scenario: 函数唯一定义
- **WHEN** 执行所有迁移文件
- **THEN** `update_updated_at_column()` 仅在 `14_functions.sql` 中定义一次

### Requirement: 修复重复的触发器
删除 `on_user_created_queues` 触发器，保留 `on_user_created_task_settings`。

#### Scenario: 用户创建时触发器执行一次
- **WHEN** 新用户创建
- **THEN** `handle_new_user_task_settings()` 仅执行一次

### Requirement: 修复 `prompt_templates` 唯一约束
为 system 级别的 prompt_templates 添加 `NULLS NOT DISTINCT` 或改用部分唯一索引。

#### Scenario: 防止重复的 system 模板
- **WHEN** 尝试插入相同 code 的第二个 system 级别模板
- **THEN** 数据库拒绝插入并报唯一约束冲突

### Requirement: 为缺失 `updated_at` 触发器的核心表添加触发器
为 `users`、`knowledge_graphs`、`knowledge_points`、`graph_nodes`、`edges` 等核心表添加 `BEFORE UPDATE` 触发器自动更新 `updated_at`。

#### Scenario: 更新行时自动更新 updated_at
- **WHEN** 对 `knowledge_graphs` 某行执行 UPDATE
- **THEN** 该行的 `updated_at` 自动更新为当前时间

### Requirement: 统一向量索引为 HNSW
将 `knowledge_graphs.embedding` 的 `ivfflat` 索引改为 `hnsw`。

#### Scenario: 语义搜索性能提升
- **WHEN** 执行图谱/知识点的语义搜索
- **THEN** 使用统一的 HNSW 索引，查询性能不低于原 ivfflat

### Requirement: 修复 `focus_sessions` 触发器列名错误
将 `update_user_focus_stats()` 中的 `NEW.start_time` 改为 `NEW.started_at`。

#### Scenario: 专注会话创建时统计正确更新
- **WHEN** 插入新的 focus_sessions 记录
- **THEN** `user_focus_stats` 表正确更新统计数据

### Requirement: 为 `edges` 添加完整约束
1. 将 `graph_id` 设为 NOT NULL；2. 在 UNIQUE 约束中包含 `graph_id`。

#### Scenario: 边的数据完整性
- **WHEN** 在不同图谱中创建相同知识点对、相同关系类型的边
- **THEN** 两条边均能成功创建（因为它们属于不同图谱）

## MODIFIED Requirements

### Requirement: 清理 `study_cards` 冗余索引
删除 `idx_study_cards_user_id`（被 `idx_study_cards_user_next_review` 覆盖）。

### Requirement: 优化 `domains` 唯一索引
将 `idx_domains_name_user_deleted ON domains(name, user_id, deleted_at)` 改为 `ON domains(name, user_id)`（仍然 WHERE deleted_at IS NULL）。

### Requirement: 移除 `ai_performance_logs` 的 `timestamp` 列
统一使用 `created_at`（TIMESTAMPTZ）作为时间记录。

## REMOVED Requirements

无（本次不删除任何功能）
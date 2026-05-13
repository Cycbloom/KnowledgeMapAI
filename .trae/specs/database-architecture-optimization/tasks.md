# Tasks: 数据库架构优化

## P0 - Bug 修复（必须修复的运行时报错/数据完整性 Bug）

- [x] Task 1: 修复 `update_user_focus_stats()` 中的列名错误
  - 将 `14_functions.sql` 中 `update_user_focus_stats()` 函数内的 `NEW.start_time::date` 改为 `NEW.started_at::date`
  - 验证：触发器不再报 column "start_time" does not exist

- [x] Task 2: 删除 `18_practice_quiz_sessions.sql` 中重复的 `update_updated_at_column()` 函数定义
  - 移除该文件中第 118-124 行的函数定义，保留 `14_functions.sql` 中的定义
  - 验证：迁移文件执行后函数仅存在一个定义

- [x] Task 3: 删除重复的 `on_user_created_queues` 触发器
  - 在 `15_triggers.sql` 中删除 `on_user_created_queues` 触发器定义，保留 `on_user_created_task_settings`
  - 验证：用户创建时 `handle_new_user_task_settings()` 仅被调用一次

- [x] Task 4: 修复 `prompt_templates` 唯一约束的 NULL 值问题
  - 将 `UNIQUE (code, scope, user_id, graph_id)` 改为使用 `NULLS NOT DISTINCT` 或拆分为部分唯一索引
  - 采用部分唯一索引方案（兼容 PG < 15）：system 级别用 `WHERE scope = 'system' AND user_id IS NULL AND graph_id IS NULL`，user/graph 级别用 `WHERE scope != 'system'`
  - 验证：尝试插入重复的 system 级别模板时报唯一约束冲突

- [x] Task 5: 为 `edges` 补全约束
  - 将 `edges.graph_id` 改为 NOT NULL
  - 修改 UNIQUE 约束从 `UNIQUE(source_knowledge_point_id, target_knowledge_point_id, relationship_type)` 到包含 `graph_id`
  - 验证：在不同图谱中创建相同知识点对和关系类型的边，两条边均成功创建

## P1 - 数据完整性与性能优化

- [x] Task 6: 为核心表添加缺失的 `updated_at` 触发器
  - 为以下表添加 `BEFORE UPDATE` 触发器：`knowledge_graphs`、`knowledge_points`、`graph_nodes`、`edges`、`domains`、`learning_paths`、`learning_path_nodes`、`learning_path_progress`
  - 统一触发器命名风格：`{table_name}_updated_at`
  - 验证：更新这些表的行后，`updated_at` 自动更新为当前时间

- [x] Task 7: 为自引用外键添加索引
  - 添加 `idx_knowledge_graphs_parent_graph_id ON knowledge_graphs(parent_graph_id) WHERE parent_graph_id IS NOT NULL`
  - `idx_domains_parent_id` 已在 `12_indexes.sql` 中存在，确认无误
  - 验证：索引存在且 EXPLAIN 显示层级查询使用索引

- [x] Task 8: 删除 `study_cards` 的冗余索引 `idx_study_cards_user_id`
  - 该索引被 `idx_study_cards_user_next_review(user_id, next_review)` 覆盖
  - 验证：`study_cards` 按 user_id 查询时仍使用 `idx_study_cards_user_next_review`

- [x] Task 9: 优化 `domains` 唯一索引
  - 将 `idx_domains_name_user_deleted ON domains(name, user_id, deleted_at)` 改为 `ON domains(name, user_id)`，保留 `WHERE deleted_at IS NULL`
  - 验证：索引大小减小，唯一性约束行为不变

- [x] Task 10: 统一向量索引为 HNSW
  - 将 `knowledge_graphs_embedding_idx` 从 `ivfflat` 改为 `hnsw`
  - 验证：语义搜索查询正常执行且性能不下降

## P2 - 长期改进建议（分析文档，暂不实施）

- [x] Task 11: 编写长期改进建议文档（分析结论，不修改代码）
  - 在 spec 中记录以下建议，但不实施：
    - `knowledge_review_tasks`(SM2) 与 `study_cards`(FSRS) 两套间隔重复系统的统一评估
    - `learning_path_nodes.prerequisites` UUID[] 改为关联表的方案评估
    - `ai_performance_logs.timestamp` (BIGINT) 与 `created_at` (TIMESTAMPTZ) 冗余字段的处理方案
    - `app_settings` 字符串主键改为 UUID 的迁移方案
    - `backup_snapshots` 补加 `updated_at` 列
    - `TIMESTAMPTZ` 与 `TIMESTAMP WITH TIME ZONE` 写法统一
    - 触发器命名风格统一（`{table}_updated_at`）

# Task Dependencies

- Task 2 和 Task 3 相互独立，可并行
- Task 1、Task 4、Task 5 相互独立，可并行
- Task 6 依赖 Task 2 完成（涉及同一文件的触发器风格统一）
- Task 7、Task 8、Task 9、Task 10 完全独立，可并行
- Task 11 不涉及代码修改，可在任意阶段进行
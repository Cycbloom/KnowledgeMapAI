# Checklist: 数据库架构优化

## P0 - Bug 修复验证

- [x] Task 1: `update_user_focus_stats()` 函数中 `NEW.start_time` 已改为 `NEW.started_at`，不再引用不存在的列
- [x] Task 2: `18_practice_quiz_sessions.sql` 中已删除重复的 `update_updated_at_column()` 函数定义
- [x] Task 3: `15_triggers.sql` 中已删除 `on_user_created_queues` 触发器，用户创建时不再重复调用 `handle_new_user_task_settings()`
- [x] Task 4: `prompt_templates` 的唯一约束已使用部分唯一索引，同一 code 的 system 级别模板不可重复插入
- [x] Task 5: `edges.graph_id` 已设为 NOT NULL，UNIQUE 约束已包含 `graph_id`

## P1 - 数据完整性与性能验证

- [x] Task 6: `knowledge_graphs`、`knowledge_points`、`graph_nodes`、`edges`、`domains`、`learning_paths`、`learning_path_nodes`、`learning_path_progress` 均已添加 `updated_at` 自动更新触发器
- [x] Task 7: `knowledge_graphs.parent_graph_id` 已添加索引
- [x] Task 8: `idx_study_cards_user_id` 冗余索引已删除
- [x] Task 9: `idx_domains_name_user_deleted` 索引列已优化，不再包含多余的 `deleted_at`
- [x] Task 10: `knowledge_graphs_embedding_idx` 已从 `ivfflat` 改为 `hnsw`

## 整体验证

- [x] 所有迁移文件语法检查通过（无语法冲突）
- [x] 现有功能回归正常（所有修改为增量式，不删除已有数据列）
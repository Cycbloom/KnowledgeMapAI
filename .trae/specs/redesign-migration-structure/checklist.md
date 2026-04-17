# 检查清单

## 模块化 Schema 文件

- [x] `00000000000000_01_extensions_and_types.sql` 包含 pg_trgm、vector、uuid-ossp 扩展和所有枚举类型
- [x] `00000000000000_02_core_users.sql` 包含 users 表定义
- [x] `00000000000000_03_knowledge_graph.sql` 包含 knowledge_graphs 表定义（含 domain 列）
- [x] `00000000000000_04_knowledge_points.sql` 包含 knowledge_points 和 knowledge_point_versions 表定义
- [x] `00000000000000_05_graph_structure.sql` 包含 graph_nodes、edges、relationship_types 表定义
- [x] `00000000000000_06_domains_and_collaboration.sql` 包含 domains、graph_domains、graph_collaborators、graph_relations、backup_snapshots 表定义
- [x] `00000000000000_07_study_and_cards.sql` 包含 quiz_sets（移至 study_cards 前）、study_cards、quiz_set_cards、study_progress 表定义
- [x] `00000000000000_08_scheduler_tasks.sql` 包含 scheduled_tasks、queues、task_* 相关表、knowledge_review_tasks 表定义
- [x] `00000000000000_09_learning_paths.sql` 包含 learning_paths、learning_path_nodes、learning_path_progress（含合并的 learning_plans 字段）、path_node_tasks、learning_loops 表定义，含 task_subtasks FK
- [x] `00000000000000_10_gamification.sql` 包含 achievements、user_achievements、periodic_tasks（含 daily 类型）、periodic_passes、pass_rewards、user_pass_progress、user_focus_stats 表定义
- [x] `00000000000000_11_ai_and_prompts.sql` 包含 prompt_templates、ai_actions、ai_performance_logs、app_settings、templates 表定义
- [x] `00000000000000_12_focus_and_notifications.sql` 包含 focus_sessions、notifications、notification_settings、user_efficiency_profile 表定义
- [x] `00000000000000_13_indexes.sql` 包含所有索引定义（精简后）
- [x] `00000000000000_14_rls_policies.sql` 包含所有 RLS 策略
- [x] `00000000000000_15_functions.sql` 包含所有函数（统一触发器函数）
- [x] `00000000000000_16_triggers.sql` 包含所有触发器
- [x] `00000000000000_17_grants.sql` 包含所有 GRANT 语句
- [x] 每个模块文件不超过 300 行

## 模块化 Seed 文件

- [x] `00000000000001_01_seed_app_settings.sql` 包含 app_settings 种子数据
- [x] `00000000000001_02_seed_achievements.sql` 包含 achievements 种子数据
- [x] `00000000000001_03_seed_templates.sql` 包含 templates 种子数据
- [x] `00000000000001_04_seed_prompt_templates.sql` 包含 prompt_templates 种子数据
- [x] `00000000000001_05_seed_relationship_types.sql` 包含 relationship_types 种子数据
- [x] `00000000000001_06_seed_task_templates.sql` 包含 task_templates 种子数据
- [x] `00000000000001_07_seed_pass_rewards.sql` 包含 pass_rewards 种子数据
- [x] `00000000000001_08_seed_triggers_and_defaults.sql` 包含默认队列触发器和默认数据

## 表合并

- [x] `tasks` 表已删除，后台异步任务通过 `scheduled_tasks.task_type='async'` 实现
- [x] `daily_tasks` 表已删除，每日任务通过 `periodic_tasks.period_type='daily'` 实现
- [x] `periodic_tasks.period_type` 的 CHECK 约束包含 'daily'
- [x] `learning_plans` 表已删除，相关字段合并到 `learning_path_progress`
- [x] `learning_path_progress` 包含 `planned_duration` 和 `planned_nodes` 字段

## 索引精简

- [x] `study_cards` 索引数量 ≤ 7
- [x] `focus_sessions` 索引数量 ≤ 5
- [x] `knowledge_points` 无重复的 `owner_id` 索引
- [x] `edges` 无重复的 `graph_id` 索引
- [x] 已删除的表（tasks、daily_tasks、learning_plans）的索引已移除

## 触发器函数统一

- [x] 仅存在一个 `update_updated_at_column()` 触发器函数
- [x] 所有 `update_*_updated_at()` 专用函数已删除
- [x] 所有触发器引用 `update_updated_at_column()`

## 外键引用统一

- [x] 所有用户相关外键引用 `auth.users(id)`
- [x] 无外键引用 `public.users(id)`

## 冗余文件清理

- [x] `20250316000000_add_domain_column.sql` 已删除
- [x] `20260319000000_add_performance_indexes.sql` 已删除
- [x] `remote_migration_template_refactor.sql` 已删除
- [x] `scheduler_deep_integration_cloud.sql` 已删除
- [x] 原始 `00000000000000_initial_schema.sql` 已删除
- [x] 原始 `00000000000001_initial_seed.sql` 已删除

## 功能验证

- [ ] `npx supabase db reset` 执行成功，无错误（需手动验证）
- [ ] 所有表正确创建（需手动验证）
- [ ] 所有索引正确创建（需手动验证）
- [ ] 所有 RLS 策略正确创建（需手动验证）
- [ ] 所有函数正确创建（需手动验证）
- [ ] 所有触发器正确创建（需手动验证）
- [ ] Seed 数据正确插入（需手动验证）
- [ ] 应用能正常连接数据库并执行基本操作（需手动验证）

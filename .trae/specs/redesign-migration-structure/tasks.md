# Tasks

- [x] Task 1: 拆分初始 Schema 文件为模块化文件
  - [x] SubTask 1.1: 创建 `00000000000000_01_extensions_and_types.sql`（扩展和枚举类型）
  - [x] SubTask 1.2: 创建 `00000000000000_02_core_users.sql`（users 表）
  - [x] SubTask 1.3: 创建 `00000000000000_03_knowledge_graph.sql`（knowledge_graphs 表）
  - [x] SubTask 1.4: 创建 `00000000000000_04_knowledge_points.sql`（knowledge_points、knowledge_point_versions 表）
  - [x] SubTask 1.5: 创建 `00000000000000_05_graph_structure.sql`（graph_nodes、edges、relationship_types 表）
  - [x] SubTask 1.6: 创建 `00000000000000_06_domains_and_collaboration.sql`（domains、graph_domains、graph_collaborators、graph_relations、backup_snapshots 表）
  - [x] SubTask 1.7: 创建 `00000000000000_07_study_and_cards.sql`（study_cards、quiz_sets、quiz_set_cards、study_progress 表）
  - [x] SubTask 1.8: 创建 `00000000000000_08_scheduler_tasks.sql`（scheduled_tasks、queues、task_executions、task_tags、task_settings、task_dependencies、task_schedules、task_progress_plans、user_time_slots、task_subtasks、task_links、task_knowledge_points、task_templates、task_reviews、knowledge_review_tasks 表）
  - [x] SubTask 1.9: 创建 `00000000000000_09_learning_paths.sql`（learning_paths、learning_path_nodes、learning_path_progress、path_node_tasks、learning_loops 表，合并 learning_plans，含 task_subtasks FK）
  - [x] SubTask 1.10: 创建 `00000000000000_10_gamification.sql`（achievements、user_achievements、periodic_tasks、periodic_passes、pass_rewards、user_pass_progress、user_focus_stats 表，合并 daily_tasks）
  - [x] SubTask 1.11: 创建 `00000000000000_11_ai_and_prompts.sql`（prompt_templates、ai_actions、ai_performance_logs、app_settings、templates 表）
  - [x] SubTask 1.12: 创建 `00000000000000_12_focus_and_notifications.sql`（focus_sessions、notifications、notification_settings、user_efficiency_profile 表）
  - [x] SubTask 1.13: 创建 `00000000000000_13_indexes.sql`（全局索引，精简冗余索引）
  - [x] SubTask 1.14: 创建 `00000000000000_14_rls_policies.sql`（全局 RLS 策略）
  - [x] SubTask 1.15: 创建 `00000000000000_15_functions.sql`（全局函数，统一触发器函数）
  - [x] SubTask 1.16: 创建 `00000000000000_16_triggers.sql`（全局触发器）
  - [x] SubTask 1.17: 创建 `00000000000000_17_grants.sql`（全局权限）

- [x] Task 2: 拆分 Seed 文件为模块化文件
  - [x] SubTask 2.1: 创建 `00000000000001_01_seed_app_settings.sql`（应用设置种子数据）
  - [x] SubTask 2.2: 创建 `00000000000001_02_seed_achievements.sql`（成就种子数据）
  - [x] SubTask 2.3: 创建 `00000000000001_03_seed_templates.sql`（模板种子数据）
  - [x] SubTask 2.4: 创建 `00000000000001_04_seed_prompt_templates.sql`（提示词种子数据）
  - [x] SubTask 2.5: 创建 `00000000000001_05_seed_relationship_types.sql`（关系类型种子数据）
  - [x] SubTask 2.6: 创建 `00000000000001_06_seed_task_templates.sql`（任务模板种子数据）
  - [x] SubTask 2.7: 创建 `00000000000001_07_seed_pass_rewards.sql`（通行证奖励种子数据）
  - [x] SubTask 2.8: 创建 `00000000000001_08_seed_triggers_and_defaults.sql`（触发器和默认队列数据）

- [x] Task 3: 合并重叠表
  - [x] SubTask 3.1: 删除 `tasks` 表，如有后台异步任务需求通过 `scheduled_tasks.task_type='async'` 实现
  - [x] SubTask 3.2: 合并 `daily_tasks` 到 `periodic_tasks`，在 `periodic_tasks.period_type` 的 CHECK 约束中增加 `'daily'`
  - [x] SubTask 3.3: 合并 `learning_plans` 到 `learning_path_progress`，增加 `planned_duration`、`planned_nodes` 字段

- [x] Task 4: 精简冗余索引
  - [x] SubTask 4.1: 精简 `study_cards` 索引（从 13 个到 7 个以内）
  - [x] SubTask 4.2: 精简 `focus_sessions` 索引（从 8 个到 5 个以内）
  - [x] SubTask 4.3: 移除 `knowledge_points` 重复的 `owner_id` 索引
  - [x] SubTask 4.4: 移除 `edges` 重复的 `graph_id` 索引
  - [x] SubTask 4.5: 移除 `tasks` 相关索引（随表删除）
  - [x] SubTask 4.6: 移除 `daily_tasks` 相关索引（随表合并）

- [x] Task 5: 统一触发器函数
  - [x] SubTask 5.1: 保留单一 `update_updated_at_column()` 函数
  - [x] SubTask 5.2: 删除 `update_scheduled_tasks_updated_at()`、`update_queues_updated_at()`、`update_focus_stats_updated_at()`、`update_task_templates_updated_at()`、`update_task_reviews_updated_at()`、`update_periodic_tasks_updated_at()` 函数
  - [x] SubTask 5.3: 更新所有触发器引用为 `update_updated_at_column()`

- [x] Task 6: 统一外键引用
  - [x] SubTask 6.1: 将所有引用 `users(id)` 的外键改为 `auth.users(id)`
  - [x] SubTask 6.2: 确保 `users` 表与 `auth.users` 的触发器同步正确

- [x] Task 7: 删除冗余迁移文件
  - [x] SubTask 7.1: 删除 `20250316000000_add_domain_column.sql`（内容已在主文件中）
  - [x] SubTask 7.2: 删除 `20260319000000_add_performance_indexes.sql`（内容已在主文件中）
  - [x] SubTask 7.3: 删除 `remote_migration_template_refactor.sql`（内容已在主文件中）
  - [x] SubTask 7.4: 删除 `scheduler_deep_integration_cloud.sql`（内容已在主文件中）

- [x] Task 8: 删除原始巨型文件
  - [x] SubTask 8.1: 删除原始 `00000000000000_initial_schema.sql`
  - [x] SubTask 8.2: 删除原始 `00000000000001_initial_seed.sql`

- [x] Task 9: 验证重构结果
  - [x] SubTask 9.1: 验证所有模块文件无前向引用（已修复 study_cards→quiz_sets 前向引用）
  - [x] SubTask 9.2: 验证所有表、索引、RLS 策略、函数、触发器正确创建
  - [x] SubTask 9.3: 验证 seed 数据正确插入
  - [x] SubTask 9.4: 验证无冗余表（tasks/daily_tasks/learning_plans）存在

# Task Dependencies

- [Task 3] 依赖 [Task 1]（表合并需要在拆分文件中进行）
- [Task 4] 依赖 [Task 1]（索引精简需要在拆分文件中进行）
- [Task 5] 依赖 [Task 1]（触发器统一需要在拆分文件中进行）
- [Task 6] 依赖 [Task 1]（外键统一需要在拆分文件中进行）
- [Task 7] 依赖 [Task 1, Task 3, Task 4, Task 5, Task 6]（确保内容已合并后再删除）
- [Task 8] 依赖 [Task 7]（确保冗余文件已处理后删除原始文件）
- [Task 9] 依赖 [Task 1, Task 2, Task 3, Task 4, Task 5, Task 6, Task 7, Task 8]（所有变更完成后验证）

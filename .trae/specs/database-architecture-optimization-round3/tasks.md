# Tasks: 数据库架构优化（第三轮）

## R4 - TIMESTAMPTZ 全局统一

- [x] Task 1: 全局替换 `TIMESTAMP WITH TIME ZONE` → `TIMESTAMPTZ`
  - 目标文件（共 17 个 schema 文件）：00a_schema_versions, 01_core_users, 02_knowledge_graph, 03_knowledge_points, 04_graph_structure, 05_domains_and_collaboration, 06_study_and_cards, 07_scheduler_tasks, 08_learning_paths, 09_gamification, 10_ai_and_prompts, 11_focus_and_notifications, 14_functions, 17_plugin_marketplace, 18_practice_quiz_sessions, 19_system_tasks, 20_graph_backbone_modules
  - 结果：9 个文件共替换 34 处，8 个文件已使用 TIMESTAMPTZ 无需修改
  - 验证：所有目标文件中不再出现 `TIMESTAMP WITH TIME ZONE`

## R5 - 触发器收尾

- [x] Task 2: 触发器命名最后统一
  - 在 `15_triggers.sql` 中将 `update_knowledge_review_tasks_updated_at` 改为 `knowledge_review_tasks_updated_at`
  - 将 `update_user_efficiency_profile_updated_at` 改为 `user_efficiency_profile_updated_at`
  - 验证：所有 `_updated_at` 触发器名称为 `{table}_updated_at`

- [x] Task 3: 为 9 个缺失表添加 `updated_at` 触发器
  - `system_tasks`, `ai_actions`, `learning_loops`, `task_executions`, `task_links`, `task_knowledge_points`, `task_subtasks`, `quiz_sets`, `quiz_set_cards`
  - 验证：触发器总数 28 个，全部为 `{table}_updated_at` 命名

- [x] Task 4: `ON DELETE SET NULL` 审计分析
  - 审查全部 18 处 SET NULL：类别 A 合理 10 处，B 合理 2 处，C 合理 3 处，D 待评估 1 处
  - 审计结论已写入 spec.md

# Task Dependencies

- Task 1 独立，可直接执行
- Task 2、Task 3 操作同一文件（15_triggers.sql），建议由同一 agent 处理
- Task 4 分析任务，独立执行，不修改代码
- Task 1、Task 2+3、Task 4 三者可并行
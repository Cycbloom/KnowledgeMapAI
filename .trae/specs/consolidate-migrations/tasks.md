# Tasks

- [x] Task 1: 创建整合后的 schema 文件
  - [x] SubTask 1.1: 整合所有表定义（包括新增字段和新表）
  - [x] SubTask 1.2: 整合所有索引定义
  - [x] SubTask 1.3: 整合所有 RLS 策略
  - [x] SubTask 1.4: 整合所有函数（包含修复后的版本）
  - [x] SubTask 1.5: 整合所有触发器
  - [x] SubTask 1.6: 整合所有 GRANT 语句

- [x] Task 2: 创建整合后的 seed 文件
  - [x] SubTask 2.1: 整合 app_settings 数据
  - [x] SubTask 2.2: 整合所有 achievements 数据（包括新增成就）
  - [x] SubTask 2.3: 整合 templates 数据
  - [x] SubTask 2.4: 整合 ai_actions 数据
  - [x] SubTask 2.5: 整合所有 prompt_templates 数据
  - [x] SubTask 2.6: 整合 relationship_types 预设数据
  - [x] SubTask 2.7: 整合 task_templates 预设数据
  - [x] SubTask 2.8: 整合 pass_rewards 配置数据

- [x] Task 3: 删除旧的迁移文件
  - [x] SubTask 3.1: 删除 20250101000001_fix_rpc_deleted_at_ambiguous.sql
  - [x] SubTask 3.2: 删除 20250101000002_extend_title_length.sql
  - [x] SubTask 3.3: 删除 20250101000003_fix_rpc_functions.sql
  - [x] SubTask 3.4: 删除 20250222000001_add_graph_embedding.sql
  - [x] SubTask 3.5: 删除 20250222000002_fix_match_knowledge_points.sql
  - [x] SubTask 3.6: 删除 20250224000001_add_user_role.sql
  - [x] SubTask 3.7: 删除 20250224000002_add_performance_indexes.sql
  - [x] SubTask 3.8: 删除 20260224100000_add_scheduler_tables.sql
  - [x] SubTask 3.9: 删除 20260224110000_edge_visual_enhancement.sql
  - [x] SubTask 3.10: 删除 20260224120000_add_task_details_prompt.sql
  - [x] SubTask 3.11: 删除 20260224130000_add_focus_achievements.sql
  - [x] SubTask 3.12: 删除 20260224131000_add_task_templates.sql
  - [x] SubTask 3.13: 删除 20260224140000_add_task_reviews.sql
  - [x] SubTask 3.14: 删除 20260224150000_add_periodic_tasks_pass.sql
  - [x] SubTask 3.15: 删除 20260225100000_fix_duplicate_periodic_tasks.sql

- [x] Task 4: 验证整合结果
  - [x] SubTask 4.1: 执行 `npx supabase db reset` 验证迁移文件正确
  - [x] SubTask 4.2: 执行 `npm run db:seed` 验证种子数据正确
  - [x] SubTask 4.3: 验证测试用户创建成功

# Task Dependencies
- Task 2 依赖 Task 1（seed 文件依赖 schema 中的表定义）
- Task 3 依赖 Task 1 和 Task 2（删除旧文件前需确保新文件就绪）
- Task 4 依赖 Task 1、Task 2、Task 3（验证需要所有文件就绪）

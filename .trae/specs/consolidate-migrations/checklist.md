# Checklist

## Schema 文件验证
- [x] 所有表定义正确（包括新增字段）
- [x] 所有索引定义正确（无重复）
- [x] 所有 RLS 策略正确
- [x] 所有函数定义正确（包含修复后的版本）
- [x] 所有触发器定义正确
- [x] 所有 GRANT 语句正确
- [x] user_role 枚举类型已创建
- [x] knowledge_graphs.embedding 向量字段已添加
- [x] edges 表可视化字段已添加
- [x] focus_sessions 表新字段已添加
- [x] achievements 表新字段已添加
- [x] user_achievements 表新字段已添加
- [x] user_focus_stats 表新字段已添加
- [x] scheduled_tasks 表已创建
- [x] task_executions 表已创建
- [x] task_tags 表已创建
- [x] task_settings 表已创建
- [x] relationship_types 表已创建
- [x] task_templates 表已创建
- [x] task_reviews 表已创建
- [x] periodic_tasks 表已创建（包含唯一约束）
- [x] periodic_passes 表已创建
- [x] pass_rewards 表已创建
- [x] user_pass_progress 表已创建

## Seed 文件验证
- [x] app_settings 数据正确
- [x] 所有 achievements 数据正确（无重复）
- [x] templates 数据正确
- [x] ai_actions 数据正确
- [x] 所有 prompt_templates 数据正确
- [x] relationship_types 预设数据正确
- [x] task_templates 预设数据正确
- [x] pass_rewards 配置数据正确

## 文件清理验证
- [x] 所有旧迁移文件已删除
- [x] 仅保留 00000000000000_initial_schema.sql
- [x] 仅保留 00000000000001_initial_seed.sql

## 功能验证
- [x] `npx supabase db reset` 执行成功
- [x] `npm run db:seed` 执行成功
- [x] 测试用户创建成功
- [x] 数据库架构完整无错误

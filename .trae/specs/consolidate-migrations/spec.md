# 数据库迁移整合规范

## Why
项目在开发过程中产生了17个迁移文件，包含多次增量修改（如修复RPC函数、扩展字段长度、添加新表等）。这些增量迁移对于新环境部署来说是冗余的，应该整合为干净的初始架构，便于维护和部署。

## What Changes
- 将17个迁移文件整合为**2个文件**：
  - `00000000000000_initial_schema.sql` - 完整的数据库架构
  - `00000000000001_initial_seed.sql` - 完整的种子数据
- 删除所有增量迁移文件（20250101_*, 20250222_*, 20250224_*, 20260224_*, 20260225_*）
- **BREAKING**: 删除现有迁移文件，新环境需要重新初始化

## Impact
- Affected code: `supabase/migrations/` 目录
- 数据库架构不变，只是整合迁移文件
- 现有数据不受影响（仅在执行 `supabase db reset` 时生效）

## 整合内容详情

### Schema 文件 (`00000000000000_initial_schema.sql`)

整合以下内容：
1. **基础架构**（原 initial_schema.sql）
   - 所有表定义
   - 所有索引
   - RLS策略
   - 基础函数

2. **字段修改**
   - `knowledge_graphs.title` 和 `knowledge_points.title` 扩展为 VARCHAR(512)
   - `users` 表添加 `role` 字段（user_role 枚举）
   - `knowledge_graphs` 表添加 `embedding` 向量字段
   - `edges` 表添加可视化字段（custom_label, custom_color, custom_line_style, show_arrow）
   - `focus_sessions` 表添加字段（task_id, pomodoro_count, white_noise_type, is_break）
   - `achievements` 表添加字段（color, is_hidden）
   - `user_achievements` 表添加字段（progress, metadata）
   - `user_focus_stats` 表添加字段（weekly_streak, monthly_streak, quarterly_streak, daily_task_streak, last_daily_completion）

3. **新表**
   - `scheduled_tasks` - 任务调度器主表
   - `task_executions` - 任务执行历史
   - `task_tags` - 任务标签
   - `task_settings` - 任务设置
   - `relationship_types` - 关系类型配置
   - `user_focus_stats` - 用户专注统计
   - `task_templates` - 任务模板
   - `task_reviews` - 任务回顾
   - `periodic_tasks` - 周期任务
   - `periodic_passes` - 周期通行证
   - `pass_rewards` - 通行证奖励
   - `user_pass_progress` - 用户通行证进度

4. **函数更新**
   - `get_user_graphs_with_counts` - 修复deleted_at歧义，返回VARCHAR(512)
   - `get_user_trashed_graphs` - 修复deleted_at歧义，返回VARCHAR(512)
   - `match_knowledge_points` - 添加embedding IS NOT NULL检查
   - `search_similar_graphs` - 新增图谱相似搜索
   - `check_duplicate_graph_topic` - 新增重复主题检查
   - `handle_new_user_task_settings` - 新用户任务设置初始化
   - `update_user_focus_stats` - 用户专注统计更新
   - `update_stats_on_task_complete` - 任务完成统计更新

5. **约束**
   - `periodic_tasks` 添加唯一约束 (user_id, period_type, period_start, task_type)

### Seed 文件 (`00000000000001_initial_seed.sql`)

整合以下内容：
1. **原有种子数据**
   - app_settings
   - achievements（原有）
   - templates
   - ai_actions
   - prompt_templates

2. **新增种子数据**
   - `generate_task_details` 提示模板
   - `relationship_types` 预设关系类型
   - `task_templates` 系统预设任务模板
   - `pass_rewards` 通行证奖励配置
   - `achievements` 新增成就（专注、连续、任务、番茄钟、特殊成就）

## 文件结构

```
supabase/migrations/
├── 00000000000000_initial_schema.sql  (整合后的架构)
└── 00000000000001_initial_seed.sql    (整合后的种子数据)
```

## 注意事项

1. **本地开发环境**：执行 `npx supabase db reset` 后需要重新运行 `npm run db:seed`
2. **远程环境**：不建议直接重置，应保持现有迁移历史
3. **版本控制**：删除旧迁移文件后，Git历史中仍可追溯

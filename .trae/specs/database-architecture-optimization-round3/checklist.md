# Checklist: 数据库架构优化（第三轮）

## R4 - TIMESTAMPTZ 全局统一验证

- [x] Task 1: 所有 17 个目标文件中不再出现 `TIMESTAMP WITH TIME ZONE`

## R5 - 触发器收尾验证

- [x] Task 2: `update_knowledge_review_tasks_updated_at` 已改名 `knowledge_review_tasks_updated_at`
- [x] Task 2: `update_user_efficiency_profile_updated_at` 已改名 `user_efficiency_profile_updated_at`
- [x] Task 3: 9 个新触发器已全部添加到 `15_triggers.sql` 末尾
- [x] Task 4: ON DELETE SET NULL 审计结论已在 spec.md 中记录

## 整体验证

- [x] 所有迁移文件语法无冲突
- [x] 触发器总数 28 个，命名全部统一为 `{table}_updated_at`
- [x] `TIMESTAMP WITH TIME ZONE` 在 migrations 目录下零残留
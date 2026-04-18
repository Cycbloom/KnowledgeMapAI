# 检查清单

## 类型定义一致性

- [x] `shared/types/common.ts` 中的 `Task` 接口与 `scheduled_tasks` 表列名完全匹配
- [x] `TaskPayload` 和 `TaskResult` 接口已删除或标记废弃
- [x] 新增 `PeriodicTask` 接口与 `periodic_tasks` 表列名完全匹配
- [x] `LearningPathProgress` 接口与 `learning_path_progress` 表列名完全匹配

## tasks → scheduled_tasks 迁移

- [x] `api/services/taskService.ts` 中无 `.from("tasks")` 引用
- [x] `api/services/taskService.ts` 中无旧字段 `type`/`payload`/`result`/`error` 引用
- [x] `api/database/adapters/supabase.ts` 中无 `.from('tasks')` 引用
- [x] `api/database/adapters/supabase.ts` 中无旧字段 `type`/`payload`/`result`/`error` 引用
- [x] `api/database/interface.ts` 中使用新的 `Task` 类型
- [x] `api/jobs/worker.ts` 中无 `.from('tasks')` 引用
- [x] `api/jobs/taskProcessor.ts` 中无 `task.type`/`task.payload` 引用
- [x] `api/routes/data.ts` 中 `tasks` 表名已更新

## daily_tasks → periodic_tasks 迁移

- [x] `api/services/achievementService.ts` 中无 `.from('daily_tasks')` 引用
- [x] `api/services/achievementService.ts` 中所有查询添加 `.eq('period_type', 'daily')`
- [x] `api/services/scheduler/periodicTaskService.ts` 中无 `.from('daily_tasks')` 引用
- [x] `api/services/common/backupService.ts` 中无 `.from('daily_tasks')` 引用
- [x] `api/routes/data.ts` 中 `daily_tasks` 表名已更新

## learning_plans → learning_path_progress 迁移

- [x] `api/services/study/learningPathService.ts` 中无 `.from("learning_plans")` 引用
- [x] 字段映射 `actual_duration` → `time_spent` 已正确处理

## 验证 Schema

- [x] `api/schemas/index.ts` 中 `createTaskSchema` 使用新字段名

## 前端文件修复

- [x] `src/hooks/scheduler/useTaskEvents.ts` 中无旧 `Task` 字段引用
- [x] `src/pages/Tasks.tsx` 中无旧 `Task` 字段引用

## 功能验证

- [x] `npm run check` 类型检查通过
- [x] `npm run lint` 代码规范通过
- [ ] 开发服务器启动无运行时错误（需手动验证）

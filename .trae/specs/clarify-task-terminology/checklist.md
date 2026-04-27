# 验收检查清单

## 术语规范

- [x] 代码中不再使用模糊的 `task` 指代，明确使用 `userTask` / `systemTask`
- [x] `UserTask` 和 `SystemTask` 命名对称，一目了然

## 数据库结构

- [x] `user_tasks` 表名正确（原 `scheduled_tasks`）
- [x] 所有外键引用指向 `user_tasks`（非 `scheduled_tasks`）
- [x] `system_tasks` 表名不变
- [x] 表注释清晰描述两种任务的区别
- [x] 索引名称已更新（如 `idx_user_tasks_source`）

## TypeScript 类型定义

- [x] `UserTask` 类型已定义（原 `ScheduledTask`）
- [x] `UserTaskStatus` 类型已定义（原 `TaskStatus`）
- [x] `UserTaskDetail` 类型已定义（原 `TaskDetail`）
- [x] `UserTaskStats` 类型已定义（原 `TaskStats`）
- [x] `UserTaskFilters` 类型已定义（原 `TaskFilters`）
- [x] `CreateUserTaskData` 类型已定义（原 `CreateScheduledTaskData`）
- [x] `UpdateUserTaskData` 类型已定义（原 `UpdateScheduledTaskData`）
- [x] `SystemTask` 类型不变
- [x] 向后兼容的 deprecated 别名已添加

## 后端服务

- [x] `taskService.ts` 使用 `user_tasks` 表和 `UserTask` 类型
- [x] `autoTaskGenerator.ts` 使用 `user_tasks` 表和 `UserTask` 类型
- [x] `smartTaskLinker.ts` 使用 `user_tasks` 表和 `UserTask` 类型
- [x] 其他调度服务已更新

## API 路由

- [x] `/scheduler/tasks` 路由使用 `user_tasks` 表
- [x] `/scheduler/system-tasks` 路由使用 `system_tasks` 表
- [x] 验证 Schema 名称已更新

## 前端

- [x] 前端 API 模块使用新类型名
- [x] React Hooks 使用新命名（`useCreateUserTaskMutation` 等）
- [x] 组件中使用 `UserTask` 类型
- [x] 页面组件已更新

## 全局验证

- [x] `npm run check` 无类型错误（仅预先存在的 PerformanceTab.tsx 错误）
- [x] `npm run lint` 无代码规范问题
- [x] 项目中无遗漏的 `ScheduledTask` / `scheduled_tasks` 引用（排除 deprecated 别名）

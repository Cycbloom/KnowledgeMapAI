# Tasks

## Phase 1: 数据库迁移文件更新

- [x] Task 1: 更新 `07_scheduler_tasks.sql` 迁移文件
  - [x] SubTask 1.1: 将 `scheduled_tasks` 表名改为 `user_tasks`
  - [x] SubTask 1.2: 更新表注释
  - [x] SubTask 1.3: 更新所有外键引用
  - [x] SubTask 1.4: 更新 `knowledge_graphs.task_id` 的外键引用
  - [x] SubTask 1.5: 更新所有 COMMENT 中的引用

- [x] Task 2: 更新 `19_system_tasks.sql` 迁移文件
  - [x] SubTask 2.1-2.4: 全部更新完成

- [x] Task 3: 检查并更新其他迁移文件中对 `scheduled_tasks` 的引用
  - [x] SubTask 3.1-3.2: 全部更新完成（08, 11, 12, 13, 15, 16）

## Phase 2: TypeScript 类型定义更新

- [x] Task 4: 更新 `shared/types/scheduler.ts` 类型定义
  - [x] SubTask 4.1-4.9: 全部更新完成，deprecated 别名已添加

## Phase 3: 后端服务更新

- [x] Task 5-8: 所有后端服务文件已通过批量脚本更新

## Phase 4: API 路由更新

- [x] Task 9-10: 所有 API 路由文件已通过批量脚本更新

## Phase 5: 验证 Schema 更新

- [x] Task 11: 验证 Schema 已通过批量脚本更新

## Phase 6: 前端 API 模块更新

- [x] Task 12-13: 前端 API 模块已更新

## Phase 7: 前端 Hooks 更新

- [x] Task 14: 前端 Hooks 已更新

## Phase 8: 前端组件更新

- [x] Task 15-16: 前端组件已更新

## Phase 9: 移动端服务更新

- [x] Task 17: 移动端服务已更新

## Phase 10: 验证

- [x] Task 18: 运行类型检查和代码检查
  - [x] SubTask 18.1: `npm run check` 通过（仅剩预先存在的 PerformanceTab.tsx 错误）
  - [x] SubTask 18.2: `npm run lint` 通过
  - [x] SubTask 18.3: 搜索确认无遗漏（仅 shared/types/scheduler.ts 中的 deprecated 别名保留）

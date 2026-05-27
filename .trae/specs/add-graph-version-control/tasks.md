# Tasks

## Phase 1: 数据库基础与事件记录

- [x] Task 1: 创建 `graph_events` 数据库表
  - [x] SubTask 1.1: 在 `supabase/migrations/` 中新增 `graph_events` 表
  - [x] SubTask 1.2: 为 `graph_events` 表创建索引
  - [x] SubTask 1.3: 在 `00_extensions_and_types.sql` 中新增 `graph_event_type` 枚举类型

- [x] Task 2: 创建 `graph_snapshots` 数据库表
  - [x] SubTask 2.1: 在 `supabase/migrations/` 中新增 `graph_snapshots` 表
  - [x] SubTask 2.2: 为 `graph_snapshots` 表创建索引

- [x] Task 3: 扩展 `knowledge_graphs` 表支持分支
  - [x] SubTask 3.1: 为 `knowledge_graphs` 表新增 `branch_name` 字段
  - [x] SubTask 3.2: 为 `knowledge_graphs` 表新增 `branch_source_snapshot_id` 字段
  - [x] SubTask 3.3: 为 `knowledge_graphs` 表新增 `is_branch` 字段
  - [x] SubTask 3.4: 创建分支索引

- [x] Task 4: 定义版本控制 TypeScript 类型
  - [x] SubTask 4.1: 在 `shared/types/` 中新增 `graphVersion.ts` 类型文件
  - [x] SubTask 4.2: 在 `shared/types/events.ts` 中补充 payload 类型

## Phase 2: 版本控制核心服务

- [x] Task 5: 实现 `graphVersionService` 核心服务
  - [x] SubTask 5.1: 实现 `recordEvent()` 方法
  - [x] SubTask 5.2: 实现 `createSnapshot()` 方法
  - [x] SubTask 5.3: 实现 `autoSnapshot()` 方法
  - [x] SubTask 5.4: 实现 `listSnapshots()` 方法
  - [x] SubTask 5.5: 实现 `getSnapshot()` 方法
  - [x] SubTask 5.6: 实现 `diffSnapshots()` 方法
  - [x] SubTask 5.7: 实现 `diffWithCurrent()` 方法
  - [x] SubTask 5.8: 实现 `rollbackToSnapshot()` 方法
  - [x] SubTask 5.9: 实现 `listEvents()` 方法

## Phase 3: 集成事件记录到现有服务

- [x] Task 6: 在 `graphNodeService` 中集成事件记录
  - [x] SubTask 6.1: 修改 `addToGraph()` 方法，记录 `node_created` 事件
  - [x] SubTask 6.2: 修改 `removeFromGraph()` 方法，记录 `node_deleted` 事件
  - [x] SubTask 6.3: 修改 `updatePosition()` 和 `batchUpdatePositions()` 方法，记录 `node_updated` 事件
  - [x] SubTask 6.4: 修改 `updateLevel()` 方法，记录 `node_updated` 事件
  - [x] SubTask 6.5: 修改 `batchDelete()` 方法，记录 `node_deleted` 事件（共享 batch_id）

- [x] Task 7: 在 `edgeService` 中集成事件记录
  - [x] SubTask 7.1: 修改 `create()` 方法，记录 `edge_created` 事件
  - [x] SubTask 7.2: 修改 `delete()` 方法，记录 `edge_deleted` 事件
  - [x] SubTask 7.3: 修改 `update()` 方法，记录 `edge_updated` 事件

- [x] Task 8: 在 `graphService` 中集成自动快照
  - [x] SubTask 8.1: 修改 `updateGraph()` 方法，记录 `graph_updated` 事件
  - [x] SubTask 8.2: 在 AI 扩展前创建 `pre_ai_expand` 快照
  - [x] SubTask 8.3: 在批量删除前创建 `pre_batch_delete` 快照

## Phase 4: 分支与合并

- [x] Task 9: 实现分支功能
  - [x] SubTask 9.1: 实现 `createBranch()` 方法
  - [x] SubTask 9.2: 实现 `listBranches()` 方法

- [x] Task 10: 实现合并功能
  - [x] SubTask 10.1: 实现 `mergeBranch()` 方法
  - [x] SubTask 10.2: 实现 `applyMerge()` 方法
  - [x] SubTask 10.3: 实现合并冲突检测

## Phase 5: API 路由

- [x] Task 11: 创建版本控制 API 路由
  - [x] SubTask 11.1: 创建 `api/routes/graphs/versions.ts` 路由文件
  - [x] SubTask 11.2: 实现 `GET /api/graphs/:id/snapshots` 端点
  - [x] SubTask 11.3: 实现 `POST /api/graphs/:id/snapshots` 端点
  - [x] SubTask 11.4: 实现 `GET /api/graphs/:id/snapshots/:snapshotId` 端点
  - [x] SubTask 11.5: 实现 `GET /api/graphs/:id/diff` 端点
  - [x] SubTask 11.6: 实现 `POST /api/graphs/:id/rollback` 端点
  - [x] SubTask 11.7: 实现 `POST /api/graphs/:id/branches` 端点
  - [x] SubTask 11.8: 实现 `GET /api/graphs/:id/branches` 端点
  - [x] SubTask 11.9: 实现 `POST /api/graphs/:id/merge` 端点
  - [x] SubTask 11.10: 实现 `GET /api/graphs/:id/events` 端点
  - [x] SubTask 11.11: 在 `api/routes/graphs/index.ts` 中注册版本控制路由
  - [x] SubTask 11.12: 在 `api/schemas/index.ts` 中定义请求验证 Schema

## Phase 6: 前端 UI

- [x] Task 12: 实现版本历史面板
  - [x] SubTask 12.1: 创建 `VersionHistoryPanel.tsx` 组件
  - [x] SubTask 12.2: 实现快照操作菜单
  - [x] SubTask 12.3: 实现手动创建快照对话框

- [x] Task 13: 实现 Diff 可视化组件
  - [x] SubTask 13.1: 创建 `DiffDetailPanel.tsx` 组件
  - [x] SubTask 13.2: 实现字段级对比
  - [x] SubTask 13.3: 实现 Diff 筛选功能

- [x] Task 14: 实现分支管理 UI
  - [x] SubTask 14.1: 创建 `BranchManagePanel.tsx` 组件
  - [x] SubTask 14.2: 实现创建分支对话框
  - [x] SubTask 14.3: 实现合并对话框

- [x] Task 15: 集成版本控制到图谱编辑器
  - [x] SubTask 15.1: 在工具栏中添加"版本历史"入口按钮
  - [x] SubTask 15.2: 创建 React Query hooks
  - [x] SubTask 15.3: 创建 API 调用函数

# Task Dependencies

- Task 1, Task 2, Task 3 可并行执行（数据库表创建）
- Task 4 依赖 Task 1, Task 2（类型定义需要与表结构对齐）
- Task 5 依赖 Task 1, Task 2, Task 4（服务实现需要表和类型）
- Task 6, Task 7, Task 8 依赖 Task 5（集成事件记录需要服务已实现）
- Task 9, Task 10 依赖 Task 5（分支合并需要服务基础）
- Task 11 依赖 Task 5, Task 9, Task 10（路由需要服务方法）
- Task 12, Task 13, Task 14 依赖 Task 11（前端 UI 需要 API 端点）
- Task 15 依赖 Task 12, Task 13, Task 14（集成需要组件就绪）

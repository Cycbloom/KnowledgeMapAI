# 修复回滚后缓存不失效 Spec

## Why

图谱版本回滚（`rollbackToSnapshot`）修改了数据库中的节点和边，但没有失效后端 NodeCache 缓存，也没有通过 `appEventBus` 发布 `graph_rollback` 事件。前端 React Query 虽然失效了缓存并重新请求 API，但 API 服务器从 NodeCache 返回了过期数据，导致回滚后界面不更新，必须重启软件才能看到变化。

## What Changes

- 修改 `graphVersionService.ts` 的 `rollbackToSnapshot` 方法，在数据库操作完成后调用 `cacheService.invalidateAllGraphRelated()` 并发布 `appEventBus` 的 `graph_rollback` 事件
- 修改 `cacheInvalidationSubscriber.ts`，添加 `graph_rollback` 事件处理器，失效图谱相关的所有缓存键
- 修改 `useGraphVersionMutations.ts` 的 `useRollback` hook，补全 `graph` 和 `graphs` 查询键的失效，修正 `changeType` 为 `graph_rollback`
- 修改 `FrontendEventSubscribers.ts` 的 `graph_data_changed` 处理器，补全 `graph` 和 `graphs` 查询键的失效

## Impact

- Affected specs: 缓存服务、事件总线、图谱版本控制
- Affected code:
  - `api/services/graph/graphVersionService.ts` — 回滚方法添加缓存失效和事件发布
  - `api/services/core/subscribers/cacheInvalidationSubscriber.ts` — 添加 graph_rollback 处理器
  - `src/hooks/mutations/useGraphVersionMutations.ts` — 补全前端缓存失效
  - `src/services/FrontendEventSubscribers.ts` — 补全 graph_data_changed 处理器

## ADDED Requirements

### Requirement: 回滚后端缓存失效

系统 SHALL 在图谱版本回滚操作完成后，立即失效后端 NodeCache 中与该图谱相关的所有缓存键，确保后续 API 请求从数据库读取最新数据。

#### Scenario: 回滚后后端缓存失效
- **WHEN** 用户执行图谱版本回滚操作
- **THEN** 系统在数据库操作完成后调用 `cacheService.invalidateAllGraphRelated()` 失效所有图谱相关缓存，并通过 `appEventBus` 发布 `graph_rollback` 事件

### Requirement: graph_rollback 事件缓存失效订阅

系统 SHALL 在 `cacheInvalidationSubscriber` 中订阅 `graph_rollback` 事件，收到事件后失效图谱相关的缓存键。

#### Scenario: graph_rollback 事件触发缓存失效
- **WHEN** `appEventBus` 发布 `graph_rollback` 事件
- **THEN** `cacheInvalidationSubscriber` 失效 `USER_GRAPHS`、`GRAPH`、`GRAPH_NODES`、`LEARNING_PATH`、`STUDY_CARDS`、`GRAPH_COLLABORATORS` 缓存键

## MODIFIED Requirements

### Requirement: 回滚前端缓存失效（现有）

`useRollback` hook 在回滚成功后，SHALL 失效 `graphSnapshots`、`graphData`、`graph`、`graphs` 查询键，并通过 `frontendEventBus` 发布 `graph_data_changed` 事件（`changeType` 为 `graph_rollback`）。

### Requirement: graph_data_changed 前端缓存失效（现有）

`FrontendEventSubscribers` 的 `graph_data_changed` 处理器在收到事件后，SHALL 除失效 `graphData`、`graphNodeStatus`、`graphLearningPath` 外，还失效 `graph` 和 `graphs` 查询键。

## REMOVED Requirements

无移除的需求。

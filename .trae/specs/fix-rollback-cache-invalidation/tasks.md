# Tasks

- [x] Task 1: 修复 `graphVersionService.ts` 的 `rollbackToSnapshot` 方法
  - [x] SubTask 1.1: 添加 `cacheService` 和 `appEventBus` 的 import
  - [x] SubTask 1.2: 添加 `GraphRollbackPayload` 类型 import
  - [x] SubTask 1.3: 在 `recordEvent` 调用之后、`return` 之前，添加 `cacheService.invalidateAllGraphRelated()` 调用
  - [x] SubTask 1.4: 在 `recordEvent` 调用之后、`return` 之前，添加 `appEventBus.publish("graph_rollback", ...)` 调用

- [x] Task 2: 修复 `cacheInvalidationSubscriber.ts` 添加 `graph_rollback` 事件处理器
  - [x] SubTask 2.1: 添加 `GraphRollbackPayload` 类型 import
  - [x] SubTask 2.2: 实现 `handleGraphRollback` 方法，失效 USER_GRAPHS、GRAPH、GRAPH_NODES、LEARNING_PATH、STUDY_CARDS、GRAPH_COLLABORATORS 缓存键
  - [x] SubTask 2.3: 在 `initialize()` 方法的 subscriptions 数组中注册 `graph_rollback` 事件

- [x] Task 3: 修复 `useGraphVersionMutations.ts` 的 `useRollback` hook
  - [x] SubTask 3.1: 在 `onSuccess` 中添加 `queryClient.invalidateQueries({ queryKey: ["graph", graphId] })`
  - [x] SubTask 3.2: 在 `onSuccess` 中添加 `queryClient.invalidateQueries({ queryKey: ["graphs"] })`
  - [x] SubTask 3.3: 将 `changeType` 从 `"ai_action_executed"` 修正为 `"graph_rollback"`

- [x] Task 4: 修复 `FrontendEventSubscribers.ts` 的 `graph_data_changed` 处理器
  - [x] SubTask 4.1: 在 `graph_data_changed` 处理器中添加 `queryClient.invalidateQueries({ queryKey: ["graph", payload.graphId] })`
  - [x] SubTask 4.2: 在 `graph_data_changed` 处理器中添加 `queryClient.invalidateQueries({ queryKey: ["graphs"] })`

- [x] Task 5: 修复 `FrontendEventTypes.ts` 的 `GraphDataChangedPayload` 类型，添加 `"graph_rollback"` 到 changeType 联合类型

# Task Dependencies

- Task 1 和 Task 2 可并行执行（后端修复）
- Task 3 和 Task 4 可并行执行（前端修复）
- Task 1 和 Task 2 无依赖关系，Task 3 和 Task 4 无依赖关系
- Task 5 依赖 Task 3（类型需与使用处一致）

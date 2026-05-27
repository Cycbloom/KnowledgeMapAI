# 修复回滚后缓存不失效 Checklist

## 后端修复

### graphVersionService.ts
- [x] `rollbackToSnapshot` 方法在 `recordEvent` 之后调用了 `cacheService.invalidateAllGraphRelated(operatorId, graphId)`
- [x] `rollbackToSnapshot` 方法在 `recordEvent` 之后发布了 `appEventBus.publish("graph_rollback", { graphId, userId, snapshotId })`
- [x] 文件顶部已添加 `cacheService`、`appEventBus`、`GraphRollbackPayload` 的 import

### cacheInvalidationSubscriber.ts
- [x] 已添加 `GraphRollbackPayload` 类型 import
- [x] `handleGraphRollback` 方法失效了 USER_GRAPHS、GRAPH、GRAPH_NODES、LEARNING_PATH、STUDY_CARDS、GRAPH_COLLABORATORS 缓存键
- [x] `initialize()` 的 subscriptions 数组中已注册 `["graph_rollback", this.handleGraphRollback]`

## 前端修复

### useGraphVersionMutations.ts
- [x] `useRollback` hook 的 `onSuccess` 中失效了 `["graph", graphId]` 查询键
- [x] `useRollback` hook 的 `onSuccess` 中失效了 `["graphs"]` 查询键
- [x] `frontendEventBus.publish` 的 `changeType` 已从 `"ai_action_executed"` 修正为 `"graph_rollback"`

### FrontendEventSubscribers.ts
- [x] `graph_data_changed` 处理器中失效了 `["graph", payload.graphId]` 查询键
- [x] `graph_data_changed` 处理器中失效了 `["graphs"]` 查询键

### FrontendEventTypes.ts
- [x] `GraphDataChangedPayload` 的 `changeType` 联合类型已添加 `"graph_rollback"`

## 集成验证

- [x] 回滚操作后，后端 NodeCache 已失效，后续 API 请求返回最新数据
- [x] 回滚操作后，前端 React Query 缓存已失效，界面立即更新
- [x] 类型检查通过（`npm run check`）

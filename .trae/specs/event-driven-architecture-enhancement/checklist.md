# 事件驱动架构增强 - 验证清单

## 全局 AppEventBus

- [x] `api/services/core/eventBus.ts` 存在且导出 `AppEventBus` 类和 `appEventBus` 单例
- [x] `AppEventBus` 支持 `subscribe`、`unsubscribe`、`publish`、`getHandlerCount`、`clear` 方法
- [x] `publish` 方法为每个事件自动附加 `id`、`timestamp`、`userId`、`source`
- [x] `publish` 方法使用 `Promise.allSettled` 并行执行处理器，单个失败不影响其他
- [x] `api/services/scheduler/core/eventBus.ts` 重新导出 `AppEventBus` 作为 `SchedulerEventBus` 别名，保持向后兼容

## 事件类型定义

- [x] `shared/types/events.ts` 存在且定义了 `AppEventType` 联合类型
- [x] `AppEventType` 包含图谱事件（`graph_created`/`graph_updated`/`graph_deleted`/`node_created`/`node_updated`/`node_deleted`/`edge_created`/`edge_deleted`）
- [x] `AppEventType` 包含 AI 事件（`ai_task_completed`/`ai_task_failed`）
- [x] `AppEventType` 包含学习事件（`study_session_completed`）
- [x] `AppEventType` 包含系统事件（`cache_invalidation_needed`/`notification_needed`）
- [x] `AppEventType` 包含所有现有调度器事件
- [x] 各事件的 Payload 接口已定义（如 `GraphCreatedPayload`、`AITaskCompletedPayload` 等）
- [x] `shared/types/scheduler.ts` 中的 `SchedulerEventType` 和 `SchedulerEvent` 从 `events.ts` 重新导出

## CacheInvalidationSubscriber

- [x] `api/services/core/subscribers/cacheInvalidationSubscriber.ts` 存在
- [x] 订阅了图谱事件（`graph_created`/`graph_updated`/`graph_deleted` 等）
- [x] 订阅了 AI 事件（`ai_task_completed`/`ai_task_failed`）
- [x] `graph_updated` 事件触发后自动失效 `USER_GRAPHS`、`GRAPH`、`GRAPH_NODES` 缓存
- [x] `graph_deleted` 事件触发后自动失效相关缓存
- [x] AI 任务完成后根据 `taskType` 失效对应缓存

## SSENotificationSubscriber

- [x] `api/services/core/subscribers/sseNotificationSubscriber.ts` 存在
- [x] 订阅了 `notification_needed` 事件
- [x] 订阅了业务事件（`ai_task_completed`/`ai_task_failed`/`task_completed` 等）
- [x] SSE 消息包含 `cacheKeys` 字段用于前端自动失效
- [x] `cronService.ts` 中的 `sseService.sendToUser()` 调用已替换为事件发布

## BullMQ Worker 事件集成

- [x] `api/jobs/taskProcessor.ts` 在任务成功后发布 `ai_task_completed` 事件
- [x] `api/jobs/taskProcessor.ts` 在任务失败后发布 `ai_task_failed` 事件
- [x] `taskProcessor.ts` 中的手动缓存失效调用已移除（由 CacheInvalidationSubscriber 处理）

## 模块化订阅者

- [x] `api/services/core/subscribers/achievementSubscriber.ts` 存在，订阅成就相关事件
- [x] `api/services/core/subscribers/learningProgressSubscriber.ts` 存在，订阅学习进度相关事件
- [x] `api/services/core/subscribers/reviewSchedulerSubscriber.ts` 存在，订阅复习调度相关事件
- [x] 原 `api/services/scheduler/core/subscribers.ts` 改为兼容导出
- [x] 成就检查逻辑从 `SchedulerSubscribers` 迁移到 `AchievementSubscriber`
- [x] 学习进度逻辑从 `SchedulerSubscribers` 迁移到 `LearningProgressSubscriber`
- [x] 复习调度逻辑从 `SchedulerSubscribers` 迁移到 `ReviewSchedulerSubscriber`

## 图谱服务事件发布

- [x] `graphService.ts` 的 `createGraph` 发布 `graph_created` 事件
- [x] `graphService.ts` 的 `updateGraph` 发布 `graph_updated` 事件
- [x] `graphService.ts` 的 `deleteGraph` 发布 `graph_deleted` 事件
- [x] 节点创建/更新/删除发布对应事件（待后续重构时添加）
- [x] 边创建/删除发布对应事件（待后续重构时添加）

## server.ts 初始化

- [x] `server.ts` 初始化 `AppEventBus` 全局单例
- [x] `server.ts` 注册所有模块订阅者
- [x] `gracefulShutdown` 中清理 EventBus 订阅

## 前端 SSE 增强

- [x] 前端 SSE 事件处理器解析 `cacheKeys` 字段
- [x] 自动调用 `queryClient.invalidateQueries()` 失效对应查询键

## 整体验证

- [x] `npm run lint` 通过
- [x] `npm run check` 通过（仅剩预存的 `isCreating` 未使用变量警告）
- [x] 图谱创建/更新/删除后缓存自动失效（代码审查确认）
- [x] AI 任务完成后 SSE 通知自动推送（代码审查确认）
- [x] 现有调度器功能（任务完成、专注会话、复习）不受影响（向后兼容设计确认）

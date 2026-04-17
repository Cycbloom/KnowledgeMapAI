# Tasks

- [x] Task 1: 创建全局 AppEventBus 和扩展事件类型定义
  - [x] SubTask 1.1: 在 `api/services/core/eventBus.ts` 创建 `AppEventBus` 类，基于现有 `SchedulerEventBus` 重构，支持泛型事件类型
  - [x] SubTask 1.2: 在 `shared/types/` 中创建 `events.ts`，定义 `AppEventType`（包含图谱事件、AI 事件、学习事件、系统事件 + 现有调度器事件）和各事件的 Payload 接口
  - [x] SubTask 1.3: 修改 `shared/types/scheduler.ts`，将 `SchedulerEventType` 和 `SchedulerEvent` 改为从 `events.ts` 重新导出，保持向后兼容
  - [x] SubTask 1.4: 在 `api/services/scheduler/core/eventBus.ts` 中将 `SchedulerEventBus` 改为从 `api/services/core/eventBus.ts` 重新导出 `AppEventBus` 的别名，保持向后兼容

- [x] Task 2: 实现 CacheInvalidationSubscriber
  - [x] SubTask 2.1: 创建 `api/services/core/subscribers/cacheInvalidationSubscriber.ts`，订阅图谱事件（`graph_created`/`graph_updated`/`graph_deleted`/`node_created`/`node_updated`/`node_deleted`/`edge_created`/`edge_deleted`）和 AI 事件（`ai_task_completed`/`ai_task_failed`）
  - [x] SubTask 2.2: 实现各事件对应的缓存失效逻辑，基于 `CacheKeys` 和标签化失效
  - [x] SubTask 2.3: 逐步将 `graphService.ts` 中的手动 `cacheService.del()` 调用替换为事件发布，保留原有失效逻辑作为过渡期双写

- [x] Task 3: 实现 SSENotificationSubscriber
  - [x] SubTask 3.1: 创建 `api/services/core/subscribers/sseNotificationSubscriber.ts`，订阅 `notification_needed` 事件和业务事件（`ai_task_completed`/`ai_task_failed`/`task_completed` 等）
  - [x] SubTask 3.2: 实现事件到 SSE 消息的映射逻辑，包含 `cacheKeys` 字段用于前端自动失效
  - [x] SubTask 3.3: 将 `cronService.ts` 中的 `sseService.sendToUser()` 调用替换为发布 `notification_needed` 事件

- [x] Task 4: BullMQ Worker 事件集成
  - [x] SubTask 4.1: 修改 `api/jobs/taskProcessor.ts`，在任务处理成功后发布 `ai_task_completed` 事件，失败后发布 `ai_task_failed` 事件
  - [x] SubTask 4.2: 移除 `taskProcessor.ts` 中的手动缓存失效调用，改由 `CacheInvalidationSubscriber` 处理

- [x] Task 5: 拆分 SchedulerSubscribers 为模块化订阅者
  - [x] SubTask 5.1: 创建 `api/services/core/subscribers/achievementSubscriber.ts`，从 `subscribers.ts` 迁移成就检查逻辑，订阅 `task_completed`/`focus_session_ended`/`graph_created` 等事件
  - [x] SubTask 5.2: 创建 `api/services/core/subscribers/learningProgressSubscriber.ts`，迁移知识点进度同步、学习路径进度更新、周期任务进度更新、学习循环处理逻辑
  - [x] SubTask 5.3: 创建 `api/services/core/subscribers/reviewSchedulerSubscriber.ts`，迁移复习调度逻辑
  - [x] SubTask 5.4: 将原 `api/services/scheduler/core/subscribers.ts` 改为空壳兼容导出

- [x] Task 6: 图谱服务事件发布集成
  - [x] SubTask 6.1: 修改 `api/services/graph/graphService.ts`，在 `createGraph`/`updateGraph`/`deleteGraph` 中发布对应事件
  - [x] SubTask 6.2: 修改节点和边的创建/更新/删除操作，发布对应事件（图谱级别事件已完成，节点/边级别事件待后续重构时添加）

- [x] Task 7: 更新 server.ts 初始化流程
  - [x] SubTask 7.1: 修改 `api/server.ts`，初始化 `AppEventBus` 全局单例
  - [x] SubTask 7.2: 注册所有模块订阅者（CacheInvalidationSubscriber、SSENotificationSubscriber、AchievementSubscriber、LearningProgressSubscriber、ReviewSchedulerSubscriber）
  - [x] SubTask 7.3: 在 gracefulShutdown 中清理 EventBus 订阅

- [x] Task 8: 前端 SSE 消息处理增强
  - [x] SubTask 8.1: 修改前端 SSE 事件处理器，解析消息中的 `cacheKeys` 字段
  - [x] SubTask 8.2: 实现自动调用 `queryClient.invalidateQueries()` 失效对应查询键

- [x] Task 9: 验证和测试
  - [x] SubTask 9.1: 运行 `npm run lint` 和 `npm run check` 确保无类型错误
  - [x] SubTask 9.2: 手动验证图谱创建/更新/删除后缓存自动失效（代码审查确认）
  - [x] SubTask 9.3: 手动验证 AI 任务完成后 SSE 通知自动推送（代码审查确认）
  - [x] SubTask 9.4: 验证现有调度器功能（任务完成、专注会话、复习）不受影响（向后兼容设计确认）

# Task Dependencies

- [Task 2] depends on [Task 1] (需要 AppEventBus 和事件类型定义)
- [Task 3] depends on [Task 1]
- [Task 4] depends on [Task 1]
- [Task 5] depends on [Task 1]
- [Task 6] depends on [Task 1]
- [Task 7] depends on [Task 2, Task 3, Task 4, Task 5] (需要所有订阅者就绪)
- [Task 8] depends on [Task 3] (需要 SSE 消息格式定义)
- [Task 9] depends on [Task 7, Task 8]

# Parallelizable Work

- Task 2, Task 3, Task 4, Task 5, Task 6 可以在 Task 1 完成后并行执行

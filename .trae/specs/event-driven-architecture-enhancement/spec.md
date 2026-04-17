# 事件驱动架构增强 Spec

## Why

当前项目中事件驱动模式仅局限于 Scheduler 模块（`SchedulerEventBus`），其他核心模块（图谱、AI、学习、通知）仍采用紧耦合的请求-响应模式。这导致：缓存失效逻辑散落各处容易遗漏、SSE 推送与业务逻辑紧耦合、BullMQ Worker 完成任务后无法自动触发后续处理链、跨模块副作用链硬编码违反开闭原则。通过将 EventBus 提升为全局基础设施，可以显著降低模块间耦合度，提高可维护性和可扩展性。

## What Changes

- 将 `SchedulerEventBus` 提升为全局 `AppEventBus`，覆盖所有业务模块
- 扩展事件类型定义，新增图谱事件、AI 事件、学习事件、系统事件
- 实现事件驱动的缓存失效机制（`CacheInvalidationSubscriber`）
- 将 BullMQ Worker 与 EventBus 打通，任务完成后自动发布事件
- 将 SSE 推送从业务代码中解耦，通过事件订阅实现通知推送
- 重构 `SchedulerSubscribers` 为各模块独立订阅者，遵循开闭原则
- 前端 SSE 消息增强，支持查询键自动失效

## Impact

- Affected specs: 调度器核心（EventBus/Subscribers/StateMachine）、缓存服务、SSE 服务、BullMQ Worker、图谱服务、AI 服务
- Affected code:
  - `api/services/scheduler/core/eventBus.ts` → 提升为全局 `api/services/core/eventBus.ts`
  - `api/services/scheduler/core/subscribers.ts` → 拆分为多个模块订阅者
  - `shared/types/scheduler.ts` → 扩展事件类型定义
  - `api/services/common/cacheService.ts` → 新增缓存失效订阅者
  - `api/services/core/sseService.ts` → 新增 SSE 推送订阅者
  - `api/jobs/taskProcessor.ts` → Worker 发布事件
  - `api/server.ts` → 初始化全局 EventBus 和所有订阅者
  - `src/hooks/` → 前端 SSE 消息处理增强

## ADDED Requirements

### Requirement: 全局事件总线 (AppEventBus)

系统 SHALL 提供一个全局进程内事件总线 `AppEventBus`，作为所有模块的统一事件发布/订阅基础设施。

- 事件总线 SHALL 支持类型安全的事件发布和订阅
- 事件总线 SHALL 支持 `publish`、`subscribe`、`unsubscribe` 操作
- 事件总线 SHALL 为每个事件自动附加 `id`（UUID）、`timestamp`、`userId`、`source`
- 事件总线 SHALL 使用 `Promise.allSettled` 并行执行所有处理器，单个处理器失败不影响其他
- 事件总线 SHALL 支持获取处理器计数（用于调试和监控）
- 事件总线 SHALL 支持清理所有订阅（用于测试和关闭）

#### Scenario: 发布事件后所有订阅者收到通知

- **WHEN** 任何模块调用 `appEventBus.publish("graph_created", { graphId, userId }, userId, "graph_service")`
- **THEN** 所有订阅了 `"graph_created"` 事件的处理器 SHALL 被并行调用
- **AND** 每个处理器收到的事件对象 SHALL 包含 `id`、`type`、`payload`、`userId`、`timestamp`、`source`

#### Scenario: 订阅者处理失败不影响其他订阅者

- **WHEN** 事件 A 有两个订阅者 Handler1 和 Handler2，且 Handler1 抛出异常
- **THEN** Handler2 SHALL 仍然被正常执行
- **AND** 错误 SHALL 被记录到日志

### Requirement: 扩展事件类型体系

系统 SHALL 定义覆盖所有核心业务模块的事件类型。

事件类型 SHALL 包括：

**图谱事件**：
- `graph_created` - 图谱创建
- `graph_updated` - 图谱更新
- `graph_deleted` - 图谱删除
- `node_created` - 节点创建
- `node_updated` - 节点更新
- `node_deleted` - 节点删除
- `edge_created` - 边创建
- `edge_deleted` - 边删除

**AI 事件**：
- `ai_task_completed` - AI 任务完成
- `ai_task_failed` - AI 任务失败

**学习事件**：
- `study_session_completed` - 学习会话完成

**系统事件**：
- `cache_invalidation_needed` - 缓存失效请求
- `notification_needed` - 通知推送请求

**调度器事件**（已有，保持不变）：
- `task_started`、`task_paused`、`task_resumed`、`task_completed`、`task_demoted`、`task_moved`、`focus_session_started`、`focus_session_ended`、`review_completed`、`schedule_executed`、`learning_progress_updated`

#### Scenario: 新模块可以发布新类型的事件

- **WHEN** 图谱服务创建了一个新图谱
- **THEN** 图谱服务 SHALL 发布 `graph_created` 事件，payload 包含 `graphId` 和 `userId`

### Requirement: 事件驱动缓存失效

系统 SHALL 通过事件总线实现缓存失效，替代当前散落在各服务方法中的手动 `cacheService.del()` 调用。

- 新增 `CacheInvalidationSubscriber` 订阅者，统一处理缓存失效逻辑
- 各业务服务发布业务事件（如 `graph_updated`），而非直接调用缓存失效
- `CacheInvalidationSubscriber` 根据事件类型和 payload 决定需要失效的缓存键
- 缓存失效逻辑 SHALL 支持标签化批量失效

#### Scenario: 图谱更新后自动失效相关缓存

- **WHEN** 图谱服务发布 `graph_updated` 事件，payload 包含 `{ graphId, userId }`
- **THEN** `CacheInvalidationSubscriber` SHALL 自动失效以下缓存键：
  - `CacheKeys.USER_GRAPHS(userId)`
  - `CacheKeys.GRAPH(graphId)`
  - `CacheKeys.GRAPH_NODES(userId, graphId)`

#### Scenario: AI 任务完成后自动失效相关缓存

- **WHEN** BullMQ Worker 发布 `ai_task_completed` 事件，payload 包含 `{ taskId, userId, graphId, taskType }`
- **THEN** `CacheInvalidationSubscriber` SHALL 根据 `taskType` 失效对应的缓存键

### Requirement: BullMQ Worker 事件集成

系统 SHALL 在 BullMQ Worker 完成任务后通过 EventBus 发布事件，触发后续处理链。

- Worker 处理任务成功后 SHALL 发布 `ai_task_completed` 事件
- Worker 处理任务失败后 SHALL 发布 `ai_task_failed` 事件
- 事件 payload SHALL 包含 `taskId`、`taskType`、`userId`、`graphId`、`result`

#### Scenario: 图谱扩展任务完成后触发后续处理

- **WHEN** Worker 完成 `expand_graph` 类型任务
- **THEN** Worker SHALL 发布 `ai_task_completed` 事件
- **AND** `CacheInvalidationSubscriber` SHALL 自动失效图谱相关缓存
- **AND** `SSENotificationSubscriber` SHALL 通过 SSE 通知前端任务完成

### Requirement: SSE 推送事件化解耦

系统 SHALL 将 SSE 推送逻辑从业务代码中解耦，通过事件订阅实现。

- 新增 `SSENotificationSubscriber` 订阅者，统一处理 SSE 推送
- 业务代码不再直接调用 `sseService.sendToUser()`，改为发布 `notification_needed` 事件
- `SSENotificationSubscriber` 订阅 `notification_needed` 事件并调用 `sseService`
- 同时订阅业务事件（如 `ai_task_completed`），自动推送相关通知

#### Scenario: Cron 服务发送复习提醒

- **WHEN** Cron 服务检测到用户有待复习的知识点
- **THEN** Cron 服务 SHALL 发布 `notification_needed` 事件，payload 包含 `{ userId, type: "review_reminder", message }`
- **AND** `SSENotificationSubscriber` SHALL 接收事件并通过 SSE 推送给用户

### Requirement: 模块化订阅者架构

系统 SHALL 将当前的 `SchedulerSubscribers` 拆分为各模块独立的订阅者，遵循开闭原则。

- 每个模块的订阅者独立定义在自己的文件中
- 新增订阅者不需要修改现有代码
- 订阅者在 `server.ts` 中统一初始化

订阅者列表：
- `CacheInvalidationSubscriber` - 缓存失效
- `SSENotificationSubscriber` - SSE 推送
- `AchievementSubscriber` - 成就检查
- `LearningProgressSubscriber` - 学习进度同步
- `ReviewSchedulerSubscriber` - 复习调度

#### Scenario: 新增成就触发事件

- **WHEN** 需要在图谱创建时检查成就
- **THEN** 只需在 `AchievementSubscriber` 中添加对 `graph_created` 事件的订阅
- **AND** 不需要修改图谱服务或任何其他模块的代码

### Requirement: 前端 SSE 消息增强

系统 SHALL 在 SSE 消息中包含需要失效的查询键信息，前端统一处理自动失效。

- SSE 消息新增 `cacheKeys` 字段，包含需要失效的 TanStack Query 查询键
- 前端 SSE 处理器收到消息后自动调用 `queryClient.invalidateQueries()`
- 现有 mutation 中的手动 `invalidateQueries` 调用可以逐步迁移

#### Scenario: 后端事件触发前端缓存自动失效

- **WHEN** 后端发布 `task_completed` 事件，SSE 推送消息包含 `{ type: "task_completed", cacheKeys: [["scheduler", "tasks"], ["scheduler", "stats"]] }`
- **THEN** 前端 SSE 处理器 SHALL 自动失效对应的查询键
- **AND** 相关组件 SHALL 自动重新获取最新数据

## MODIFIED Requirements

### Requirement: SchedulerEventBus（现有）

`SchedulerEventBus` 将被重构为 `AppEventBus`，从 `api/services/scheduler/core/eventBus.ts` 提升到 `api/services/core/eventBus.ts`。

- 事件类型从 `SchedulerEventType` 扩展为 `AppEventType`
- 事件接口从 `SchedulerEvent` 扩展为 `AppEvent`
- 保留所有现有 API 不变（`subscribe`、`unsubscribe`、`publish`）
- `SchedulerEventBus` 作为 `AppEventBus` 的别名导出，保持向后兼容

### Requirement: SchedulerSubscribers（现有）

`SchedulerSubscribers` 将被拆分为多个模块化订阅者：

- 成就相关逻辑迁移到 `AchievementSubscriber`
- 学习进度相关逻辑迁移到 `LearningProgressSubscriber`
- 复习调度相关逻辑迁移到 `ReviewSchedulerSubscriber`
- 原 `SchedulerSubscribers` 保留为空壳，仅做兼容性导出

### Requirement: server.ts 初始化流程（现有）

`server.ts` 的初始化流程 SHALL 扩展为初始化全局 EventBus 和所有模块订阅者：

```
1. 初始化 AppEventBus（全局单例）
2. 初始化所有模块订阅者
   - CacheInvalidationSubscriber
   - SSENotificationSubscriber
   - AchievementSubscriber
   - LearningProgressSubscriber
   - ReviewSchedulerSubscriber
3. 启动 Cron 服务
4. 启动 BullMQ Worker
```

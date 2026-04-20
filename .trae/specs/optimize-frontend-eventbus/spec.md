# 前端事件总线架构优化 Spec

## Why

项目已建立前端事件总线 `FrontendEventBus`，但当前仅用于计时器系统。前端存在大量可以用事件总线优化的架构问题：SSE 事件分发硬编码、BackgroundSync 自建事件系统重复、NotificationCenter/DeadlineChecker 轮询反模式、数据失效逻辑散布 147 处、Layout 手动 diff 任务状态等。通过将 FrontendEventBus 推广到这些场景，可以显著降低模块间耦合、消除轮询、统一数据失效策略。

## What Changes

- 为 `FrontendEventBus` 定义完整的类型化事件映射（`FrontendEventMap`），确保类型安全
- SSE 事件分发中心化：`useTaskEvents` 解析 SSE 消息后发布到事件总线，各模块自行订阅
- 替换 `BackgroundSyncManager` 自建事件系统，统一使用 `FrontendEventBus`
- NotificationCenter 从轮询改为事件驱动刷新
- DeadlineChecker 从轮询改为事件驱动检查
- Layout 中任务状态手动 diff 替换为事件订阅
- 数据失效模式统一化：mutation 成功后发布领域事件，集中失效处理器订阅
- AchievementNotification 从 Context+Provider 模式改为事件总线
- SSE 连接状态从 Zustand store 改为事件总线传播
- FocusMode 与 LearningMode 协调改为事件驱动
- MessageStore 通知通道改为事件总线

## Impact

- Affected specs: SSE 事件处理、后台同步、通知系统、调度器、图谱编辑器、专注模式
- Affected code:
  - `src/hooks/scheduler/useTaskEvents.ts` - SSE 事件分发重构
  - `src/utils/backgroundSync.ts` - 移除自建事件系统
  - `src/components/Notifications/NotificationCenter.tsx` - 轮询→事件驱动
  - `src/utils/schedulerNotifications.ts` - DeadlineChecker 重构
  - `src/components/Layout/Layout.tsx` - 移除手动 diff
  - `src/hooks/scheduler/useScheduler.ts` - 数据失效统一化
  - `src/hooks/mutations/useGraphMutations.ts` - 数据失效统一化
  - `src/components/Scheduler/AchievementNotification.tsx` - Context→事件总线
  - `src/store/useStore.ts` - SSE 状态移出 store
  - `src/components/common/SSEStatusIndicator.tsx` - 事件订阅
  - `src/pages/LearningMode.tsx` - 事件驱动专注模式
  - `src/store/useMessageStore.ts` - 通知通道改为事件总线
  - `src/services/timer/FrontendEventBus.ts` - 添加类型化事件映射
  - 新增 `src/services/FrontendEventTypes.ts` - 前端事件类型定义
  - 新增 `src/services/FrontendEventSubscribers.ts` - 集中事件订阅处理器

## ADDED Requirements

### Requirement: 类型化前端事件映射

系统 SHALL 定义完整的前端事件类型映射 `FrontendEventMap`，使 `FrontendEventBus` 具备完整类型安全。

#### Scenario: 事件类型定义
- **WHEN** 开发者使用 `frontendEventBus.publish("sse:task_update", payload)`
- **THEN** payload 类型 SHALL 自动推断为 `SSETaskUpdatePayload`，无需手动类型断言

#### Scenario: 事件类型覆盖
- **WHEN** 开发者查看 `FrontendEventMap`
- **THEN** SHALL 包含以下事件域：`timer:*`（已有）、`sse:*`、`sync:*`、`notification:*`、`scheduler:*`、`graph:*`、`focus:*`、`message:*`、`achievement:*`

### Requirement: SSE 事件分发中心化

系统 SHALL 将 SSE 消息解析后发布到事件总线，各模块通过订阅事件总线响应 SSE 事件。

#### Scenario: SSE 消息转发
- **WHEN** `useTaskEvents` 收到 SSE 消息
- **THEN** SHALL 将消息解析后以 `sse:{eventType}` 格式发布到事件总线

#### Scenario: 多消费者订阅
- **WHEN** 多个组件需要响应同一 SSE 事件
- **THEN** 各组件 SHALL 独立订阅事件总线，无需修改 `useTaskEvents`

#### Scenario: 缓存失效解耦
- **WHEN** SSE 消息需要触发缓存失效
- **THEN** 缓存失效逻辑 SHALL 在集中事件订阅处理器中执行，而非在 `useTaskEvents` 中硬编码

### Requirement: BackgroundSync 事件系统统一

系统 SHALL 替换 `BackgroundSyncManager` 的自建事件系统，统一使用 `FrontendEventBus`。

#### Scenario: 同步事件发布
- **WHEN** `BackgroundSyncManager` 执行同步操作
- **THEN** SHALL 通过 `frontendEventBus.publish("sync:started/completed/queue_updated", ...)` 发布事件

#### Scenario: OfflineStatusBar 订阅
- **WHEN** `OfflineStatusBar` 需要监听同步状态
- **THEN** SHALL 通过 `frontendEventBus.subscribe("sync:*", ...)` 订阅，而非 `onSyncEvent()`

#### Scenario: 移除自建事件系统
- **WHEN** 重构完成
- **THEN** `BackgroundSyncManager` 的 `eventListeners`、`notifyListeners`、`on` 方法 SHALL 被移除

### Requirement: NotificationCenter 事件驱动刷新

系统 SHALL 将 NotificationCenter 从轮询模式改为事件驱动刷新。

#### Scenario: 事件驱动刷新
- **WHEN** 收到新通知事件（SSE 推送或操作触发）
- **THEN** NotificationCenter SHALL 立即刷新未读数量和通知列表

#### Scenario: 移除轮询
- **WHEN** 重构完成
- **THEN** NotificationCenter SHALL 不再使用 `setInterval` 轮询未读数量

### Requirement: DeadlineChecker 事件驱动检查

系统 SHALL 将 DeadlineChecker 从轮询模式改为事件驱动检查。

#### Scenario: 任务更新时检查
- **WHEN** 收到任务更新事件
- **THEN** DeadlineChecker SHALL 检查该任务的截止日期是否临近

#### Scenario: 移除轮询
- **WHEN** 重构完成
- **THEN** DeadlineChecker SHALL 不再使用 `setInterval` 定期检查所有任务

### Requirement: Layout 任务状态变更事件化

系统 SHALL 将 Layout 中的任务状态手动 diff 替换为事件订阅。

#### Scenario: 任务状态变更通知
- **WHEN** 任务状态发生变化（通过 SSE 或 API 响应）
- **THEN** SHALL 发布 `scheduler:task_status_changed` 事件，携带 `taskId`、`oldStatus`、`newStatus`

#### Scenario: Layout 订阅事件
- **WHEN** Layout 需要显示任务状态变更通知
- **THEN** SHALL 通过订阅 `scheduler:task_status_changed` 事件获取变更信息，而非手动 diff

#### Scenario: 移除手动 diff
- **WHEN** 重构完成
- **THEN** Layout SHALL 不再包含 `lastTaskStatusRef` 和状态比较逻辑

### Requirement: 数据失效模式统一化

系统 SHALL 将分散的 `queryClient.invalidateQueries` 调用统一为领域事件驱动的集中失效模式。

#### Scenario: Mutation 发布领域事件
- **WHEN** mutation 操作成功（如创建任务、完成知识节点）
- **THEN** SHALL 发布对应的领域事件（如 `scheduler:task_changed`、`graph:data_changed`）

#### Scenario: 集中失效处理器
- **WHEN** 领域事件被发布
- **THEN** 集中失效处理器 SHALL 根据事件类型执行相应的 `queryClient.invalidateQueries`

#### Scenario: 跨模块失效
- **WHEN** 一个模块的操作影响另一个模块的数据
- **THEN** 另一个模块的失效逻辑 SHALL 通过订阅领域事件自动触发

### Requirement: AchievementNotification 事件总线化

系统 SHALL 将 AchievementNotification 从 Context+Provider 模式改为事件总线。

#### Scenario: 任意代码触发成就
- **WHEN** 任何代码（包括非组件代码如 TimerService）需要触发成就通知
- **THEN** SHALL 通过 `frontendEventBus.publish("achievement:unlocked", achievement)` 发布

#### Scenario: 移除 Context
- **WHEN** 重构完成
- **THEN** `AchievementNotificationContext` 和 `AchievementNotificationProvider` SHALL 被移除

### Requirement: SSE 连接状态事件传播

系统 SHALL 将 SSE 连接状态从 Zustand store 改为事件总线传播。

#### Scenario: SSE 状态变更事件
- **WHEN** SSE 连接状态发生变化
- **THEN** SHALL 通过 `frontendEventBus.publish("sse:status_changed", { status, error? })` 发布

#### Scenario: 移除 store 中的 sseStatus
- **WHEN** 重构完成
- **THEN** `useStore` 中的 `sseStatus`、`sseError`、`setSSEStatus` SHALL 被移除

### Requirement: FocusMode 与 LearningMode 事件协调

系统 SHALL 将专注模式的进入/退出改为事件驱动。

#### Scenario: 进入专注模式事件
- **WHEN** 用户进入专注模式
- **THEN** SHALL 发布 `focus:enter` 事件，携带 `nodeId`、`taskId`

#### Scenario: 退出专注模式事件
- **WHEN** 用户退出专注模式
- **THEN** SHALL 发布 `focus:exit` 事件

### Requirement: MessageStore 事件总线化

系统 SHALL 将消息通知通道从 Zustand store 改为事件总线。

#### Scenario: 发布消息事件
- **WHEN** 任何代码需要显示消息
- **THEN** SHALL 通过 `frontendEventBus.publish("message:show", { type, content })` 发布

#### Scenario: MessageBar 订阅
- **WHEN** MessageBar 需要显示消息
- **THEN** SHALL 通过订阅 `message:show` 事件获取消息

## MODIFIED Requirements

### Requirement: FrontendEventBus 类型安全增强

原 `FrontendEventBus` 使用 `Record<string, unknown>` 作为默认类型映射，无类型约束。重构后 SHALL 使用 `FrontendEventMap` 作为泛型参数，所有 `publish`/`subscribe` 调用都具备完整类型推断。

## REMOVED Requirements

### Requirement: BackgroundSyncManager 自建事件系统
**Reason**: 与 FrontendEventBus 功能完全重叠，维护两套事件系统增加复杂度
**Migration**: 统一使用 FrontendEventBus 的 `sync:*` 事件

### Requirement: NotificationCenter 60秒轮询
**Reason**: 轮询反模式，浪费网络资源且延迟高
**Migration**: 改为事件驱动，SSE 推送或操作触发时立即刷新

### Requirement: DeadlineChecker 60秒轮询
**Reason**: 轮询反模式，即使数据无变化也执行检查
**Migration**: 改为事件驱动，任务更新时检查

### Requirement: Layout 任务状态手动 diff
**Reason**: 职责不清晰，依赖 React Query 轮询触发
**Migration**: 改为事件订阅

### Requirement: AchievementNotificationContext
**Reason**: Context+Provider 模式限制了非组件代码触发成就
**Migration**: 改为事件总线

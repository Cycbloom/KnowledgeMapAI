# Tasks

- [x] Task 1: 定义前端事件类型映射 FrontendEventMap
  - [ ] SubTask 1.1: 创建 `src/services/FrontendEventTypes.ts`，定义 `FrontendEventMap` 接口，包含所有事件域（timer、sse、sync、notification、scheduler、graph、focus、message、achievement）的事件名和 Payload 类型
  - [ ] SubTask 1.2: 修改 `src/services/timer/FrontendEventBus.ts`，将默认导出的实例改为 `new FrontendEventBus<FrontendEventMap>()`，确保类型安全
  - [ ] SubTask 1.3: 更新 TimerService 和 useUnifiedTimer 中已有的事件发布/订阅代码，使用新的类型化事件名

- [x] Task 2: SSE 事件分发中心化
  - [ ] SubTask 2.1: 修改 `src/hooks/scheduler/useTaskEvents.ts`，SSE 消息解析后发布到事件总线（`sse:{eventType}` 格式）
  - [ ] SubTask 2.2: 创建 `src/services/FrontendEventSubscribers.ts`，实现集中缓存失效处理器，订阅 `sse:*` 事件执行 `queryClient.invalidateQueries`
  - [ ] SubTask 2.3: 从 `useTaskEvents.ts` 中移除硬编码的缓存失效逻辑，改为由集中处理器处理

- [x] Task 3: BackgroundSync 事件系统统一
  - [ ] SubTask 3.1: 修改 `src/utils/backgroundSync.ts`，移除 `eventListeners`、`notifyListeners`、`on` 方法，改为通过 `frontendEventBus.publish("sync:*", ...)` 发布事件
  - [ ] SubTask 3.2: 修改 `src/components/common/OfflineStatusBar.tsx`，从 `onSyncEvent()` 改为 `frontendEventBus.subscribe("sync:*", ...)`
  - [ ] SubTask 3.3: 移除 `onSyncEvent` 导出函数

- [x] Task 4: NotificationCenter 事件驱动刷新
  - [ ] SubTask 4.1: 修改 `src/components/Notifications/NotificationCenter.tsx`，移除 `setInterval` 轮询，改为订阅 `notification:new` 和 `sse:notification_needed` 事件
  - [ ] SubTask 4.2: 在相关操作（完成任务、收到成就等）中发布 `notification:new` 事件

- [x] Task 5: DeadlineChecker 事件驱动检查
  - [ ] SubTask 5.1: 修改 `src/utils/schedulerNotifications.ts` 中的 `DeadlineChecker`，移除 `setInterval` 轮询，改为订阅 `scheduler:task_updated` 和 `sse:task_update` 事件
  - [ ] SubTask 5.2: DeadlineChecker 在收到任务更新事件时检查该任务截止日期，发布 `scheduler:deadline_approaching` 事件

- [x] Task 6: Layout 任务状态变更事件化
  - [ ] SubTask 6.1: 在 SSE 事件处理器和 mutation 成功回调中发布 `scheduler:task_status_changed` 事件
  - [ ] SubTask 6.2: 修改 `src/components/Layout/Layout.tsx`，移除 `lastTaskStatusRef` 手动 diff 逻辑，改为订阅 `scheduler:task_status_changed` 事件

- [x] Task 7: 数据失效模式统一化
  - [ ] SubTask 7.1: 在 `FrontendEventSubscribers.ts` 中添加调度器领域事件（`scheduler:task_changed`、`scheduler:task_completed`、`scheduler:stats_changed`）的集中失效处理器
  - [ ] SubTask 7.2: 在 `FrontendEventSubscribers.ts` 中添加图谱领域事件（`graph:data_changed`、`graph:node_created`）的集中失效处理器
  - [ ] SubTask 7.3: 修改 `src/hooks/scheduler/useScheduler.ts` 中的 mutation `onSuccess`，从直接调用 `invalidateQueries` 改为发布领域事件
  - [ ] SubTask 7.4: 修改 `src/hooks/mutations/useGraphMutations.ts` 中的 mutation `onSuccess`，从直接调用 `invalidateQueries` 改为发布领域事件

- [x] Task 8: AchievementNotification 事件总线化
  - [ ] SubTask 8.1: 修改 `src/components/Scheduler/AchievementNotification.tsx`，移除 Context 和 Provider，改为订阅 `achievement:unlocked` 事件
  - [ ] SubTask 8.2: 将所有 `useAchievementNotification().showNotification` 调用替换为 `frontendEventBus.publish("achievement:unlocked", ...)`
  - [ ] SubTask 8.3: 移除 `AchievementNotificationProvider` 包裹

- [ ] Task 9: SSE 连接状态事件传播
  - [ ] SubTask 9.1: 修改 `src/hooks/scheduler/useTaskEvents.ts`，SSE 状态变化时发布 `sse:status_changed` 事件
  - [ ] SubTask 9.2: 修改 `src/components/common/SSEStatusIndicator.tsx`，从读取 `useStore` 改为订阅 `sse:status_changed` 事件
  - [ ] SubTask 9.3: 从 `src/store/useStore.ts` 中移除 `sseStatus`、`sseError`、`setSSEStatus`

- [ ] Task 10: FocusMode 与 LearningMode 事件协调
  - [ ] SubTask 10.1: 在 `LearningMode.tsx` 和 `FocusMode.tsx` 中发布 `focus:enter`/`focus:exit` 事件
  - [ ] SubTask 10.2: 统一专注模式进入/退出逻辑，消除重复的计时器启动代码

- [x] Task 11: MessageStore 事件总线化
  - [ ] SubTask 11.1: 修改 `src/components/common/MessageBar.tsx`，从读取 `useMessageStore` 改为订阅 `message:show` 事件
  - [ ] SubTask 11.2: 将所有 `addMessage()` 调用替换为 `frontendEventBus.publish("message:show", ...)`
  - [ ] SubTask 11.3: 评估是否可以移除 `useMessageStore`（如果无其他消费者）

- [x] Task 12: 验证与测试
  - [ ] SubTask 12.1: 运行 `npm run lint` 确保代码规范
  - [ ] SubTask 12.2: 运行 `npm run check` 确保类型安全
  - [ ] SubTask 12.3: 验证所有事件总线集成场景正常工作

# Task Dependencies

- [Task 2-11] depends on [Task 1] (所有事件发布/订阅依赖类型化事件映射)
- [Task 4] depends on [Task 2] (NotificationCenter 事件驱动依赖 SSE 事件分发)
- [Task 5] depends on [Task 2] (DeadlineChecker 事件驱动依赖 SSE 事件分发)
- [Task 6] depends on [Task 2] (Layout 任务状态事件化依赖 SSE 事件分发)
- [Task 7] depends on [Task 2] (数据失效统一化依赖事件分发基础设施)
- [Task 12] depends on [Task 2-11] (验证依赖所有功能完成)

# TimerStore 去除网络请求副作用 Spec

## Why

`useTimerStore.ts` 内部的 `saveFocusSession` 和 `tickTaskExecution` 直接调用 `api.scheduler`，使 Store 层混入了网络请求逻辑。此外，`initSchedulerIntegration`/`destroySchedulerIntegration` 已导出但零消费者，属于死代码。Store 应回归纯状态管理，网络副作用通过事件总线由外部订阅者处理。

## What Changes

- 将 `saveFocusSession` 和 `tickTaskExecution` 从 `useTimerStore.ts` 移到 `storeIntegrations.ts`，通过事件总线订阅 Timer 状态变化触发
- Store 的 `complete()` 和 `skipToNext()` 改为发布 `focus_session_completed` 事件（含所需数据），不再直接调用网络请求
- 移除 `initSchedulerIntegration`/`destroySchedulerIntegration` 死代码
- 移除 `useTimerStore.ts` 中对 `api` 的导入

## Impact

- Affected code:
  - `src/store/useTimerStore.ts` — 移除网络请求函数和 api 导入，新增事件发布
  - `src/store/storeIntegrations.ts` — 新增 Timer 事件订阅，处理网络副作用
  - `src/services/timer/FrontendEventBus.ts` — 可能需要新增事件类型

## ADDED Requirements

### Requirement: Timer Store 通过事件总线发布完成事件

Timer Store SHALL 在 focus session 完成时通过 `frontendEventBus` 发布事件，而非直接调用 API。

#### Scenario: complete() 发布事件
- **WHEN** `complete()` 被调用且 focus session 结束
- **THEN** SHALL 发布 `focus_session_completed` 事件，包含 `{ taskId, startTimeRef, elapsedDuration, completedSessions, mode }` 数据

#### Scenario: skipToNext() 发布事件
- **WHEN** `skipToNext()` 被调用且已超过 60 秒
- **THEN** SHALL 发布 `focus_session_completed` 事件（同上数据结构）

### Requirement: storeIntegrations 处理 Timer 网络副作用

`storeIntegrations.ts` SHALL 订阅 `focus_session_completed` 事件并执行 `saveFocusSession` 和 `tickTaskExecution` 网络请求。

#### Scenario: 收到完成事件
- **WHEN** `focus_session_completed` 事件被发布
- **THEN** SHALL 调用 `api.scheduler.createFocusSession()` 和 `api.scheduler.tickExecution()`，错误静默处理

## MODIFIED Requirements

### Requirement: Timer Store 无网络请求依赖

`useTimerStore.ts` SHALL 不再导入 `api` 模块，所有网络请求逻辑移至 `storeIntegrations.ts`。

## REMOVED Requirements

### Requirement: initSchedulerIntegration / destroySchedulerIntegration
**Reason**: 已导出但零消费者，属于死代码
**Migration**: 直接删除。scheduler 集成如需恢复，应通过 storeIntegrations.ts 中的事件订阅实现

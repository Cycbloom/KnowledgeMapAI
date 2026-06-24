# Tasks

- [x] Task 1: 在 FrontendEventBus 中新增 focus_session_completed 事件类型
  - [x] SubTask 1.1: 新增 `FocusSessionCompletedPayload` 接口和 `focus_session_completed` 事件映射

- [x] Task 2: 修改 useTimerStore.ts，移除网络请求逻辑
  - [x] SubTask 2.1: 移除 `import { api }` 和 `import type { TaskStartedPayload }` 导入
  - [x] SubTask 2.2: 移除 `saveFocusSession` 和 `tickTaskExecution` 函数
  - [x] SubTask 2.3: 移除 `initSchedulerIntegration` 和 `destroySchedulerIntegration` 函数及其导出
  - [x] SubTask 2.4: 在 `complete()` 中替换网络调用为 `frontendEventBus.publish("focus_session_completed", ...)`
  - [x] SubTask 2.5: 在 `skipToNext()` 中替换网络调用为 `frontendEventBus.publish("focus_session_completed", ...)`

- [x] Task 3: 在 storeIntegrations.ts 中添加 Timer 网络副作用订阅
  - [x] SubTask 3.1: 订阅 `focus_session_completed` 事件，调用 `api.scheduler.createFocusSession()` 和 `api.scheduler.tickExecution()`
  - [x] SubTask 3.2: 错误静默处理（`.catch(() => {})` 与原逻辑一致）

- [x] Task 4: 类型检查验证
  - [x] SubTask 4.1: `npx tsc --noEmit` 零错误通过
  - [x] SubTask 4.2: useTimerStore.ts 中无 `api` 导入

# Task Dependencies
- [Task 2] depends on [Task 1]
- [Task 3] depends on [Task 1]
- [Task 4] depends on [Task 2, Task 3]

# Tasks

- [x] Task 1: 添加 `focus_settings_changed` 事件类型到 FrontendEventTypes
  - [x] 在 `src/services/FrontendEventTypes.ts` 中添加 `FocusSettingsChangedPayload` 接口
  - [x] 在 `FrontendEventMap` 中注册 `focus_settings_changed` 事件

- [x] Task 2: 修改 `useFocusStore`，移除对 `useNoiseStore` 的直接引用，发布事件
  - [x] 移除 `useNoiseStore` 的 import 和 re-export
  - [x] 修改 `exitFocusMode`：使用 `(set, get)` 捕获 `currentNodeId`，改为发布 `focus_exit` 事件
  - [x] 修改 `updateSettings`：更新后发布 `focus_settings_changed` 事件
  - [x] 引入 `frontendEventBus` import

- [x] Task 3: 修改 `useTimerStore`，移除对 `useFocusStore` 的直接引用
  - [x] 移除 `useFocusStore` import
  - [x] 添加 `FocusSettings` 类型到 TimerState
  - [x] 添加 `syncFocusSettings` action
  - [x] 用 `DEFAULT_SETTINGS` 初始化 focusSettings
  - [x] 替换所有 `useFocusStore.getState()` 调用为内部 `focusSettings` 读取
  - [x] 引入 `DEFAULT_SETTINGS` import

- [x] Task 4: 新增 `storeIntegrations.ts` 模块
  - [x] 创建 `src/store/storeIntegrations.ts`
  - [x] 订阅 `focus_exit` → 调用 `useNoiseStore.getState().setNoise("none")`
  - [x] 订阅 `focus_settings_changed` → 调用 `useTimerStore.getState().syncFocusSettings(settings)`

- [x] Task 5: 清理 `LearningMode.tsx` 中冗余的 `focus_exit` 发布
  - [x] 移除 `LearningMode.tsx` 中 `exitFocusMode()` 后的 `frontendEventBus.publish("focus_exit", ...)` 调用

- [x] Task 6: 确保 `storeIntegrations` 在应用启动时被加载
  - [x] 在 `src/main.tsx` 中 import `storeIntegrations.ts`

- [x] Task 7: 验证与测试
  - [x] 运行 `npm run check` 类型检查 - 通过
  - [x] 运行 `npm run lint` 代码检查 - 仅有 1 个预存错误（ActiveTaskPanel.tsx ref 问题），与本次改动无关
  - [x] 验证 Store 文件之间不再有直接 import 依赖 - `useFocusStore` 和 `useTimerStore` 之间仅保留 `DEFAULT_SETTINGS` 常量导入

# Task Dependencies
- Task 2、Task 3 依赖 Task 1
- Task 4 依赖 Task 2、Task 3
- Task 5 依赖 Task 2
- Task 6 依赖 Task 4
- Task 7 依赖 Task 1-6
# Tasks

## Phase 1: 工具函数提取（高优先级）

- [x] Task 1: 创建 Mobile 服务层客户端工具函数
  - [x] SubTask 1.1: 创建 `src/services/mobile/utils/clientHelper.ts`，实现 `withClient` 函数
  - [x] SubTask 1.2: 重构 `src/services/mobile/scheduler.ts` 使用新工具函数
  - [x] SubTask 1.3: 重构 `src/services/mobile/graphs.ts` 使用新工具函数
  - [x] SubTask 1.4: 重构 `src/services/mobile/nodes.ts` 使用新工具函数
  - [x] SubTask 1.5: 重构 `src/services/mobile/study.ts` 使用新工具函数
  - [x] SubTask 1.6: 重构其他 Mobile 服务文件使用新工具函数

- [x] Task 2: 创建消息通知工具函数
  - [x] SubTask 2.1: 创建 `src/utils/messageHelper.ts`，实现 `message` 工具对象
  - [x] SubTask 2.2: 更新所有使用 `frontendEventBus.publish("message_show", ...)` 的文件

- [x] Task 3: 创建主题类名工具函数
  - [x] SubTask 3.1: 创建 `src/utils/themeClasses.ts`，实现 `tc` 工具对象
  - [x] SubTask 3.2: 更新高频使用的组件使用新工具函数

## Phase 2: Hook 合并（中优先级）

- [x] Task 4: 合并错误处理 Hook
  - [x] SubTask 4.1: 分析 `useError` 和 `useErrorHandler` 的功能差异
  - [x] SubTask 4.2: 创建合并后的 `useError` Hook，包含所有功能
  - [x] SubTask 4.3: 更新所有使用旧 Hook 的组件
  - [x] SubTask 4.4: 删除 `useErrorHandler.ts` 文件

- [x] Task 5: 合并网络状态 Hook
  - [x] SubTask 5.1: 分析 `useNetworkStatus` 和 `useNetworkStatusEnhanced` 的功能差异
  - [x] SubTask 5.2: 创建合并后的 `useNetworkStatus` Hook，支持可选增强功能
  - [x] SubTask 5.3: 更新所有使用旧 Hook 的组件
  - [x] SubTask 5.4: 删除 `useNetworkStatusEnhanced.ts` 文件

## Phase 3: 组件合并（中优先级）

- [x] Task 6: 合并 TemplateSelector 组件
  - [x] SubTask 6.1: 分析三个 TemplateSelector 组件的功能差异
  - [x] SubTask 6.2: 设计统一的组件接口（增强现有 TemplateSelector）
  - [x] SubTask 6.3: 增强 `Scheduler/TemplateSelector` 组件
  - [x] SubTask 6.4: 更新所有使用旧组件的文件
  - [x] SubTask 6.5: 删除 `TaskTemplateSelector.tsx` 文件

- [x] Task 7: 合并空状态组件
  - [x] SubTask 7.1: 分析 `Empty` 和 `EmptyState` 组件的功能差异
  - [x] SubTask 7.2: 确保 `EmptyState` 覆盖所有使用场景
  - [x] SubTask 7.3: 更新所有使用 `Empty` 的文件（无使用）
  - [x] SubTask 7.4: 删除 `Empty.tsx` 文件

- [x] Task 8: 合并确认对话框组件
  - [x] SubTask 8.1: 分析 `ConfirmationModal` 和 `ConfirmDialog` 的功能差异
  - [x] SubTask 8.2: 增强 `ConfirmationModal` 支持所有功能
  - [x] SubTask 8.3: 更新所有使用 `ConfirmDialog` 的文件
  - [x] SubTask 8.4: 删除 `Console/ConfirmDialog.tsx` 文件

## Phase 4: 服务层优化（低优先级）

- [x] Task 9: 提取流式处理函数
  - [x] SubTask 9.1: 创建 `src/services/shared/streamHandler.ts`
  - [x] SubTask 9.2: 重构 `src/services/api/ai.ts` 使用共享函数
  - [x] SubTask 9.3: 重构 `src/services/mobile/ai.ts` 使用共享函数

# Task Dependencies

- [Task 2] 可独立进行
- [Task 3] 可独立进行
- [Task 4] 可独立进行
- [Task 5] 可独立进行
- [Task 6] 可独立进行
- [Task 7] 可独立进行
- [Task 8] 可独立进行
- [Task 9] 可独立进行
- [Task 1] 建议优先执行，影响范围最大
- [Task 4, 5] 建议在 Task 1 完成后执行，便于统一测试
- [Task 6, 7, 8] 可并行执行

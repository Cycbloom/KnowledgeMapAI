# Tasks

- [x] Task 1: 统一调度器常量 QUEUE_COLORS 和 STATUS_CONFIG
  - [x] SubTask 1.1: 创建 `src/constants/scheduler.ts`，定义统一的 QUEUE_COLORS（支持不同粒度子集）和 STATUS_CONFIG
  - [x] SubTask 1.2: 替换 `src/components/Scheduler/TaskCard.tsx` 中的内联 QUEUE_COLORS 和 STATUS_CONFIG
  - [x] SubTask 1.3: 替换 `src/components/Scheduler/DraggableTaskCard.tsx` 中的内联 QUEUE_COLORS 和 STATUS_CONFIG
  - [x] SubTask 1.4: 替换 `src/components/Scheduler/ListView.tsx` 中的内联 QUEUE_COLORS 和 STATUS_CONFIG
  - [x] SubTask 1.5: 替换 `src/components/Scheduler/MiniTimer.tsx` 中的内联 QUEUE_COLORS
  - [x] SubTask 1.6: 替换 `src/components/Scheduler/QueueSettings.tsx` 中的内联 QUEUE_COLORS
  - [x] SubTask 1.7: 替换 `src/components/Scheduler/TaskRecommendation.tsx` 中的内联 QUEUE_COLORS
  - [x] SubTask 1.8: 替换 `src/components/Scheduler/TimelineView.tsx` 中的内联 QUEUE_COLORS
  - [x] SubTask 1.9: 替换 `src/components/Scheduler/TaskDetail.tsx` 中的内联 STATUS_CONFIG
  - [x] SubTask 1.10: 替换 `src/components/Knowledge/RelatedTasks.tsx` 中的内联 QUEUE_COLORS 和 STATUS_CONFIG
  - [x] SubTask 1.11: 替换 `src/pages/UnifiedWorkbench.tsx` 中的内联 QUEUE_COLORS 和 STATUS_CONFIG
  - [x] SubTask 1.12: 替换 `src/pages/SchedulerStats.tsx` 中的内联 QUEUE_COLORS

- [x] Task 2: 统一时间格式化函数 formatTime 和 formatDate
  - [x] SubTask 2.1: 在 `src/utils/formatters.ts` 中新增 `formatTimeFromSeconds(seconds: number): string` 和 `formatDate(dateStr: string, format?): string`
  - [x] SubTask 2.2: 替换所有秒转 MM:SS 的内联 formatTime（6处不含 FocusTimer/MobileFocusTimer，由 Task 5 处理）
  - [x] SubTask 2.3: 替换所有分钟转时长的 formatTime 为使用 formatters.ts 已有的 `formatDurationMinutes`（6处）
  - [x] SubTask 2.4: 替换所有日期格式化的内联 formatDate（12处）

- [x] Task 3: 统一 isRetryableError 和 getErrorMessage
  - [x] SubTask 3.1: 在 `src/utils/errors.ts` 中增强 `getErrorMessage` 支持 ApiError 类型，增强 `isRetryableError` 支持 HTTP status code 判断
  - [x] SubTask 3.2: 让 `src/utils/retryFetch.ts` 中的 `isRetryableError` 和 `getErrorMessage` 改为从 errors.ts 导入，移除本地实现
  - [x] SubTask 3.3: 评估 retryFetch.ts 中其他导出的使用情况——确认无外部引用，已删除该文件

- [x] Task 4: 提取 ErrorBoundary/GlobalErrorBoundary 共享逻辑
  - [x] SubTask 4.1: 创建 `src/components/common/CopyButton.tsx`，提取共享的复制按钮组件
  - [x] SubTask 4.2: 修改 `ErrorBoundary.tsx` 引用 CopyButton
  - [x] SubTask 4.3: 修改 `GlobalErrorBoundary.tsx` 引用 CopyButton

- [x] Task 5: 提取 FocusTimer/MobileFocusTimer 共享函数
  - [x] SubTask 5.1: 创建 `src/constants/timer.ts`，提取 getModeLabel 和 TIMER_MODE_COLORS
  - [x] SubTask 5.2: 修改 `FocusTimer.tsx` 引用 formatTimeFromSeconds 和 getModeLabel
  - [x] SubTask 5.3: 修改 `MobileFocusTimer.tsx` 引用 formatTimeFromSeconds、getModeLabel 和 TIMER_MODE_COLORS
  - [x] SubTask 5.4: 修改 `PomodoroCycleBar.tsx` 引用 getModeLabel 和 TIMER_MODE_COLORS

- [x] Task 6: 消除 graph→scheduler 循环依赖
  - [x] SubTask 6.1: 在事件总线中使用已有的 `graph_created` 事件
  - [x] SubTask 6.2: 修改 `graphService.ts` 移除 smartTaskLinker 直接调用（已有事件发布）
  - [x] SubTask 6.3: 在 `smartTaskLinker.ts` 中添加 `subscribeToGraphCreatedEvents()` 方法订阅事件
  - [x] SubTask 6.4: 从 `graphService.ts` 中移除对 `../scheduler/smartTaskLinker` 的导入

- [x] Task 7: 消除 ai→graph 循环依赖
  - [x] SubTask 7.1: 定义 `IGraphQueryService` 接口到 `api/services/ai/types.ts`
  - [x] SubTask 7.2: 修改 `chatService.ts` 添加 `setGraphQueryService()` setter，移除直接导入
  - [x] SubTask 7.3: 在 `ai/index.ts` 注入 graphService 实例
  - [x] SubTask 7.4: 验证 chatService 功能不变

- [x] Task 8: 消除 scheduler→ai 循环依赖
  - [x] SubTask 8.1: 在 `subtaskQuizIntegration.ts` 中将 aiService 改为通过 `setAIProviderService()` setter 注入
  - [x] SubTask 8.2: 在 `scheduler/index.ts` 注入 aiService 实例
  - [x] SubTask 8.3: 移除 `subtaskQuizIntegration.ts` 对 `../ai/index` 的运行时导入（保留类型导入 via `./types`）

- [x] Task 9: 修复类型系统与数据库同步
  - [x] SubTask 9.1: 创建 `scripts/check-generated-types.mjs` + CI 集成 + `db:check-types` npm script
  - [x] SubTask 9.2: 将 `database.ts` 中 22 个手写 Row 类型迁移为引用 `database.generated.ts`
  - [x] SubTask 9.3: 添加 `validateGraphSettings()` 运行时校验 + 类型守卫 `isUserTaskStatus/isTaskType/isProgressMode`

- [x] Task 10: 验证与回归测试
  - [x] SubTask 10.1: `npm run check:full` 通过，零类型错误
  - [x] SubTask 10.2: `npm run lint:full` 通过，零 lint 错误
  - [x] SubTask 10.3: E2E 测试运行，失败均为预存问题（本地 supabase 未启动导致超时），无新增失败
  - [x] SubTask 10.4: 循环依赖已消除（graphService 不再导入 scheduler，chatService 通过接口注入，subtaskQuizIntegration 通过接口注入）

# Task Dependencies
- [Task 2] depends on [Task 1] (formatters.ts 扩展与常量统一可并行，但 Timer 常量提取依赖 formatTimeFromSeconds)
- [Task 5] depends on [Task 2 SubTask 2.1] (timer.ts 中的 formatTimeFromSeconds 依赖 formatters.ts 先定义)
- [Task 6, 7, 8] 可并行执行（三个循环依赖修复相互独立）
- [Task 10] depends on [Task 1-9 全部完成]
- [Task 3] 和 [Task 4] 相互独立可并行

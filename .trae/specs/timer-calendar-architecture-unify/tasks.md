# Tasks

## Phase 1: 类型系统统一

- [x] Task 1: 统一 TimerMode 类型定义
  - [x] SubTask 1.1: 在 `@shared/types` 中定义统一的 TimerMode 类型（"focus" | "shortBreak" | "longBreak"）
  - [x] SubTask 1.2: 移除 `useFocusStore.ts` 中的 TimerMode 定义，改为从 @shared/types 导入
  - [x] SubTask 1.3: 移除 `FocusStreak.tsx` 中的 timerMode prop 类型重复定义，改为使用统一类型
  - [x] SubTask 1.4: 更新 TimerService.ts 中的 TimerMode 引用

- [x] Task 2: 统一 CalendarEvent 与 UserTask 的关系
  - [x] SubTask 2.1: 重构 `types/calendar.ts`，将 CalendarEvent 定义为 UserTask 的视图投影类型（基于 UserTask 的 Pick/Omit + 额外计算字段）
  - [x] SubTask 2.2: 创建 `utils/calendarEventMapper.ts` 工具函数，将 UserTask 转换为 CalendarEvent
  - [x] SubTask 2.3: 更新 CalendarPage 中的手动映射逻辑，使用工具函数

## Phase 2: 通知模式统一

- [x] Task 3: 建立统一通知服务
  - [x] SubTask 3.1: 审查现有通知方式（message.success、frontendEventBus.publish("message_show")、浏览器通知、声音通知）
  - [x] SubTask 3.2: 扩展 `utils/messageHelper.ts` 或创建 `services/notification.ts`，支持 toast、浏览器通知、声音等多渠道
  - [x] SubTask 3.3: 将 CalendarPage 中的 `frontendEventBus.publish("message_show")` 调用迁移为 `message.success()` 等统一接口
  - [x] SubTask 3.4: 将 TimerService 中的通知逻辑（playNotificationSound、sendBrowserNotification）抽取为通知服务的独立方法

## Phase 3: 状态管理模式统一 — 日历系统

- [x] Task 4: 创建日历专用 React Query hooks
  - [x] SubTask 4.1: 创建 `hooks/calendar/useCalendarEvents.ts`，封装任务列表 → CalendarEvent 的转换逻辑
  - [x] SubTask 4.2: 创建 `hooks/calendar/useCalendarExecutions.ts`，封装执行记录查询
  - [x] SubTask 4.3: 创建 `hooks/calendar/useCalendarActivities.ts`，封装活动统计和每日活动查询
  - [x] SubTask 4.4: 创建 `hooks/calendar/useCalendarNavigation.ts`，封装日期导航逻辑（月/周/日切换）
  - [x] SubTask 4.5: 创建 `hooks/calendar/index.ts` 统一导出

- [x] Task 5: 拆分 CalendarPage 组件
  - [x] SubTask 5.1: 抽取 `CalendarHeader.tsx` — 导航栏、视图切换、模式切换
  - [x] SubTask 5.2: 抽取 `CalendarTaskModal.tsx` — 快速创建任务弹窗
  - [x] SubTask 5.3: 抽取 `CalendarExportModal.tsx` — 导出弹窗
  - [x] SubTask 5.4: 重构 `CalendarPage.tsx` 为组合组件，使用新 hooks 和子组件
  - [x] SubTask 5.5: 为日历组件添加 i18n 支持（对齐 Scheduler 模式）

## Phase 4: 计时器架构统一

- [x] Task 6: 创建 Zustand Timer Store
  - [x] SubTask 6.1: 创建 `store/useTimerStore.ts`，定义计时器状态（timeLeft, isActive, isPaused, mode, taskId, completedSessions 等）和 actions（start, pause, resume, complete, skipToBreak, switchTask, setMode, reset）
  - [x] SubTask 6.2: 实现 interval 逻辑（使用 store 内部的 setInterval/clearInterval）
  - [x] SubTask 6.3: 实现模式切换逻辑（focus → break → focus 的自动切换）
  - [x] SubTask 6.4: 通过 Zustand subscribe 实现副作用（页面标题更新、专注记录保存、通知触发）
  - [x] SubTask 6.5: 确保新 store 与现有 TimerService 可共存（渐进迁移）

- [x] Task 7: 迁移组件到新 Timer Store
  - [x] SubTask 7.1: 迁移 `FocusMode.tsx` — 从 useUnifiedTimer 切换到 useTimerStore
  - [x] SubTask 7.2: 迁移 `MiniTimer.tsx` — 纯展示组件，通过 props 传递数据
  - [x] SubTask 7.3: 迁移 `TaskTimer.tsx` — 纯展示组件，通过 props 传递数据
  - [x] SubTask 7.4: 迁移 `BreakTimer.tsx` — 切换到 useTimerStore
  - [x] SubTask 7.5: 迁移 `Scheduler.tsx` 中的 timerService.start() 调用 — 切换到 useTimerStore
  - [x] SubTask 7.6: 迁移 `FocusTimer.tsx` 和 `MobileFocusTimer.tsx` — 切换到 useTimerStore

- [x] Task 8: 拆分 FocusMode 组件
  - [x] SubTask 8.1: 抽取 `useFullscreen.ts` hook — 全屏切换逻辑
  - [x] SubTask 8.2: 抽取 `FocusModeNoisePanel.tsx` — 白噪音选择和混音控制
  - [x] SubTask 8.3: 简化 `FocusMode.tsx` 为组合组件，仅负责布局和子组件组合

## Phase 5: EventBus 职责收窄

- [x] Task 9: 迁移内部事件到 Zustand/React Query
  - [x] SubTask 9.1: 将 timer 相关事件迁移到 Zustand subscribe
  - [x] SubTask 9.2: 将 scheduler 内部事件迁移到 React Query invalidation
  - [x] SubTask 9.3: 清理 FrontendEventTypes.ts 中已迁移的事件类型
  - [x] SubTask 9.4: 保留 EventBus 仅用于 SSE、sync、notification、graph 等跨系统事件

## Phase 6: useFocusStore 拆分与清理

- [x] Task 10: 拆分 useFocusStore
  - [x] SubTask 10.1: 将白噪音相关状态和 actions 迁移到 `useNoiseStore.ts`
  - [x] SubTask 10.2: 高亮状态保留在 useFocusStore（与专注模式紧密相关，仅 2 个状态）
  - [x] SubTask 10.3: useFocusStore 精简为专注模式入口和计时器设置
  - [x] SubTask 10.4: 更新所有引用 useFocusStore 的组件

## Phase 7: 清理与验证

- [x] Task 11: 移除旧代码
  - [x] SubTask 11.1: 确认所有组件已迁移后，移除 `TimerService.ts`
  - [x] SubTask 11.2: 移除 `useUnifiedTimer.ts`
  - [x] SubTask 11.3: 清理不再需要的 EventBus 事件和类型

- [x] Task 12: 验证与测试
  - [x] SubTask 12.1: 运行 `npm run check` 确保类型检查通过
  - [x] SubTask 12.2: 运行 `npm run lint` 确保代码规范
  - [x] SubTask 12.3: 手动验证计时器功能（启动、暂停、恢复、完成、模式切换）
  - [x] SubTask 12.4: 手动验证日历功能（月/周/日/日程视图、任务创建、导出）
  - [x] SubTask 12.5: 手动验证通知功能（toast、浏览器通知、声音）

# Task Dependencies

- Task 2 depends on Task 1 (类型统一是基础)
- Task 3 depends on Task 1 (通知类型需要统一)
- Task 4 depends on Task 2 (日历 hooks 需要统一的类型)
- Task 5 depends on Task 4 (拆分组件需要 hooks)
- Task 6 depends on Task 1, Task 3 (Timer Store 需要统一类型和通知)
- Task 7 depends on Task 6 (迁移组件需要新 Store)
- Task 8 depends on Task 7 (拆分 FocusMode 需要先迁移)
- Task 9 depends on Task 7 (EventBus 迁移需要组件已切换到 Zustand)
- Task 10 depends on Task 7 (拆分 FocusStore 需要 Timer Store 就绪)
- Task 11 depends on Task 9, Task 10 (清理需要所有迁移完成)
- Task 12 depends on Task 11 (验证需要清理完成)

# Parallelizable Work

- Task 1 和 Task 3 可以并行（类型统一和通知统一互不依赖）
- Task 4 和 Task 6 可以并行（日历 hooks 和 Timer Store 互不依赖）
- Task 5 和 Task 7 可以并行（日历拆分和组件迁移互不依赖）

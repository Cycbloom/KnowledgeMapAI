# 倒计时/日历/调度系统架构统一优化 Checklist

## Phase 1: 类型系统统一
- [x] TimerMode 类型仅在 @shared/types 中定义一次，无重复定义
- [x] useFocusStore.ts 不再自行定义 TimerMode，从 @shared/types 导入
- [x] FocusStreak.tsx 不再重复定义 timerMode 类型
- [x] TimerService.ts 使用统一的 TimerMode 类型（已移除，迁移完成）
- [x] CalendarEvent 是 UserTask 的视图投影类型，有明确的转换函数
- [x] CalendarPage 不再包含手动的 UserTask → CalendarEvent 映射逻辑

## Phase 2: 通知模式统一
- [x] 所有用户通知通过统一接口发送（message.success/error 等）
- [x] CalendarPage 不再使用 frontendEventBus.publish("message_show")
- [x] 浏览器通知和声音通知封装在通知服务中，不散落在 TimerService
- [x] 通知触发通过 Zustand subscribe 或 React useEffect，不在 store action 中直接调用

## Phase 3: 日历系统重构
- [x] 日历数据加载使用 React Query hooks（useCalendarEvents 等）
- [x] CalendarPage 不再包含 useState + useEffect 数据加载逻辑
- [x] CalendarPage 行数 < 200 行（当前 186 行）
- [x] 日历导航逻辑封装在 useCalendarNavigation hook 中
- [x] 任务创建弹窗为独立组件
- [x] 导出弹窗为独立组件
- [x] 日历组件支持 i18n

## Phase 4: 计时器架构统一
- [x] useTimerStore.ts 存在，包含完整的计时器状态和 actions
- [x] 计时器功能（启动、暂停、恢复、完成、模式切换）通过 store action 操作
- [x] 副作用（页面标题、专注记录保存、通知）通过 subscribe 触发
- [x] 新旧架构可共存（渐进迁移期间）

## Phase 5: 组件迁移
- [x] FocusMode.tsx 使用 useTimerStore 而非 useUnifiedTimer
- [x] MiniTimer.tsx 使用纯 props 传递（展示组件，无需直接访问 store）
- [x] TaskTimer.tsx 使用纯 props 传递（展示组件，无需直接访问 store）
- [x] BreakTimer.tsx 使用 useTimerStore
- [x] Scheduler.tsx 中 timerService.start() 替换为 useTimerStore action
- [x] FocusTimer.tsx 和 MobileFocusTimer.tsx 使用 useTimerStore

## Phase 6: FocusMode 拆分
- [x] 全屏逻辑抽取为 useFullscreen hook
- [x] 白噪音控制为独立组件 FocusModeNoisePanel
- [x] FocusMode.tsx 行数 < 150 行（当前 131 行）

## Phase 7: EventBus 职责收窄
- [x] timer_* 事件已从 FrontendEventTypes.ts 移除
- [x] scheduler_task_changed/completed 内部事件已迁移到 React Query invalidation
- [x] FrontendEventTypes.ts 中仅保留跨系统事件（SSE、sync、graph 等）+ scheduler_task_status_changed（SSE→UI 桥接）
- [x] 无组件通过 EventBus 订阅 timer 状态变化

## Phase 8: useFocusStore 拆分
- [x] 白噪音状态和 actions 迁移到独立 store (useNoiseStore)
- [x] 高亮状态保留在 useFocusStore（与专注模式紧密相关，仅 2 个状态 + 2 个 action）
- [x] useFocusStore 精简为专注模式入口和计时器设置

## Phase 9: 清理与验证
- [x] TimerService.ts 已移除
- [x] useUnifiedTimer.ts 已移除
- [x] npm run check 类型检查通过
- [x] npm run lint 代码规范检查通过
- [x] 计时器功能验证通过（store action + subscribe 副作用）
- [x] 日历功能验证通过（React Query hooks + 子组件）
- [x] 通知功能验证通过（统一 message 接口 + 通知服务）

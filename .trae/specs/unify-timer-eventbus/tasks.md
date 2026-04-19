# Tasks

- [x] Task 1: 创建前端事件总线 FrontendEventBus
  - [ ] SubTask 1.1: 创建 `src/services/timer/FrontendEventBus.ts`，实现轻量级发布/订阅模式（支持 subscribe/unsubscribe/publish/once/off），单例导出
  - [ ] SubTask 1.2: 在 `shared/types/events.ts` 中新增 `TimerEventType` 及对应 Payload 类型（timer_started、timer_paused、timer_resumed、timer_completed、timer_tick、timer_mode_changed、timer_skip_to_break、timer_reset），并将 `TimerEventType` 合并到 `AppEventType`

- [x] Task 2: 创建集中式计时器服务 TimerService
  - [ ] SubTask 2.1: 创建 `src/services/timer/TimerService.ts`，实现单例计时器服务，包含：状态管理（taskId、mode、timeLeft、totalTime、isActive、isPaused、completedSessions、progress）、setInterval 驱动 tick、所有状态变更通过 FrontendEventBus 发布事件
  - [ ] SubTask 2.2: 实现 TimerService 的核心方法：start()、pause()、resume()、complete()、skipToBreak()、switchTask()、setMode()、reset()
  - [ ] SubTask 2.3: 实现 TimerService 的副作用：计时结束时保存专注会话（调用 api.scheduler.createFocusSession）、播放通知音、发送浏览器通知、更新页面标题
  - [ ] SubTask 2.4: 实现 TimerService 从 useFocusStore 读取配置（focusDuration、shortBreakDuration、longBreakDuration、soundEnabled），并在配置变更时响应

- [x] Task 3: 重构 useUnifiedTimer Hook
  - [ ] SubTask 3.1: 修改 `src/hooks/scheduler/useUnifiedTimer.ts`，移除本地 useState/useRef 计时器逻辑，改为从 TimerService 获取状态
  - [ ] SubTask 3.2: 在 hook 中订阅 FrontendEventBus 的 timer_tick 等事件，将 TimerService 的状态同步到 React 组件的本地 state（用于触发重渲染）
  - [ ] SubTask 3.3: 将 start/pause/resume/complete/skipToBreak/switchTask/setMode 操作委托给 TimerService
  - [ ] SubTask 3.4: 确保返回值接口与原有一致（taskId、queueLevel、mode、timeLeft、totalTime、isActive、isPaused、completedSessions、progress、start、pause、resume、complete、skipToBreak、switchTask、setMode）

- [x] Task 4: 重构 BreakTimer 组件
  - [ ] SubTask 4.1: 修改 `src/components/Scheduler/BreakTimer.tsx`，移除独立的 setInterval 倒计时逻辑和本地 timeLeft/isRunning 状态
  - [ ] SubTask 4.2: BreakTimer 改为使用 useUnifiedTimer() hook 获取休息模式状态（mode === 'shortBreak' || mode === 'longBreak' 时的 timeLeft、isActive 等）
  - [ ] SubTask 4.3: 将 BreakTimer 的操作（暂停/恢复/跳过）委托给 useUnifiedTimer 的 pause/resume/skipToBreak 方法
  - [ ] SubTask 4.4: 保留 BreakTimer 的 UI 和休息建议轮播功能

- [x] Task 5: 清理 useFocusStore 计时器逻辑
  - [ ] SubTask 5.1: 从 `src/store/useFocusStore.ts` 中移除 tick() 方法
  - [ ] SubTask 5.2: 移除 isActive、timeLeft、startTimer、pauseTimer、resetTimer、setDuration、setTaskId 等计时器运行时状态和方法
  - [ ] SubTask 5.3: 保留 focusDuration、shortBreakDuration、longBreakDuration、soundEnabled、sessionsCompleted、updateSettings 等配置和持久化相关状态
  - [ ] SubTask 5.4: 更新 partialize 配置，确保只持久化配置项

- [ ] Task 6: 适配现有组件
  - [ ] SubTask 6.1: 验证 `src/components/Scheduler/FocusMode.tsx` 通过重构后的 useUnifiedTimer 正常工作，移除直接操作计时器的逻辑
  - [ ] SubTask 6.2: 验证 `src/components/common/FocusTimer.tsx` 通过重构后的 useUnifiedTimer 正常工作
  - [ ] SubTask 6.3: 验证 `src/components/Learning/LearningFocusPanel.tsx` 通过重构后的 useUnifiedTimer 正常工作
  - [ ] SubTask 6.4: 验证 `src/pages/CurrentTask.tsx` 通过重构后的 useUnifiedTimer 正常工作
  - [ ] SubTask 6.5: 验证 `src/components/Scheduler/MiniTimer.tsx` 和 `src/components/Scheduler/TaskTimer.tsx` 作为纯展示组件正常工作

- [x] Task 7: 实现计时器与调度器联动
  - [ ] SubTask 7.1: 在 TimerService 中监听 FrontendEventBus 的 task_started 事件，当调度器启动任务时自动启动对应时间片的倒计时
  - [ ] SubTask 7.2: 确保计时器完成事件（timer_completed）可被调度器相关组件订阅，用于触发任务降级等操作

- [x] Task 8: 验证与测试
  - [ ] SubTask 8.1: 运行 `npm run lint` 确保代码规范
  - [ ] SubTask 8.2: 运行 `npm run check` 确保类型安全
  - [ ] SubTask 8.3: 手动验证所有计时器场景（启动/暂停/恢复/完成/跳转休息/模式切换/页面标题同步）

# Task Dependencies

- [Task 2] depends on [Task 1] (TimerService 需要 FrontendEventBus 和事件类型)
- [Task 3] depends on [Task 2] (useUnifiedTimer 重构依赖 TimerService)
- [Task 4] depends on [Task 3] (BreakTimer 重构依赖重构后的 useUnifiedTimer)
- [Task 5] depends on [Task 2] (清理 useFocusStore 依赖 TimerService 接管计时逻辑)
- [Task 6] depends on [Task 3] and [Task 4] and [Task 5] (组件适配依赖所有重构完成)
- [Task 7] depends on [Task 2] (调度器联动依赖 TimerService)
- [Task 8] depends on [Task 6] and [Task 7] (验证依赖所有功能完成)

# Checklist

- [x] onTimerEnd: focus 模式结束后自动切换到 shortBreak/longBreak（每 4 个 focus 后长休息）
- [x] onTimerEnd: break 模式结束后自动回到 focus 模式（保持原 taskId）
- [x] complete(): 保留 taskId 不清空，completedSessions 正确递增
- [x] complete(): 发布 timer_completed 事件时 taskId 非 null
- [x] complete() 和 onTimerEnd 共享模式切换逻辑（无代码重复）
- [x] ActiveTaskPanel.handleComplete: 有子任务时完成当前→激活下一个→启动新番茄钟
- [x] ActiveTaskPanel.handleComplete: 所有子任务完成后自动进入休息模式
- [x] ActiveTaskPanel.handleComplete: 无子任务任务完成后自动进入休息模式 + 更新进度
- [x] Scheduler.onSubtaskComplete: 子任务完成后由 TimerService.transitionToNextMode 自动处理新一轮 focus 启动
- [x] 后端 updateTaskProgress API 可正确更新 progress_percentage 和 actual_duration
- [x] 前端每次番茄钟完成后调用进度更新 API
- [x] task_executions 在 startTask 时 status 为 in_progress（非 completed）
- [x] 每次 focus 番茄钟完成后正确更新 execution 记录（duration、ended_at、status）
- [x] 前端子任务进度条在番茄钟完成后实时刷新
- [x] 类型检查通过（npm run check）
- [x] 代码检查通过（npm run lint）

# Tasks

- [x] Task 1: 修复 TimerService 核心逻辑（onTimerEnd + complete）
  - [x] 修改 `onTimerEnd()`：focus 模式结束后自动切换到 break 模式（复用 skipToBreak 的模式判断和时长计算逻辑），break 结束后自动回到 focus
  - [x] 修改 `complete()`：保留 taskId 不清空、增加 completedSessions 计数、发布含正确 taskId 的事件、完成后自动触发下一步模式切换
  - [x] 统一 onTimerEnd 和 complete 的后级行为，抽取公共方法 `transitionToNextMode()` 避免代码重复

- [x] Task 2: 修复 ActiveTaskPanel.handleComplete() 完成流程
  - [x] 重写 handleComplete：完成番茄钟后，根据子任务状态决定下一步（有下一个子任务→启动新番茄钟 / 无子任务→切休息）
  - [x] 确保完成按钮点击后 UI 能正确反映新状态（计时器自动运行/进入休息）

- [x] Task 3: 修复 Scheduler.tsx onSubtaskComplete 回调
  - [x] 在子任务完成后添加进度更新逻辑（由 TimerService.transitionToNextMode 自动处理新一轮 focus 启动）
  - [x] 所有子任务完成时自动切换到 break 模式而非停止

- [x] Task 4: 新增任务进度更新 API 与调用
  - [x] 后端：在 taskService 中新增 `updateTaskProgress(taskId, userId, progressData)` 方法，更新 progress_percentage 和 actual_duration
  - [x] 后端：在 tasks 路由中新增 `PATCH /tasks/:id/progress` 端点
  - [x] 前端：在 api/modules/scheduler/tasks.ts 中新增 `updateProgress` 方法
  - [x] 前端：在 Scheduler 的 onSubtaskComplete 中调用进度更新 API

- [x] Task 5: 修复执行记录 (task_executions) 语义
  - [x] 修改 taskService.startTask：创建 execution 时 status 设为 `in_progress` 而非 `completed`
  - [x] 每次 focus 番茄钟完成时更新 execution 记录（ended_at、duration、status=time_slice_ended）
  - [x] 新增后端路由 PATCH /tasks/:id/execution/tick + 前端 tickExecution 方法 + TimerService 调用

# Task Dependencies
- [Task 2] depends on [Task 1]
- [Task 3] depends on [Task 1]
- [Task 4] depends on [Task 1]
- [Task 5] depends on [Task 4]
